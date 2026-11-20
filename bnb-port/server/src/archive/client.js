// ============================================================================
// ARCHIVED — DO NOT USE ON BNB CHAIN.
// Old demo buyer for the Base Sepolia x402 flow: it signed an EIP-3002
// transferWithAuthorization and sent it as an X-PAYMENT header.
// Binance-Peg USDC on BSC does NOT support EIP-3002 (no version(),
// no DOMAIN_SEPARATOR(), no nonces(), no transferWithAuthorization),
// verified on-chain 20 Nov 2026 — so this client cannot pay on BSC.
// The BSC demo buyer is ../client-bnb.js: GET /quote -> approve EXACT
// USDC -> purchase(ticker) -> GET /research. Nothing live imports this file.
// ============================================================================

// Demo buyer: requests a research report, handles the 402, signs an
// EIP-3002 payment authorization with the throwaway demo buyer wallet,
// sends it as X-PAYMENT, and saves the report.
// Usage: node src/client.js [TICKER]   (server must be running; default AAPL)
// Requires the buyer wallet funded with test USDC (see README / faucet steps).
// Env: PORT (default 8787), SELLER_ADDRESS optional (must match server).
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { buildAuthorization, USDC_ABI } from './x402.js';
import { getBuyerWallet } from './wallets.js';

const ticker = (process.argv[2] || 'AAPL').toUpperCase();
const port = Number(process.env.PORT || 8787);
const base = `http://127.0.0.1:${port}`;
const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
const { wallet: buyer, created } = getBuyerWallet();
if (created) console.log(`[client] new throwaway buyer wallet: ${buyer.address}`);
const buyerSigner = buyer.connect(provider);

async function main() {
  console.log(`[client] buyer: ${buyer.address}`);
  console.log(`[client] requesting research for ${ticker} ...`);
  const first = await fetch(`${base}/research?ticker=${ticker}`);
  if (first.status !== 402) {
    console.log(`[client] unexpected status ${first.status}: ${await first.text()}`);
    process.exit(1);
  }
  const body402 = await first.json();
  const req = body402.accepts?.[0];
  console.log(`[client] got 402: pay ${req.amount} base units USDC (${Number(req.amount) / 1e6} USDC) to ${req.payTo} on ${req.network}`);
  const usdc = new ethers.Contract(CONFIG.usdcAddress, USDC_ABI, provider);
  const balance = await usdc.balanceOf(buyer.address);
  console.log(`[client] buyer USDC balance: ${ethers.formatUnits(balance, 6)} USDC`);
  if (balance < BigInt(req.amount)) {
    console.log(`[client] INSUFFICIENT test USDC. Fund the buyer first:`);
    console.log(`[client]   1. Open https://faucet.circle.com in a browser`);
    console.log(`[client]   2. Select USDC + Base Sepolia, paste ${buyer.address}`);
    console.log(`[client]   3. Complete the reCAPTCHA — you get 20 test USDC (1 request / 2h).`);
    console.log(`[client]   (Also fund the SELLER wallet with a little Base Sepolia test ETH for on-chain settlement — see README.)`);
    process.exit(2);
  }
  const now = Math.floor(Date.now() / 1000);
  const auth = {
    from: buyer.address,
    to: req.payTo,
    value: req.amount,
    validAfter: now - 60,
    validBefore: now + 3600,
    nonce: ethers.hexlify(ethers.randomBytes(32)),
  };
  const { domain, types, value } = buildAuthorization(auth);
  const signature = await buyerSigner.signTypedData(domain, types, value);
  console.log(`[client] signed EIP-3002 authorization (nonce ${auth.nonce.slice(0, 10)}...)`);
  const payment = Buffer.from(JSON.stringify({
    x402Version: 1, scheme: 'exact', network: req.network,
    payload: { signature, authorization: auth },
  })).toString('base64');
  const paid = await fetch(`${base}/research?ticker=${ticker}`, { headers: { 'X-PAYMENT': payment } });
  const result = await paid.json();
  console.log(`[client] server replied HTTP ${paid.status}`);
  if (paid.status !== 200) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(`[client] payment verified: ${result.payment.verified}; settlement: ${result.payment.settlement.status}${result.payment.settlement.txHash ? ` tx ${result.payment.settlement.txHash}` : ''}`);
  console.log(`[client] report engine: ${result.report.engine} (cached: ${result.report.fromCache})`);
  const outFile = path.join(process.cwd(), 'demo', `last-report-${ticker}.md`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const settlement = result.payment.settlement;
  // Explorer link only for real Base Sepolia (chain 84532). Local anvil runs
  // have no explorer — a sepolia.basescan.org link there would be a dead link.
  const settlementLine = settlement.txHash
    ? (CONFIG.chainId === 84532
      ? ` — https://sepolia.basescan.org/tx/${settlement.txHash}`
      : ` — local tx ${settlement.txHash} (anvil, no explorer link)`)
    : '';
  fs.writeFileSync(outFile, `# ${ticker} research report\n\n${result.report.text}\n\n---\n\n- Source: ${result.report.source}\n- Engine: ${result.report.engine}\n- Price: ${result.quote.price} ${result.quote.currency} (change ${result.quote.changePct}%, 5d ${result.quote.fiveDayChangePct}%)\n- Settlement: ${settlement.status}${settlementLine}\n`);
  console.log(`[client] report saved to ${outFile}`);
  console.log('--- report ---');
  console.log(result.report.text);
}

main().catch((e) => { console.error('[client] error:', e.message); process.exit(1); });
