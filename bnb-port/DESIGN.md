# StockSage on BNB Chain — Design

**Status:** built + proven on a local Anvil fork of BSC (20 Nov 2026). **Not deployed.**
No mainnet contract exists yet; deployment is Suci's step (see DEPLOY.md).

## What it is

StockSage sells AI stock-research reports. The Base Sepolia original sells a
report for 0.10 test USDC via x402/EIP-3002. The BNB port moves the sale
on-chain on BNB Chain (BSC mainnet, chain 56): the buyer pays real USDC to a
smart contract, the contract records the purchase, and the server only serves
the report after verifying the purchase on-chain.

## Why Agent ID is core, not a sticker

The contract charges **two prices for the same product**:

| Buyer | Price per report |
|---|---|
| Holds ≥ 1 SPACE ID Agent ID | **0.05 USDC** (50% off) |
| No Agent ID | **0.10 USDC** (full price) |

The discount is decided by a read-only `balanceOf(buyer) > 0` call on the
Agent ID contract (0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F) inside
`priceFor()`. The holder flag is also written into the purchase event, so
every discounted sale is provably an Agent ID interaction on-chain. The
contract never looks up anyone else's wallet — it only checks the caller's
own Agent ID balance, and only for pricing.

## Architecture

```
buyer (wallet)                StockSageAccess (BSC)           StockSage server (Node)
  |  GET /quote?ticker&buyer  |                                |
  |---------------------------|  eth_call priceFor/hasAccess    |
  |  402: price + 2 steps      |                                |
  |  1. USDC.approve(contract, EXACT price)
  |  2. purchase(ticker)  ---------------->| transferFrom pulls exact |
  |                           |  amount; records purchase;     |
  |                           |  emits ResearchPurchased       |
  |  GET /research?ticker&buyer                                |
  |----------------------------------------------------------->|  eth_call hasAccess
  |  report (Yahoo live + Gemini 2.5 Flash)                    |  true -> generate + serve
```

- **Contract:** `contracts/src/StockSageAccess.sol` (Solidity 0.8.24,
  OpenZeppelin Ownable + ReentrancyGuard). No other contracts are needed.
- **Payment token:** Binance-Peg USDC on BSC,
  `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`, **18 decimals**.
  Verified on-chain 20 Nov 2026: name "USD Coin", symbol "USDC", decimals 18,
  **no EIP-3002** (no `version()`, `DOMAIN_SEPARATOR()`, `nonces()`, no
  `transferWithAuthorization` selector in bytecode). Circle's official USDC
  address page lists **no BNB Chain entry** — there is no native Circle USDC
  on BSC. Payment is therefore plain ERC20: approve the **exact** price, then
  `purchase()` pulls exactly that amount via `transferFrom`. No unlimited
  approvals are ever requested; no EIP-3002 authorization flow is used.
- **Access:** a purchase unlocks that ticker's report for **24 hours**
  (`ACCESS_WINDOW = 86400`). `hasAccess(buyer, ticker)` is a view call.
- **Research (unchanged from Base):** live quotes from Yahoo Finance v8,
  quant analysis, analyst note by Gemini 2.5 Flash (OpenRouter free fallback,
  template fallback), cached per ticker+day. Universe: AAPL, NVDA, TSLA, MSFT,
  AMZN, GOOGL, META, AMD, NFLX, PLTR.
- **Profit ledger:** sales are recorded in `data/sales.jsonl` and allocated
  to the tokenized-stock paper portfolio (AAPL 40%, NVDA 25%, TSLA 20%,
  MSFT 15%) — same as the Base version, still a paper ledger.

## What is recorded on-chain (hackathon metrics)

Every purchase emits:
`ResearchPurchased(buyer, ticker, tickerHash, price, agentIdHolder, timestamp)`
plus the `purchases[buyer][keccak256(ticker)] = timestamp` storage slot.
That gives the judges, per sale: an interacting address, whether it holds an
Agent ID, the transaction, and the volume (0.05 / 0.10 USDC). No off-chain
database is needed to count them.

## Prices and costs (measured on the BSC fork, 20 Nov 2026)

- Report: **0.05 USDC** (Agent ID holder) / **0.10 USDC** (full).
- Contract deploy: **826,404 gas** (~0.00083 BNB at 1 gwei, ~0.0025 BNB at
  3 gwei). See DEPLOY.md.
- Purchase: **~102,000 gas** (buyer pays, on top of the report price).
- Approve: ~46,000 gas (typical ERC20 approve, not measured exactly).
- Buyer also needs a little BNB for gas on both transactions.

## Hackathon red-line compliance

- No web QR-code login; no pairing codes; no server-held login sessions.
- No prompt or flow bypasses the user's transaction confirmation: the buyer
  signs `approve` and `purchase` in their own wallet and sees both.
- No unauthorized transfers: the contract pulls **exactly** the quoted price
  via `transferFrom` after an exact-amount approval. No unlimited approvals.
- Contract is open-source (MIT); owner permissions are documented in the
  contract header: owner can `withdraw` collected USDC and `setPrices`
  (holder price must stay below full price). Owner **cannot** change the
  USDC/Agent ID addresses, grant access without payment, move user funds, or
  pause purchases. No fee, tax, mint, or blacklist.
- No "Binance"/"BNB" brand impersonation: the project is named StockSage;
  "BNB Chain (BSC)" is used only as the factual chain name.
- No promised returns: the product sells research notes, not investment
  advice. Every surface (contract header, server catalog, landing page)
  carries: *"Research only, not investment advice; prices can go down as well
  as up; do your own research."*
- Agent ID is not packaged as a wallet-lookup tool: the contract checks only
  the caller's own balance, only for pricing.

## What was proven (fork, 20 Nov 2026)

- Foundry tests: **17/17 passed** on the BSC fork
  (`contracts/test/StockSageAccess.t.sol`): holder discount, full price,
  revert on insufficient allowance/balance, 24h expiry (true at +86399s,
  false at +86400s), `priceFor`, only-owner withdraw/setPrices, ticker
  validation, second purchase refreshes the window.
- End-to-end (`e2e/run-e2e.sh`, log `e2e/E2E-LOG.md`): **E2E PASS**.
  Holder (Suci's Agentic wallet address, pranked on the fork): 402 → purchase
  0.05 USDC (tx `0xef0c55e8…`, 102,000 gas) → report served (Gemini 2.5
  Flash, Yahoo live). Fresh buyer via `client-bnb.js`: quote 0.10 → approve
  exact → purchase → report saved to `server/demo/last-report-bnb-AAPL.md`.
  Contract balance after both: 0.15 USDC.
- Two fork-infrastructure findings, both documented in `e2e/run-e2e.sh`:
  1. `bsc.publicnode.com` blocks the archive calls Anvil needs for a fork
     deploy (403, personal token required) — the fork uses
     `bsc-mainnet.public.blastapi.io` instead (historical state allowed).
  2. On an unpinned Anvil fork, `eth_getTransactionCount` can briefly return
     a stale nonce for a locally-created account right after its first mined
     tx (observed twice as `NONCE_EXPIRED` on purchase). Fixed two ways:
     the e2e pins the fork block, and `client-bnb.js` tracks the nonce
     explicitly with a one-time retry on `NONCE_EXPIRED`.

## Honest limitations (read before submitting)

1. **The 30-address bar is NOT solved.** The Innovation Award requires a live
   product **plus at least 30 Agent ID addresses interacting** during the
   submission period. This port makes the project *submittable*; it does not
   create users. Winning needs 30 real Agent ID holders to buy a report
   before 9 Dec 2026 16:00 WITA — that is a distribution problem, not a
   build problem, and faking it (mass registration, wash volume) means
   disqualification. The Project Awards (top 10 by on-chain metrics) have no
   stated 30-address floor, but ranking there also needs real traction.
2. **Not deployed, not verified, not submitted.** The contract address in the
   submission form is TBD until Suci deploys + verifies on BscScan
   (DEPLOY.md). The repo also needs to be public on GitHub (the port lives
   locally under `~/workspace/tools/stocks-maxxing/bnb-port/`; push it to
   `Sucimaru/stocksage` or a new public repo).
3. **Revenue is tiny at this price.** 0.05–0.10 USDC per report; the prize is
   the point, not the sales. On-chain volume will look small to judges unless
   many people buy.
4. **Yahoo Finance is unofficial and rate-limited**; the server falls back to
   clearly-labeled sample data if Yahoo is unreachable (same as Base).
5. **Gemini free tier ~20 req/day**; reports are cached per ticker+day, so
   one report per ticker per day costs one LLM call.
