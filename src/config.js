// Config for the Stocks Maxxing Agentic entry — Base Sepolia TESTNET ONLY.
// No real money, no mainnet. All addresses verified on-chain 15 Nov 2026.
export const CONFIG = {
  // CHAIN_ID env override exists only for local fork-less testing (anvil default 31337).
  // Production/testnet value is 84532 (Base Sepolia).
  chainId: Number(process.env.CHAIN_ID || 84532),
  chainName: 'Base Sepolia',
  rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
  // Circle USDC on Base Sepolia — verified on-chain (name USDC, symbol USDC,
  // decimals 6, EIP-3002 version "2"). Source: developers.circle.com/stablecoins/usdc-contract-addresses
  // USDC_ADDRESS env override exists only for local fork testing (mock token).
  usdcAddress: process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  usdcDecimals: 6,
  usdcVersion: '2',
  // Price of one research report, in USDC base units (6 decimals).
  // 0.10 USDC = 100000. Circle faucet gives 20 test USDC per request.
  reportPriceUsdc: '0.10',
  reportPriceBaseUnits: 100000n,
  serverPort: Number(process.env.PORT || 8787),
  // x402 network identifiers (spec uses the name; some clients use eip155:84532)
  x402Network: 'base-sepolia',
  x402NetworkEip155: 'eip155:84532',
  // Seller (payTo) address — set via env SELLER_ADDRESS, or generated throwaway.
  sellerAddress: process.env.SELLER_ADDRESS || '',
  // Research universe: US stocks with tokenized equivalents on Base.
  // Mapping note: tokenized versions trade via Base launchpads/partners
  // (e.g. BaseStonk, Bankr); the on-chain mapping is conceptual in this
  // demo — the agent's profit ledger allocates earnings to these names.
  universe: [
    { ticker: 'AAPL', name: 'Apple Inc.', tokenized: 'AAPL (tokenized equity, Base)' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', tokenized: 'NVDA (tokenized equity, Base)' },
    { ticker: 'TSLA', name: 'Tesla, Inc.', tokenized: 'TSLA (tokenized equity, Base)' },
    { ticker: 'MSFT', name: 'Microsoft Corporation', tokenized: 'MSFT (tokenized equity, Base)' },
    { ticker: 'AMZN', name: 'Amazon.com, Inc.', tokenized: 'AMZN (tokenized equity, Base)' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. (Class A)', tokenized: 'GOOGL (tokenized equity, Base)' },
    { ticker: 'META', name: 'Meta Platforms, Inc.', tokenized: 'META (tokenized equity, Base)' },
    { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', tokenized: 'AMD (tokenized equity, Base)' },
    { ticker: 'NFLX', name: 'Netflix, Inc.', tokenized: 'NFLX (tokenized equity, Base)' },
    { ticker: 'PLTR', name: 'Palantir Technologies Inc.', tokenized: 'PLTR (tokenized equity, Base)' },
  ],
  // Profit allocation: earnings from research sales -> tokenized-stock portfolio.
  allocation: [
    { ticker: 'AAPL', pct: 40 },
    { ticker: 'NVDA', pct: 25 },
    { ticker: 'TSLA', pct: 20 },
    { ticker: 'MSFT', pct: 15 },
  ],
};
