# Agent ID Hackathon — Submission Draft (English, ready to paste)

**Status: READY — contract deployed + verified 20 Nov 2026.** StockSageAccess
`0xc6cf59c62b7c4d24DaFB221Ce642D0a1EF783bf6` on BSC mainnet (deploy tx
`0xd578a68899232ec87a770fd9e726b1a29d4200390af4a6d95c800503df7ca44a`, block
134680219). BscScan: "Source Code Verified", Exact Match (Sourcify
exact_match). First live holder purchase done 20 Nov 18:41 WITA: 0.05 USDC,
tx `0xb7a4f8c5900c5ff02d990601ffceac3dbe991ab0e08ea916ada71fc967740005`,
report served via `/research`. Fill the form and submit before **9 Dec 2026
16:00 WITA** (08:00 UTC).

---

## Project name

**StockSage on BNB Chain** — AI stock research, sold on-chain with Agent ID pricing

## Website

https://github.com/Sucimaru/stocksage
(BNB port: `bnb-port/` — contract, adapted server, design doc. If the port is
pushed to its own repo, replace this link with that repo's URL.)

## Contract address(es) — BNB Chain (chain 56)

- StockSageAccess: `0xc6cf59c62b7c4d24DaFB221Ce642D0a1EF783bf6`
  (verified on BscScan; source: `contracts/src/StockSageAccess.sol`)
- Payment token (Binance-Peg USDC, 18 decimals):
  `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`
- Agent ID (SPACE ID, ERC-721): `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`

## Short description

StockSage is an AI research agent that sells stock research reports. On BNB
Chain, every report is bought on-chain: the buyer pays USDC to the
`StockSageAccess` contract, the purchase is recorded on-chain, and the server
only serves the report after verifying the purchase. Reports combine live
market data (Yahoo Finance) with an analyst note written by Gemini 2.5 Flash
(cached per ticker per day). Universe: AAPL, NVDA, TSLA, MSFT, AMZN, GOOGL,
META, AMD, NFLX, PLTR.

## How Agent ID is used (the core of the product, not a badge)

Agent ID sets the price of the product itself. The contract quotes two prices
for the same report, decided by a read-only `balanceOf` check on the SPACE ID
Agent ID contract:

- **Agent ID holder: 0.05 USDC per report (50% off)**
- **Non-holder: 0.10 USDC per report (full price)**

Every purchase emits `ResearchPurchased(buyer, ticker, tickerHash, price,
agentIdHolder, timestamp)` and stores the purchase on-chain, so each sale is
a verifiable on-chain Agent ID interaction (address, transaction, volume,
holder flag). A purchase unlocks that ticker's report for 24 hours; the
server verifies access with an `eth_call` to `hasAccess()` before serving
anything. The contract only ever checks the caller's *own* Agent ID balance,
and only for pricing — it never looks up anyone else's wallet.

Payment uses plain ERC20 on purpose: Binance-Peg USDC on BSC does not
implement EIP-3002 (verified on-chain), so the buyer approves the *exact*
price and the contract pulls exactly that amount via `transferFrom`. No
unlimited approvals, no signed authorizations, no server-held sessions.

## Innovation / why this matters

- **Identity-priced commerce:** Agent ID becomes a loyalty tier enforced by
  a smart contract, not a marketing claim — the discount is computed and
  settled on-chain, and the holder flag is part of the permanent purchase
  record.
- **Pay-per-report research for agents:** any AI agent holding an Agent ID
  can buy research for itself at the holder price, machine-to-machine, with
  no account, no API key, and no off-chain payment rail.
- **Verifiable sales:** revenue, buyers, and holder share are all on-chain
  events, not dashboard claims.

## Owner permissions (documented)

The owner (deployer) can `withdraw` collected USDC and `setPrices` (holder
price must stay below full price). The owner cannot change the USDC/Agent ID
addresses, grant access without payment, move any user's funds, or pause
purchases. No fee, tax, mint, or blacklist. Full details in the contract
header and `DESIGN.md`.

## Risk warning

StockSage sells research notes, not investment advice. Stock prices can go
down as well as up; past performance does not guarantee future results.
Reports are informational only — do your own research before any trade.

## Reward receiving address

`0x6356077CcBaE6ba0CC3e47aD9bbB2330576234B3` (the deployer wallet — contract
owner and revenue receiver)
