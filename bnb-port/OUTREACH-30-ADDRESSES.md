# StockSage on BNB — Plan to reach 30 Agent ID addresses

**Status 20 Nov 2026:** prep only. Product NOT live yet (deploy pending Suci's
decision on the deployer wallet). Do NOT post anything until the contract is
deployed + verified and the server is live on BSC mainnet — outreach must point
at a working product, never at a promise.

## Why this is the hard part

- Innovation Award needs a live product + **min 30 Agent ID addresses** that
  interacted with the contract(s) during the Submission Period (ends 9 Dec 2026
  16:00 WITA). Project Awards rank by on-chain metrics (interacting Agent ID
  addresses, volume, tx count) — same dependency.
- Fake interactions = disqualification (hackathon rules explicitly ban mass
  account registration and volume manipulation). Only real Agent ID holders,
  each buying at least one report, count.
- The discount IS the incentive: holders pay 0.05 USDC vs 0.10 for non-holders.

## Channels (Suci's phone work — X steps are his)

1. **Suci's own X (@sucimaru_)** — main post (draft below) + a follow-up once
   the first buyers exist (social proof: "N holders already bought").
2. **Replies to Binance Wallet / Agent ID posts** — short reply pointing at the
   live product, only where on-topic (no spam).
3. **Agent ID holder communities** — Binance Wallet community spaces, BNB Chain
   community posts, StockSage demo post. No paid promotion (no budget).
4. **The hackathon Community Promotion post itself** ($100 track, hashtags
   #BinanceWalletHackathon + #AgenticWallet, survey on app.binance.com) — the
   same post can serve both: it promotes a participating project AND invites
   Agent ID holders to try StockSage. One post, two purposes.

## Draft X post (English, post AFTER deploy — fill in placeholders)

> StockSage is live on BNB Chain — AI stock research, built for Agent ID.
>
> Hold an Agent ID? You pay 0.05 USDC per report (half price). Anyone else: 0.10.
> Buy on-chain, get the analyst report instantly.
>
> Live: <LANDING_URL>
> Contract: <DEPLOYED_ADDRESS> (verified on BscScan)
>
> #BinanceWalletHackathon #AgenticWallet

Keep it factual: no promised returns, no "passive income", include the risk
warning on the landing page (already there).

## What counts

- One interacting address = one Agent ID holder address that called
  `purchase(ticker)` on StockSageAccess (on-chain event `ResearchPurchased`).
- Track with: `cast logs` / BscScan event query on the deployed contract, or a
  small script counting distinct `buyer` where `agentIdHolder == true`.
- Target: 30 holders before 9 Dec 16:00 WITA. Check count daily once live.

## If traction stalls

- Honest fallback: the project is still submittable (contract live + verified +
  open-source + real Agent ID integration), but it will not win either award
  without the 30 addresses. The X-post Community Promotion ($100) stays the
  realistic prize. Do NOT manufacture interactions.
