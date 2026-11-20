# StockSage — BNB Chain port (Agent ID Hackathon)

Stock research sold for Binance-Peg USDC on **BNB Chain mainnet (chain 56)**,
via the `StockSageAccess` contract. Agent ID holders pay **0.05 USDC**,
everyone else **0.10 USDC** per report (24h access per purchase).

> **Research only, not investment advice; prices can go down as well as up;
> do your own research.**

## How payment works (no EIP-3002 / no x402)

Binance-Peg USDC on BSC (`0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`,
18 decimals) does **NOT** support EIP-3002 — verified on-chain 20 Nov 2026
(no `version()`, `DOMAIN_SEPARATOR()`, `nonces()`, or
`transferWithAuthorization`). There is no native Circle USDC on BSC.
So payment is plain ERC20, two transactions from the buyer's own wallet:

1. `USDC.approve(accessContract, EXACT price)` — exact amount, never unlimited.
2. `StockSageAccess.purchase("AAPL")` — pulls exactly that amount via
   `transferFrom`, records the purchase on-chain (`ResearchPurchased` event).

Then `GET /research?ticker=AAPL&buyer=0x...` returns the report
(`hasAccess` is checked by `eth_call`).

The old Base Sepolia x402/EIP-3002 code is archived, not deleted, under
`src/archive/` (`x402.js`, `settle.js`, `client.js`) with a header explaining
why it cannot run on BSC. Nothing in the live server imports it.

## Run the server

```bash
cd ~/workspace/tools/stocks-maxxing/bnb-port/server
# node_modules is a symlink to the original agent's node_modules (ethers v6).
# Do NOT npm install — the VM registry is flaky.

# Without a deployed contract the server still starts; /quote and /research
# answer 503 with a clear message, / and /portfolio work.
PORT=8787 node src/server.js

# Once StockSageAccess is deployed:
ACCESS_CONTRACT_ADDRESS=0x... PORT=8787 node src/server.js
```

Env vars: `PORT` (default 8787), `RPC_URL` (default
`https://bsc.publicnode.com`), `ACCESS_CONTRACT_ADDRESS` (empty = not
deployed yet), `CHAIN_ID` / `USDC_ADDRESS` / `AGENT_ID_ADDRESS` (only for
local fork testing).

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Catalog: prices, universe, risk warning, contract addresses |
| `GET /quote?ticker=AAPL&buyer=0x...` | `{ price, priceUsdc, isAgentIdHolder, hasAccess, accessContract, usdc }` — 503 if the contract is not configured |
| `GET /research?ticker=AAPL&buyer=0x...` | 402 with approve + purchase steps (incl. calldata) if no access; the report if access was bought on-chain |
| `GET /portfolio` | Paper profit ledger (earnings allocated to tokenized stocks) |
| `GET /health` | Chain + live `eth_call` status for USDC (name/decimals), Agent ID (name), and the access contract if configured |

## Demo buyer

```bash
# Needs the server running + ACCESS_CONTRACT_ADDRESS set, and a throwaway
# wallet funded with BNB (gas) + Binance-Peg USDC.
BUYER_PRIVATE_KEY=0x... node src/client-bnb.js AAPL
# Without BUYER_PRIVATE_KEY it generates a fresh throwaway wallet for that
# run only, prints its address, and exits so you can fund it first.
# NEVER use Suci's wallets (Agentic / farming) here.
```

The client saves the report to `demo/last-report-bnb-<TICKER>.md`.

## Test against an Anvil fork (no mainnet tx)

```bash
# 1. Start an Anvil fork of BSC (needs foundry/anvil installed):
anvil --fork-url https://bsc.publicnode.com --chain-id 56
# 2. Deploy StockSageAccess on the fork (see ../contracts/, forge script):
#    forge script ... --rpc-url http://127.0.0.1:8545 --broadcast
# 3. Fund a throwaway buyer on the fork (anvil default accounts are funded):
#    cast send <USDC> "transfer(address,uint256)" <buyer> <amount> \
#      --from <anvil-account-0> --rpc-url http://127.0.0.1:8545
#    (USDC on the fork is the real Binance-Peg token at its mainnet address.)
# 4. Run server + client against the fork:
RPC_URL=http://127.0.0.1:8545 CHAIN_ID=56 ACCESS_CONTRACT_ADDRESS=0x... PORT=8787 node src/server.js
RPC_URL=http://127.0.0.1:8545 CHAIN_ID=56 ACCESS_CONTRACT_ADDRESS=0x... \
  BUYER_PRIVATE_KEY=0x... node src/client-bnb.js AAPL
```

## Research flow (unchanged from the Base version)

Yahoo Finance v8 chart API → `analyze()` notes → Gemini 2.5 Flash
(OpenRouter free fallback, then a labeled quantitative template),
cached per ticker+day under `data/cache/`. Sales are recorded in
`data/sales.jsonl` (paper ledger only — no funds move through the server).

## Files

- `src/config.js` — BSC config (chain 56, USDC 18 decimals, prices, addresses)
- `src/access.js` — `StockSageAccess` reads (`priceFor`, `hasAccess`) + 402 instructions with calldata
- `src/server.js` — HTTP server (`/`, `/quote`, `/research`, `/portfolio`, `/health`)
- `src/client-bnb.js` — demo buyer (quote → approve exact → purchase → report)
- `src/stocks.js`, `src/llm.js`, `src/sample-data.js` — research flow, unchanged from the Base version
- `src/portfolio.js` — paper profit ledger (18-decimal USDC)
- `src/wallets.js` — throwaway demo-wallet helper (server no longer needs a seller wallet)
- `src/archive/` — old EIP-3002/x402 code, kept for reference only
