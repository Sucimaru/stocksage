# StockSage on BNB Chain — Deploy

**Status 20 Nov 2026: DEPLOYED to BSC mainnet.** StockSageAccess
`0xc6cf59c62b7c4d24DaFB221Ce642D0a1EF783bf6` (deploy tx
`0xd578a68899232ec87a770fd9e726b1a29d4200390af4a6d95c800503df7ca44a`, block
134680219, gas 826,404 @ 0.05 gwei = 0.0000413 BNB). BscScan shows "Source
Code Verified", Exact Match (Sourcify exact_match). The commands below are
the record of how it was deployed (run by Babu on Suci's order, 20 Nov 2026).

## Preconditions

- Deployer wallet with a little BNB for gas (see cost table below). The
  deployer becomes the contract owner (receives sales revenue via `withdraw`,
  can `setPrices`). Use the wallet that should receive the revenue.
- Contract verification: done via Sourcify (exact match, no API key needed);
  BscScan displays it as "Source Code Verified" / Exact Match. A BscScan API
  key (free account) is only needed if you want the native Etherscan-style
  verification as well.
- This directory: `~/workspace/tools/stocks-maxxing/bnb-port/contracts/`
  (Foundry 1.9.0, solc 0.8.24, optimizer on, 200 runs). Before building:
  `npm install` in this directory (pins `@openzeppelin/contracts@5.6.1`,
  see `package.json`) and `git submodule update --init` (forge-std).

## Deploy (Suci runs this)

```bash
cd ~/workspace/tools/stocks-maxxing/bnb-port/contracts
export PRIVATE_KEY=<deployer key — never share it in chat>
# Dry run first (no broadcast) to preview:
~/.foundry/bin/forge script script/DeployStockSageAccess.s.sol:DeployStockSageAccess \
  --rpc-url https://bsc.publicnode.com
# Real deploy:
~/.foundry/bin/forge script script/DeployStockSageAccess.s.sol:DeployStockSageAccess \
  --rpc-url https://bsc.publicnode.com --broadcast --slow
```

Constructor args (already in the script): USDC
`0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`, Agent ID
`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`.

## Measured gas (BSC fork, 20 Nov 2026)

| Action | Gas (measured) | Cost at 1 gwei | Cost at 3 gwei | Cost at 5 gwei |
|---|---|---|---|---|
| Deploy `StockSageAccess` | **826,404** | 0.000826 BNB | 0.002479 BNB | 0.004132 BNB |
| `purchase(ticker)` | **~102,000** | 0.000102 BNB | 0.000306 BNB | 0.000510 BNB |
| `approve` (buyer, ERC20) | ~46,000 (typical, not measured) | 0.000046 BNB | 0.000138 BNB | 0.000230 BNB |

Fork evidence: deploy tx
`0x58cb6b64cbfec0e5318b13d92b47ba8f035fed77514ea0843083fa72a280b42b`
(826,404 gas, fork block 134678337, contract
`0xAe66761DA292774868326fA9e5b6Eb10Dea2d931`); holder purchase tx
`0xef0c55e8798ff7bd5295259fbc392a6b591547df8a241749da04ef856d9481d6`
(102,000 gas). Mainnet gas use should match closely (same bytecode and
constructor args) — confirm from the real receipt after broadcast.

## Verify on BscScan

```bash
export BSCSCAN_API_KEY=<key from bscscan.com>
~/.foundry/bin/forge verify-contract <DEPLOYED_ADDRESS> src/StockSageAccess.sol:StockSageAccess \
  --chain 56 --etherscan-api-key $BSCSCAN_API_KEY \
  --constructor-args $(~/.foundry/bin/cast abi-encode "constructor(address,address)" \
    0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d \
    0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F)
```

Or verify in the BscScan GUI ("Verify & Publish"): Solidity **0.8.24**,
optimizer **ON**, runs **200**, license **MIT**, paste the flattened source
(`forge flatten` if needed). Then check the "Read Contract" tab shows
`fullPrice` = 100000000000000000, `holderPrice` = 50000000000000000,
`usdc` = 0x8AC76a51…, `agentId` = 0x60B92624….

## After deploy (before submitting)

1. Write the deployed address into `server/src/config.js`
   (`ACCESS_CONTRACT_ADDRESS` env) and into the landing page.
2. Start the server against BSC mainnet RPC and smoke-test:
   `GET /quote?ticker=AAPL&buyer=<an Agent ID holder>` → price 0.05,
   `isAgentIdHolder: true`; `GET /health` → `ok: true`.
3. Buy one real report from Suci's own wallet (0.05 USDC + gas) as a live
   smoke test, then confirm `hasAccess` is true and the report is served.
4. Push this `bnb-port/` tree to a **public** GitHub repo (the existing
   `Sucimaru/stocksage` or a new repo) — the hackathon requires the code
   open-source + the contract verified on BscScan.
5. Fill the submission form with the deployed contract address + repo link
   (see SUBMISSION-DRAFT.md). Submission deadline: **9 Dec 2026 16:00 WITA**.
