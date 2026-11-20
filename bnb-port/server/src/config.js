// Config for the StockSage BNB Chain port — Agent ID Hackathon entry.
// BSC MAINNET (chain 56). Payment is plain ERC20, NOT EIP-3002/x402:
// Binance-Peg USDC on BSC (0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
// 18 decimals) does NOT support EIP-3002 — verified on-chain 20 Nov 2026
// (no version(), no DOMAIN_SEPARATOR(), no nonces(), no
// transferWithAuthorization selector in bytecode). Circle's official USDC
// address page lists NO BNB Chain entry, so there is no native Circle USDC
// on BSC. Buyers approve the EXACT price, then call
// StockSageAccess.purchase(ticker); see access.js.
export const CONFIG = {
  // CHAIN_ID / RPC_URL env overrides exist only for local fork testing
  // (anvil default 31337). Production value is 56 (BNB Chain mainnet).
  chainId: Number(process.env.CHAIN_ID || 56),
  chainName: 'BNB Chain (BSC)',
  rpcUrl: process.env.RPC_URL || 'https://bsc.publicnode.com',
  // Binance-Peg USDC on BSC — verified on-chain 20 Nov 2026 (name "USD Coin",
  // symbol "USDC", 18 decimals, NO EIP-3002).
  // USDC_ADDRESS env override exists only for local fork testing (mock token).
  usdcAddress: process.env.USDC_ADDRESS || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  usdcDecimals: 18,
  // EIP-3002 is NOT supported by this token — there is no version to put here.
  // Any code claiming otherwise is wrong; see src/archive/x402.js (archived).
  usdcVersion: null,
  // Price of one research report, in USDC base units (18 decimals).
  // Full price 0.10 USDC = 100000000000000000 (1e17).
  // Agent ID holder price 0.05 USDC = 50000000000000000 (5e16).
  // The on-chain contract is the source of truth at runtime (priceFor);
  // these constants are the expected values, used for display + sanity checks.
  fullPriceUsdc: '0.10',
  fullPriceBaseUnits: 100000000000000000n,
  holderPriceUsdc: '0.05',
  holderPriceBaseUnits: 50000000000000000n,
  // SPACE ID Agent ID (ERC-721, non-transferable) — holder check is a
  // read-only balanceOf(buyer) > 0 inside the access contract.
  agentIdAddress: process.env.AGENT_ID_ADDRESS || '0x60b9262456de011f7d15a54cdd8c48baaa8b022f',
  // StockSageAccess contract — DEPLOYED 20 Nov 2026 to BSC mainnet:
  // 0xc6cf59c62b7c4d24DaFB221Ce642D0a1EF783bf6 (deploy tx
  // 0xd578a68899232ec87a770fd9e726b1a29d4200390af4a6d95c800503df7ca44a,
  // block 134680219; Sourcify exact_match). Env override kept for fork testing.
  accessContractAddress: process.env.ACCESS_CONTRACT_ADDRESS || '0xc6cf59c62b7c4d24DaFB221Ce642D0a1EF783bf6',
  // How long one purchase unlocks a report (seconds) — mirrors the contract.
  accessWindowSeconds: 86400,
  serverPort: Number(process.env.PORT || 8787),
  // Research universe: US stocks. (Tokenized-equity mapping is conceptual
  // in this demo — the agent's profit ledger allocates earnings to these names.)
  universe: [
    { ticker: 'AAPL', name: 'Apple Inc.', tokenized: 'AAPL (tokenized equity, BNB Chain)' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', tokenized: 'NVDA (tokenized equity, BNB Chain)' },
    { ticker: 'TSLA', name: 'Tesla, Inc.', tokenized: 'TSLA (tokenized equity, BNB Chain)' },
    { ticker: 'MSFT', name: 'Microsoft Corporation', tokenized: 'MSFT (tokenized equity, BNB Chain)' },
    { ticker: 'AMZN', name: 'Amazon.com, Inc.', tokenized: 'AMZN (tokenized equity, BNB Chain)' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. (Class A)', tokenized: 'GOOGL (tokenized equity, BNB Chain)' },
    { ticker: 'META', name: 'Meta Platforms, Inc.', tokenized: 'META (tokenized equity, BNB Chain)' },
    { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', tokenized: 'AMD (tokenized equity, BNB Chain)' },
    { ticker: 'NFLX', name: 'Netflix, Inc.', tokenized: 'NFLX (tokenized equity, BNB Chain)' },
    { ticker: 'PLTR', name: 'Palantir Technologies Inc.', tokenized: 'PLTR (tokenized equity, BNB Chain)' },
  ],
  // Profit allocation: earnings from research sales -> tokenized-stock portfolio.
  allocation: [
    { ticker: 'AAPL', pct: 40 },
    { ticker: 'NVDA', pct: 25 },
    { ticker: 'TSLA', pct: 20 },
    { ticker: 'MSFT', pct: 15 },
  ],
};
