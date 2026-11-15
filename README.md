# Stocks Maxxing — Agentic Stock Finance Entry

**Concept:** an AI research agent that **sells stock research as a service**. A buyer pays
**0.10 test USDC via the x402 protocol on Base Sepolia testnet**, the agent verifies the
payment on-chain, and delivers an analyst research report. Profits are allocated to
**tokenized stocks** (paper ledger; see below). Track: **Agentic Stock Finance**
($20,000 pool). Competition: [Stocks Maxxing, Base](https://www.base.org/stocksmaxxing) —
submission deadline **5 Dec 2026 23:59 UTC (6 Dec 07:59 WITA)**.

> **Testnet only. No real money, no mainnet, no real USDC, no spending.**
> All wallets are throwaway demo wallets generated locally (`demo/*-key.json`).
> Never use Suci's wallets here. LLM keys are never in code — Gemini/OpenRouter are
> reached through the already-connected helpers (Secure Vault surrogate mechanism).

## How it works

```
buyer                          agent server (src/server.js)          Base Sepolia
  |  GET /research?ticker=AAPL      |                                   |
  |-------------------------------->|                                   |
  |  HTTP 402 + x402 payment req.   |                                   |
  |<--------------------------------|                                   |
  |  sign EIP-3002 authorization    |                                   |
  |  (USDC transferWithAuthorization)|                                  |
  |  GET /research + X-PAYMENT      |                                   |
  |-------------------------------->|  verify signature (EIP-712)       |
  |                                 |  check USDC balance (eth_call)    |--- eth_call --->|
  |                                 |  settle transferWithAuthorization |--- tx --------->| (if seller funded with test ETH)
  |                                 |  generate report (Yahoo + Gemini) |
  |  research report (markdown)     |                                   |
  |<--------------------------------|  record sale + allocate profit    |
  |                                 |  to tokenized stocks (ledger)     |
```

- **Payment (x402 "exact"):** the server answers `402` with a payment requirement
  (`scheme: exact`, `network: base-sepolia`, `asset: <Circle USDC>`, `amount: 100000`
  base units = 0.10 USDC, `payTo: <seller>`). The buyer signs an EIP-3002
  `transferWithAuthorization` and sends it as an `X-PAYMENT` header (base64 JSON).
  The server verifies the EIP-712 signature, the payee/amount, the validity window,
  and the buyer's on-chain USDC balance — then settles on-chain when the seller
  wallet holds test ETH for gas (otherwise the signed authorization is held and
  settlement is recorded as pending; the sale is still valid).
- **Research:** live quotes from the Yahoo Finance v8 chart API (free, no key) —
  price, day/5-day change, 52-week range, volume — plus a quantitative analysis,
  then an analyst-style note written by Gemini 2.5 Flash via the connected helper
  (cached per ticker+day; OpenRouter free-tier fallback; template fallback if no LLM).
  If Yahoo is unreachable, clearly-labeled sample data is used (never presented as live).
- **Profit → tokenized stocks:** every sale is recorded in `data/sales.jsonl` and its
  earnings are allocated to a tokenized-stock portfolio (AAPL 40%, NVDA 25%, TSLA 20%,
  MSFT 15%) in a paper ledger (`GET /portfolio`). A real on-chain swap to tokenized
  equities is the next step once a Base Sepolia DEX pool for tokenized stocks exists —
  tokenized stocks on Base trade via partners such as BaseStonk/Bankr (mainnet); there
  is no Base Sepolia pool for them today, so the ledger is notional and labeled as such.
- **Universe:** AAPL, NVDA, TSLA, MSFT, AMZN, GOOGL, META, AMD, NFLX, PLTR.

## Quickstart

```bash
cd ~/workspace/tools/stocks-maxxing/agent
npm install                 # ethers v6 (already installed)
npm run wallets             # create throwaway buyer+seller wallets (demo/*-key.json)
npm start                   # server on http://127.0.0.1:8787
npm run buy                 # buy the AAPL report (needs funded buyer, see below)
# one-command demo:
bash demo/run-demo.sh
```

Endpoints: `GET /` (catalog) · `GET /research?ticker=AAPL` (402 or report) ·
`GET /portfolio` (earnings ledger) · `GET /health` (chain, seller balances).

## Funding (testnet only — needs a browser, ~5 minutes)

The buyer needs test USDC and the seller needs a little test ETH (for settlement gas).
Neither can be claimed by curl alone — both faucets need a browser step:

1. **Test USDC (buyer `0x9FC34a466B5CB61f0BF8219Dd24B0C516B69B9D9`):**
   open https://faucet.circle.com → select **USDC + Base Sepolia** → paste the buyer
   address → complete the reCAPTCHA. You get **20 test USDC** (1 request / 2h, no account).
   Contract (verified on-chain): `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals, EIP-3002 v2).
2. **Test ETH (seller `0xDd1c7EB50e3a3232BB449cA894B85d7c7D459a25`, or buyer):**
   Base Sepolia ETH faucet — see `demo/` notes / BUILD-LOG for the verified options.
   Only a tiny amount is needed (one `transferWithAuthorization` ≈ a few cents of test ETH).
3. Re-run `bash demo/run-demo.sh` — the client will sign, pay, and save the report to
   `demo/last-report-AAPL.md`, and the settlement tx hash appears in the output
   (verify at https://sepolia.basescan.org/tx/<hash>).

Without funding, the demo still shows: catalog, health, the 402 challenge, a signed
payment being correctly rejected for insufficient balance, and the research report
generation (LLM) — see BUILD-LOG.md for what was verified unfunded.

## Local happy-path test (no funding needed — mock USDC on anvil)

The full paid flow is proven end-to-end on a local anvil chain with a mock USDC
(`contracts/MockUSDC.sol`, ERC20 6-dec + EIP-3002 `transferWithAuthorization`),
using the real server/client/settlement code — only the chain and token are swapped:

```bash
anvil --port 8545                                   # local chain (default 31337)
forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 \
  --private-key <anvil account #0 key> --broadcast  # note the mock address
cast send <MOCK> 'mint(address,uint256)' <buyer> 100000000 --rpc-url http://127.0.0.1:8545 \
  --private-key <anvil account #0 key>              # fund buyer with 100 mock USDC
cast send <seller> --value 0.05ether --rpc-url http://127.0.0.1:8545 \
  --private-key <anvil account #0 key>              # seller gas money
PORT=8787 RPC_URL=http://127.0.0.1:8545 CHAIN_ID=31337 USDC_ADDRESS=<MOCK> node src/server.js
RPC_URL=http://127.0.0.1:8545 CHAIN_ID=31337 USDC_ADDRESS=<MOCK> node src/client.js AAPL
```

First successful run (15 Nov 2026): settlement tx
`0x6dc55ac8472db82ce4486e96a66a69b18b983b8f9855a8fa4c38bbb051fcc365`
(status 1, 0.10 USDC buyer → seller), report in `demo/last-report-AAPL.md`.
Full log: BUILD-LOG.md ("End-to-end (local chain)"). Copy the anvil account #0
key from the anvil startup log — it ends `...d7bf4f2ff80`.

## Files

```
src/
  config.js      chain, USDC address (verified), price, universe, allocations
  stocks.js      Yahoo Finance fetch + analysis (+ labeled sample fallback)
  sample-data.js clearly-labeled example quotes (fallback only)
  llm.js         Gemini (primary) / OpenRouter (fallback) / template; per-day cache
  x402.js        402 requirements, X-PAYMENT parsing, EIP-3002 verification
  settle.js      on-chain transferWithAuthorization settlement
  portfolio.js   sales ledger + profit -> tokenized-stock allocation
  wallets.js     throwaway demo wallets (demo/*-key.json, chmod 600)
  server.js      HTTP server (catalog / research / portfolio / health)
  client.js      demo buyer (402 -> sign -> X-PAYMENT -> report)
demo/
  run-demo.sh            one-command end-to-end demo
  test-reject-payment.mjs negative test (unfunded buyer must be rejected)
  last-report-<TICKER>.md  saved purchased report
data/ (created at runtime) cache/ (LLM reports), sales.jsonl, portfolio.json
```

## Limitations (honest)

- Profit allocation to tokenized stocks is a **paper ledger**, not an on-chain swap
  (no Base Sepolia DEX pool for tokenized equities exists today).
- The x402 detail from the @Ikhwanhsn post (pay USDC via x402, profit into tokenized
  stocks) is implemented as described, but the official competition page only lists
  the idea title "Sell stock research as a service" — the mechanism is our design.
- Judging criteria and per-track winner counts were not published on the official pages.
- LLM quota: Gemini free tier ~20 req/day (flash); reports are cached per ticker+day.
