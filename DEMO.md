# DEMO.md — Demo video script (for Suci to record)

**Goal:** show the full loop — request research → pay test USDC via x402 → receive the
report → profits go to tokenized stocks. Everything on **Base Sepolia testnet**, no real money.
Target length: ~2–3 minutes. Record terminal + browser (Basescan) side by side if possible.

## Before recording (one-time, ~5 min)

1. Fund the demo buyer with test USDC (browser):
   - Open https://faucet.circle.com → select **USDC + Base Sepolia**.
   - Paste buyer address `0x9FC34a466B5CB61f0BF8219Dd24B0C516B69B9D9` → complete reCAPTCHA.
   - You get 20 test USDC. (If it says "try again in 2h", the address already claimed recently.)
2. Fund the demo seller with a little Base Sepolia test ETH (for settlement gas):
   - Seller address `0xDd1c7EB50e3a3232BB449cA894B85d7c7D459a25`.
   - Use a Base Sepolia ETH faucet (see README.md / BUILD-LOG.md for the verified list).
   - Only a tiny amount is needed (one settlement tx).
3. Check balances:
   ```bash
   cd ~/workspace/tools/stocks-maxxing/agent
   npm start
   curl -s http://127.0.0.1:8787/health
   ```
   Expect `sellerUsdc: "0.0"` (seller starts empty) and `sellerEth` > 0.
   Stop the server (Ctrl+C).

## Recording — step by step

**Step 1 — Start the agent (10s).**
```bash
cd ~/workspace/tools/stocks-maxxing/agent
npm start
```
Say: "This is the research agent. It sells stock research for test USDC on Base Sepolia."

**Step 2 — Show the catalog (15s).**
```bash
curl -s http://127.0.0.1:8787/ | head -30
```
Point at: price 0.10 USDC, the 10-stock universe, payTo = seller address.

**Step 3 — Request without paying: get a 402 (20s).**
```bash
curl -s http://127.0.0.1:8787/research?ticker=AAPL
```
Say: "No payment, no report — the server answers 402 Payment Required with the x402
payment details: 0.10 USDC, Base Sepolia, the USDC contract, and the seller address."

**Step 4 — Buy the report (30s).**
```bash
npm run buy
# (or: node src/client.js AAPL)
```
Narrate: the buyer sees the 402, signs an EIP-3002 payment authorization, sends it as
`X-PAYMENT`, the server verifies the signature and the buyer's USDC balance on-chain,
settles the payment, and returns the report. The report is saved to
`demo/last-report-AAPL.md`. If settlement ran, copy the tx hash and open it on
https://sepolia.basescan.org/tx/<hash> to show the real USDC transfer on Base Sepolia.

**Step 5 — Show the report (20s).**
```bash
cat demo/last-report-AAPL.md
```
Point at: live price + change, the stance (Bullish/Neutral/Bearish), key drivers, risks.

**Step 6 — Show profits going to tokenized stocks (20s).**
```bash
curl -s http://127.0.0.1:8787/portfolio
```
Say: "Every sale is recorded, and the 0.10 USDC is allocated to tokenized stocks —
40% AAPL, 25% NVDA, 20% TSLA, 15% MSFT. The ledger is on-chain-verifiable per sale;
the swap to real tokenized equities is wired in once a Base Sepolia pool exists."

**Step 7 — Close (10s).**
Say: "Free to try, testnet only — build an agent, sell research, profits go to
tokenized stocks. Stocks Maxxing, Agentic Stock Finance track."

## If something fails on camera

- `INSUFFICIENT test USDC` → the buyer needs the Circle faucet step (step 1 above).
- `settlement: pending` → the seller has no test ETH; the payment was still verified
  and the report still delivered — say so honestly, then fund the seller and re-run.
- Report shows `SAMPLE-DATA` → Yahoo Finance was unreachable; the numbers are labeled
  examples, not live. Re-run when the network is back, or say so on camera.
- LLM fallback (`template-fallback`) → Gemini quota (20/day) was hit; the report is
  quant-only. Wait for the quota reset or use the cached report from `data/cache/`.

## After recording

- Post the video on X, tag @buildonbase, explain the project in the post.
- Submit the Google Form on base.org/stocksmaxxing (link to the X post + Agentic track).
- Do NOT include any private key or API key in the video (none are in this repo).
