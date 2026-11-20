// On-chain access for the StockSage BNB Chain port.
// Payment flow (replaces the old EIP-3002 / x402 flow — see src/archive/):
//   1. Buyer asks GET /quote or GET /research with ?buyer=0x...
//   2. Server eth_calls StockSageAccess.priceFor(buyer) and
//      hasAccess(buyer, ticker). No signature, no X-PAYMENT header.
//   3. If no access: server answers 402 with the exact price + the two
//      on-chain steps (approve EXACT amount, then purchase(ticker)).
//   4. Buyer sends those two transactions from their own wallet; the
//      contract pulls exactly the quoted USDC via transferFrom and records
//      the purchase on-chain (ResearchPurchased event).
//   5. Buyer retries GET /research — hasAccess is now true, report is served.
//
// Why not EIP-3002: Binance-Peg USDC on BSC has NO transferWithAuthorization
// (verified on-chain 20 Nov 2026 — no version(), DOMAIN_SEPARATOR(),
// nonces(), or transferWithAuthorization selector). There is no native
// Circle USDC on BSC. Plain ERC20 approve + purchase() is the only flow.
import { ethers } from 'ethers';
import { CONFIG } from './config.js';

// Minimal ABI of StockSageAccess — matches
// ../contracts/src/StockSageAccess.sol (compiled ABI in
// ../contracts/out/StockSageAccess.sol/StockSageAccess.json).
export const ACCESS_ABI = [
  'function ACCESS_WINDOW() view returns (uint256)',
  'function fullPrice() view returns (uint256)',
  'function holderPrice() view returns (uint256)',
  'function isAgentIdHolder(address buyer) view returns (bool)',
  'function priceFor(address buyer) view returns (uint256 price, bool isHolder)',
  'function purchase(string ticker)',
  'function hasAccess(address buyer, string ticker) view returns (bool)',
  'event ResearchPurchased(address indexed buyer, string ticker, bytes32 indexed tickerHash, uint256 price, bool agentIdHolder, uint256 timestamp)',
];

// Minimal BEP-20 ABI — only what this server and the demo client need.
// NOTE: deliberately NO version(), DOMAIN_SEPARATOR(), nonces(), or
// transferWithAuthorization — Binance-Peg USDC does not implement EIP-3002.
export const USDC_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export const AGENT_ID_ABI = [
  'function name() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
];

export function getAccessContract(provider) {
  if (!CONFIG.accessContractAddress) return null;
  return new ethers.Contract(CONFIG.accessContractAddress, ACCESS_ABI, provider);
}

/**
 * Read-only quote for a buyer+ticker: on-chain price (holder vs full),
 * holder flag, and whether the buyer already has access (24h window).
 * Throws if the access contract is not configured or the RPC call fails.
 * Returns price as bigint + a human-readable USDC string (18 decimals).
 */
export async function quoteAccess({ provider, buyer, ticker }) {
  const access = getAccessContract(provider);
  if (!access) {
    throw new Error(
      'access contract not configured: set ACCESS_CONTRACT_ADDRESS to the deployed StockSageAccess address (server still runs, but /quote and /research cannot price or verify access)',
    );
  }
  if (!ethers.isAddress(buyer)) throw new Error(`invalid buyer address: ${buyer}`);
  const [priceResult, hasAccess] = await Promise.all([
    access.priceFor(buyer),
    access.hasAccess(buyer, ticker),
  ]);
  const price = BigInt(priceResult[0]);
  const isHolder = Boolean(priceResult[1]);
  return {
    ticker,
    buyer: ethers.getAddress(buyer),
    priceBaseUnits: price.toString(),
    priceUsdc: ethers.formatUnits(price, CONFIG.usdcDecimals),
    isAgentIdHolder: isHolder,
    priceTier: isHolder ? 'holder' : 'full',
    hasAccess,
    accessWindowSeconds: CONFIG.accessWindowSeconds,
    accessContract: CONFIG.accessContractAddress,
    usdc: CONFIG.usdcAddress,
    chainId: CONFIG.chainId,
    chainName: CONFIG.chainName,
  };
}

/**
 * Build the 402 payment instructions returned when a buyer has no access.
 * Gives the buyer everything needed to pay on-chain in two transactions:
 *   1. USDC.approve(accessContract, exactPrice) — EXACT amount, never unlimited.
 *   2. StockSageAccess.purchase(ticker) — pulls exactly that amount.
 * Both the human-readable steps and the raw calldata are included so any
 * wallet / agent client can execute them without guessing.
 */
export function paymentInstructions(quote) {
  const usdcIface = new ethers.Interface(USDC_ABI);
  const accessIface = new ethers.Interface(ACCESS_ABI);
  const price = BigInt(quote.priceBaseUnits);
  return {
    error: 'Payment Required',
    ticker: quote.ticker,
    buyer: quote.buyer,
    price: {
      baseUnits: quote.priceBaseUnits,
      usdc: quote.priceUsdc,
      tier: quote.priceTier,
      isAgentIdHolder: quote.isAgentIdHolder,
      fullPriceUsdc: CONFIG.fullPriceUsdc,
      holderPriceUsdc: CONFIG.holderPriceUsdc,
      note: quote.isAgentIdHolder
        ? 'Agent ID holder price (50% off) — your address holds at least one SPACE ID Agent ID.'
        : 'Full price — hold a SPACE ID Agent ID (0x60b9262456de011f7d15a54cdd8c48baaa8b022f) to pay the 0.05 USDC holder price instead.',
    },
    network: {
      chainId: CONFIG.chainId,
      chainName: CONFIG.chainName,
      eip155: `eip155:${CONFIG.chainId}`,
    },
    asset: {
      name: 'USDC (Binance-Peg)',
      address: CONFIG.usdcAddress,
      decimals: CONFIG.usdcDecimals,
      note: 'Binance-Peg USDC on BSC. This token does NOT support EIP-3002 (no transferWithAuthorization) — payment is plain ERC20 approve + purchase, never a signed authorization.',
    },
    accessContract: quote.accessContract,
    accessWindowSeconds: quote.accessWindowSeconds,
    steps: [
      {
        step: 1,
        action: 'approve',
        description: `Approve EXACTLY ${quote.priceUsdc} USDC (${quote.priceBaseUnits} base units) to the StockSageAccess contract. Do NOT approve an unlimited amount.`,
        contract: CONFIG.usdcAddress,
        function: 'approve(address spender, uint256 amount)',
        args: { spender: quote.accessContract, amount: quote.priceBaseUnits },
        calldata: usdcIface.encodeFunctionData('approve', [quote.accessContract, price]),
      },
      {
        step: 2,
        action: 'purchase',
        description: `Call purchase("${quote.ticker}") on the StockSageAccess contract. It pulls exactly the approved amount via transferFrom and unlocks the report for ${CONFIG.accessWindowSeconds / 3600} hours.`,
        contract: quote.accessContract,
        function: 'purchase(string ticker)',
        args: { ticker: quote.ticker },
        calldata: accessIface.encodeFunctionData('purchase', [quote.ticker]),
      },
      {
        step: 3,
        action: 'fetch',
        description: 'Retry GET /research with the same ?ticker and ?buyer once the purchase transaction is confirmed.',
        url: `/research?ticker=${quote.ticker}&buyer=${quote.buyer}`,
      },
    ],
    retryAfterPurchase: `/research?ticker=${quote.ticker}&buyer=${quote.buyer}`,
  };
}
