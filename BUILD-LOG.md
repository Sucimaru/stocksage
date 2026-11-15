# BUILD-LOG — Stocks Maxxing Agentic entry

## What was built (15 Nov 2026, ~21:47–22:05 WITA)

Repo: `~/workspace/tools/stocks-maxxing/agent/` (Node.js, ethers v6, no other deps).

- **Research agent** (`src/stocks.js`): live quotes via Yahoo Finance v8 chart API
  (free, no key) — price, day/5-day change, 52-week range, volume + quantitative
  analysis. Fallback: clearly-labeled sample data (`src/sample-data.js`) if Yahoo
  is unreachable. Stooq was tested and returns EMPTY from this VM — not used.
- **LLM writer** (`src/llm.js`): Gemini 2.5 Flash via the connected helper CLI
  (`custom.google-gemini/bin/generate_content.py`) — no API key in code/env/logs
  (Secure Vault surrogate mechanism). OpenRouter free-tier fallback; template
  fallback if no LLM. Per-ticker+day cache (`data/cache/`) — Gemini free tier
  is ~20 req/day. Xingchi is NOT used (provider now blocks script clients, 403).
- **x402 payments** (`src/x402.js`, `src/settle.js`): server answers 402 with
  payment requirements (scheme exact, network base-sepolia, asset = Circle USDC,
  amount 100000 base units = 0.10 USDC, payTo = seller). Buyer signs an EIP-3002
  `transferWithAuthorization`, sends it as `X-PAYMENT`; server verifies the EIP-712
  signature, payee/amount, validity window, and on-chain USDC balance, then
  settles on-chain via `transferWithAuthorization` when the seller holds test ETH.
- **Server** (`src/server.js`): `GET /` (catalog), `/research?ticker=` (402 or
  report), `/portfolio` (earnings ledger), `/health` (chain + seller balances).
- **Buyer** (`src/client.js`): 402 → sign → X-PAYMENT → report, saved to
  `demo/last-report-<TICKER>.md`.
- **Profit ledger** (`src/portfolio.js`): every sale recorded (`data/sales.jsonl`);
  earnings allocated AAPL 40 / NVDA 25 / TSLA 20 / MSFT 15 (paper ledger — see limits).
- **Wallets** (`src/wallets.js`): throwaway demo wallets, Base Sepolia testnet only.
  Buyer `0x9FC34a466B5CB61f0BF8219Dd24B0C516B69B9D9`, seller
  `0xDd1c7EB50e3a3232BB449cA894B85d7c7D459a25`. Never Suci's wallets.
- **Docs:** README.md, DEMO.md (video script), this log. `.env.example` (no secrets).

## On-chain facts verified 15 Nov 2026

- Base Sepolia chain ID 84532 (`sepolia.base.org` + `base-sepolia-rpc.publicnode.com`).
- Circle USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
  (name USDC, symbol USDC, decimals 6, EIP-3002 version "2", totalSupply ~89.3B units).
  NOTE: an earlier recalled address (`...E5F7E33d5`) has NO code on this chain — wrong.
- Circle faucet: 20 test USDC per address per chain every 2h, no account, reCAPTCHA
  required (browser step — cannot be claimed by curl).

## Tests run (all on Base Sepolia testnet / local)

| Test | Result |
|---|---|
| Server smoke: `/`, `/health`, `/portfolio` | PASS — catalog, block 59143871, empty ledger |
| `GET /research` without payment | PASS — HTTP 402 with correct x402 requirements |
| Yahoo Finance live quote (AAPL) | PASS — price $356.27, +4.06% day, +1.59% 5d (live) |
| Gemini report generation (AAPL) | PASS — clean markdown report, engine gemini-2.5-flash (2 calls used; cached after) |
| Signed payment, buyer balance 0 | PASS — HTTP 402 `insufficient USDC balance (0 < 100000)` |
| Tampered authorization (value changed after signing) | PASS — HTTP 402 `signature does not match authorization from-address` |
| Full paid flow (402 → sign → verify → settle → report) | **PASS — local chain (mock USDC)** — see "End-to-end (local chain)" below |
| On-chain settlement tx | **PASS — local chain** `0x6dc55ac8472db82ce4486e96a66a69b18b983b8f9855a8fa4c38bbb051fcc365` (status 1, block 4; Transfer 100000 base units buyer→seller) |
| Buyer/seller balances after settlement | PASS — buyer 99.90 mock USDC, seller 0.10 mock USDC |
| Portfolio ledger after settlement | PASS — 1 sale, 0.10 USDC; allocations AAPL 0.04 / NVDA 0.025 / TSLA 0.02 / MSFT 0.015 |

## End-to-end (local chain) — 15 Nov 2026 ~22:05 WITA

Full paid flow proven with the REAL code path (server + client + settle.js +
real EIP-3002 signatures), only the chain/token swapped for a local mock:

- Local chain: anvil (default chain 31337), PID 6905 at test time.
  `CHAIN_ID=31337` env override added to `src/config.js` for this purpose;
  default stays 84532 (Base Sepolia). Mock USDC (`contracts/MockUSDC.sol`,
  OpenZeppelin ERC20 + EIP-712 "USDC" v2 + `transferWithAuthorization`,
  replay-protected) deployed at
  `0x5FbDB2315678afecb367f032d93F642f64180aa3`
  (deploy tx `0x2d5aab7dcb790f91c7019b37d241faf4bcb142a6dfbbac8aa22a639330b67561`).
- Funding on local chain: buyer minted 100 mock USDC
  (tx `0x17712cfcb5c35b33cc3fe035e6f3c920908b8568a3975cc90c3684620b391f63`),
  seller sent 0.05 ETH
  (tx `0xc0cb501cdd3555fc6b7b40eb670f5db08b52eabc5d1e17f50d6412ea99274118`).
- Run: server `PORT=8787 RPC_URL=http://127.0.0.1:8545 CHAIN_ID=31337
  USDC_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 node src/server.js`
  → client `node src/client.js AAPL` → 402 → signed authorization
  (nonce `0x3c2a13ea...`) → HTTP 200 → **settlement tx
  `0x6dc55ac8472db82ce4486e96a66a69b18b983b8f9855a8fa4c38bbb051fcc365`**
  (status 1, block 4, `Transfer` log 100000 base units = 0.10 USDC
  buyer → seller) → Gemini report delivered, saved to
  `demo/last-report-AAPL.md` (engine gemini-2.5-flash, cached).
- Sales ledger: `data/sales.jsonl` (1 sale); `GET /portfolio` shows the
  sale + allocations. The local anvil + server were stopped after the test;
  restart with the commands above to re-run (re-deploy mock + re-mint first,
  anvil state is ephemeral).

Why a local chain instead of real Base Sepolia: faucet probing (child
subagent B, read-only curl, full report in its session) found **no
curl-friendly faucet for Base Sepolia ETH or test USDC** — Circle faucet
needs reCAPTCHA v2 in the browser; Chainlink needs browser + wallet
connect; Alchemy/Coinbase CDP need an account; pk910 is Ethereum Sepolia
only + PoW mining. So real-testnet funding is a one-time manual browser
step (see "Still needed"). The local test proves every other link of the
chain; on real Base Sepolia the only changes are env defaults
(`RPC_URL=https://sepolia.base.org`, real USDC
`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, chain 84532) — no code change.

Anvil gotchas hit during this test (recorded so they are not re-hit):
- `anvil --fork-url https://sepolia.base.org --chain-id 84532`: deploys fail
  with "Out of gas / Insufficient funds" — forked OP-stack fee estimation
  misbehaves. Plain anvil (no fork) works; the fork is unnecessary here
  because the mock replaces the real USDC.
- Anvil account #0 private key ends `...d7bf4f2ff80` (NOT `...f3ff80` —
  a one-character typo in the key derives a different address with 0
  balance and every tx fails "Insufficient funds"). Always copy the key
  from the anvil startup log, never from memory.

## Still needed (funding — browser steps, not doable from the VM)

1. **Buyer test USDC:** Circle faucet https://faucet.circle.com (USDC + Base Sepolia,
   address `0x9FC34a466B5CB61f0BF8219Dd24B0C516B69B9D9`, reCAPTCHA). 20 USDC.
2. **Seller test ETH:** Base Sepolia ETH faucet for
   `0xDd1c7EB50e3a3232BB449cA894B85d7c7D459a25` (settlement gas; tiny amount).
   Faucet options probed (read-only curl, 15 Nov): Chainlink
   `faucets.chain.link/base-sepolia` (browser + wallet connect), Alchemy
   `alchemy.com/faucets/base-sepolia` (needs Alchemy account), Coinbase CDP
   portal (needs CDP account). No curl path exists for any of them.
3. After funding: run `bash demo/run-demo.sh` → expect settlement tx hash on
   https://sepolia.basescan.org. Then update this log with the tx hash.
   (The same flow already passed end-to-end on the local chain — see above.)

## Known limitations (honest)

- Profit allocation to tokenized stocks is a **paper ledger**, not an on-chain swap
  (no Base Sepolia DEX pool for tokenized equities exists today; BaseStonk/Bankr
  tokenized stocks are mainnet).
- The x402 mechanism detail from @Ikhwanhsn's post is our design; the official page
  only lists the idea title "Sell stock research as a service".
- Judging criteria + per-track winner counts were not published on official pages.
- Gemini quota ~20 req/day (flash); reports cached per ticker+day to stay under it.
- No submission has been made (Google Form + X post are Suci's part, not built here).

## Demo Base Sepolia ASLI — 15 Nov 2026 ~22:05 WITA (setelah funding Suci)
- Funding terverifikasi on-chain: buyer 20 USDC (0x9FC3...B9D9), seller 0.1 ETH (0xDd1c...5925).
- `bash demo/run-demo.sh` → 402 → sign → settlement tx 0x5659d68341233755339619c02ed52ac8bfd3991310c2cdebcf9a922e32f8524b, status 1, blok 59148395. Transfer 0.10 USDC buyer → seller terverifikasi (buyer 19.90, seller 0.10).
- Link basescan di src/client.js DIPERBAIKI: hanya render bila chainId 84532; tx lokal anvil tidak lagi dapat link palsu.
- Ledger dibersihkan: penjualan anvil (tx 0x6dc55..., blok 4) dihapus dari data/sales.jsonl — portfolio kini hanya menampilkan penjualan Sepolia asli (1 sale, 0.10 USDC).
- Siap direkam untuk video demo (ikuti DEMO.md). Sisa: video + post X + Google Form (Suci).
