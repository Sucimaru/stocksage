[10:21:31] # StockSage BNB port — end-to-end proof (Anvil fork of BSC)
[10:21:31] Date: 2026-11-20T10:21:31Z | Fork: https://bsc-mainnet.public.blastapi.io | Local RPC: http://127.0.0.1:8545
[10:21:31] 
[10:21:32] Pinning fork at BSC block 134678337
[10:21:50] Anvil fork up, block 134678337, chain 56
[10:21:51] Funded deployer + holder with fork BNB (anvil_setBalance)
[10:21:51] ## 2. Deploy StockSageAccess on fork

blockHash            0x54f0e0a506e42276d25f6172b7ce59bffeb782e28c0aeaf708f96c3d32b8f676
blockNumber          134678338
contractAddress      0xAe66761DA292774868326fA9e5b6Eb10Dea2d931
cumulativeGasUsed    826404
effectiveGasPrice    50000000
from                 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
gasUsed              826404
logs                 [{"address":"0xae66761da292774868326fa9e5b6eb10dea2d931","topics":["0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266"],"data":"0x","blockHash":"0x54f0e0a506e42276d25f6172b7ce59bffeb782e28c0aeaf708f96c3d32b8f676","blockNumber":"0x8070742","blockTimestamp":"0x6b001f40","transactionHash":"0x58cb6b64cbfec0e5318b13d92b47ba8f035fed77514ea0843083fa72a280b42b","transactionIndex":"0x0","logIndex":"0x0","removed":false}]
logsBloom            0x00000000004000000000000000000000000000000000000000800000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000002000000000000020000000000000100000800000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000002000000000000000000020000000000000000000000000000000000000000000000000000000000000000000
root                 
status               1 (success)
transactionHash      0x58cb6b64cbfec0e5318b13d92b47ba8f035fed77514ea0843083fa72a280b42b
transactionIndex     0
type                 2
blobGasPrice         
blobGasUsed          
[10:21:52] Deployed at: 0xae66761da292774868326fa9e5b6eb10dea2d931
[10:21:52] Deploy tx: 0x58cb6b64cbfec0e5318b13d92b47ba8f035fed77514ea0843083fa72a280b42b | gas used: 826404
[10:21:52] ## 3. Fund buyers with fork USDC (whale impersonation)
[10:21:52] Fresh throwaway buyer (non-holder): 0xA094cCc86C2C2654Df0a19e12984873B20Cac378 (key in memory only, never logged)
[10:21:54] Holder USDC: 10000000000000000000 [1e19]
[10:21:54] Fresh buyer USDC: 10000000000000000000 [1e19]
[10:21:54] ## 4. Start adapted server (fork RPC, deployed access contract)
{
  "ok": true,
  "network": "BNB Chain (BSC)",
  "chainId": 56,
  "rpcUrl": "http://127.0.0.1:8545",
  "checks": {
    "blockNumber": 134678340,
    "usdc": {
      "address": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      "name": "USD Coin",
      "symbol": "USDC",
      "decimals": 18,
      "eip3002": false,
      "note": "Binance-Peg USDC — no EIP-3002 support by design"
    },
    "agentId": {
      "address": "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
      "name": "SPACE ID Agent ID"
    },
    "accessContract": {
      "address": "0xae66761da292774868326fa9e5b6eb10dea2d931",
      "fullPriceUsdc": "0.1",
      "holderPriceUsdc": "0.05",
      "accessWindowSeconds": 86400
    }
  }
}[10:21:57] ## 5. Quotes
[10:21:58] Holder /quote: {
  "ticker": "AAPL",
  "buyer": "0x40e589CaEa11d8C9D177060f005a2E9CfF8577eD",
  "priceBaseUnits": "50000000000000000",
  "priceUsdc": "0.05",
  "isAgentIdHolder": true,
  "priceTier": "holder",
  "hasAccess": false,
  "accessWindowSeconds": 86400,
  "accessContract": "0xae66761da292774868326fa9e5b6eb10dea2d931",
  "usdc": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  "chainId": 56,
  "chainName": "BNB Chain (BSC)"
}
[10:21:58] Fresh /quote: {
  "ticker": "AAPL",
  "buyer": "0xA094cCc86C2C2654Df0a19e12984873B20Cac378",
  "priceBaseUnits": "100000000000000000",
  "priceUsdc": "0.1",
  "isAgentIdHolder": false,
  "priceTier": "full",
  "hasAccess": false,
  "accessWindowSeconds": 86400,
  "accessContract": "0xae66761da292774868326fa9e5b6eb10dea2d931",
  "usdc": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  "chainId": 56,
  "chainName": "BNB Chain (BSC)"
}
[10:21:58] ## 6. Holder path (0x40e5..., Agent ID holder)
[10:21:58] GET /research before purchase: HTTP 402
[10:21:59] Holder purchase tx: 0xef0c55e8798ff7bd5295259fbc392a6b591547df8a241749da04ef856d9481d6 (gas used: 102000)
[10:21:59] Holder hasAccess: true
{
  "report": {
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "asOf": "2026-11-19T21:00:01.000Z",
    "source": "yahoo-finance-live",
    "engine": "gemini-2.5-flash",
    "fromCache": true,
    "text": "## Apple Inc. (AAPL) - Research Note\n\n**Stance: Neutral.** Despite recent price weakness, AAPL's premium valuation and position near its 52-week high suggest a balanced outlook awaiting clearer fundamental catalysts.\n\n**Key Drivers:**\n*   **Persistent Brand Strength & Ecosystem:** Apple's robust brand loyalty and deeply integrated ecosystem continue to drive premium pricing power and strong customer retention across its product and services offerings.\n*   **Innovation Expectations:** Investor sentiment remains tied to the company's long-standing ability to innovate and deliver compelling new products and services, creating anticipation for future growth vectors.\n*   **Scale and Financial Strength:** As a global technology leader, Apple maintains significant financial resources for strategic investments in R&D and market expansion, underpinning long-term stability.\n\n**Risks:**\n*   **Short-Term Momentum Headwinds:** The stock has experienced a recent pullback, down 1.6% today and 1.98% over the past five days, potentially signaling continued near-term pressure without fresh positive news.\n*   **Valuation Sensitivity:** Trading 3.2% below its 52-week high ($360.83) suggests the market has largely priced in current growth prospects. Any perceived slowdown in innoholder report engine: gemini-2.5-flash | source: yahoo-finance-live | payment: {'verified': True, 'buyer': '0x40e589CaEa11d8C9D177060f005a2E9CfF8577eD', 'priceBaseUnits': '50000000000000000', 'priceUsdc': '0.05', 'priceTier': 'holder', 'isAgentIdHolder': True, 'accessContract': '0xae66761da292774868326fa9e5b6eb10dea2d931', 'accessWindowSeconds': 86400}
[10:22:00] ## 7. Fresh buyer path via client-bnb.js
[10:22:02] client-bnb.js exit code: 0
[client] quote: 0.1 USDC (full), hasAccess=false
[client] approve confirmed: 0x7efde137e8370e6ccd7ed99e75d91e2c64ea785749b79f580192e2cd142d6e34 — https://bscscan.com/tx/0x7efde137e8370e6ccd7ed99e75d91e2c64ea785749b79f580192e2cd142d6e34 (block 134678343)
[client] purchase confirmed: 0xc76aeabfff131fac011201322139ce524fce7b76fc59b026b107ede9fc0d2d19 — https://bscscan.com/tx/0xc76aeabfff131fac011201322139ce524fce7b76fc59b026b107ede9fc0d2d19 (block 134678344)
[client] payment verified on-chain: tier full, 0.1 USDC, holder=false
[client] report engine: gemini-2.5-flash (cached: true)
[client] report saved to /home/hatch/workspace/tools/stocks-maxxing/bnb-port/server/demo/last-report-bnb-AAPL.md
[10:22:02] Fresh buyer hasAccess: true
[10:22:02] Access contract USDC balance (expect 0.15 USDC = 150000000000000000): 150000000000000000 [1.5e17]
[10:22:02] Saved report: /home/hatch/workspace/tools/stocks-maxxing/bnb-port/e2e/../server/demo/last-report-bnb-AAPL.md (1963 bytes)
# AAPL research report (BNB Chain)

## Apple Inc. (AAPL) - Research Note

**Stance: Neutral.** Despite recent price weakness, AAPL's premium valuation and position near its 52-week high suggest a balanced outlook awaiting clearer fundamental catalysts.

**Key Drivers:**
*   **Persistent Brand Strength & Ecosystem:** Apple's robust brand loyalty and deeply integrated ecosystem continue to drive premium pricing power and strong customer retention across its product and services offerings.
*   **Innovation Expectations:** Investor sentiment remains tied to the company's long-standing ability to innovate and deliver compelling new products and services, creating anticipation for future growth vectors.
*   **Scale and Financial Strength:** As a global technology leader, Apple maintains significant financial resources for strategic investments in R&D and market expansion, underpinning long-term stability.

**Risks:**
*   **Short-Term Momentum Headwinds:** The stock has experienced a recent pullback, down 1.6% today and 1.98% over the past five days, potentially signaling continued near-term pressure without fresh positive news.
*   **Valuation Sensitivity:** Trading 3.2% below its 52-week high ($360.83) suggests the market has largely priced in current growth prospects. Any perceived slowdown in innovation or market expansion could lead to valuation adjustments.

**What to Watch Next:**
*   Any future announcements regarding new product categories, significant service expansions, or market entry strategies.
*   Broader market sentiment and risk appetite for large-cap technology stocks, particularly given the stock's volume is near its 5-day average.

---
[10:22:02] 
[10:22:02] ## RESULT
[10:22:02] E2E PASS: holder (0.05 USDC) + fresh buyer (0.10 USDC) both bought and received reports on the fork.
[10:22:02] Deploy gas (fork): 826404 | Contract: 0xae66761da292774868326fa9e5b6eb10dea2d931
