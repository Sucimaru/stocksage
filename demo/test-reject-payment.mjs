// Test: server must REJECT a signed payment from a buyer with no USDC.
// Signs a real EIP-3002 authorization with the throwaway buyer wallet and
// sends it as X-PAYMENT. Expected: HTTP 402 with reason "insufficient USDC balance".
// Run while the server is up: node demo/test-reject-payment.mjs [TICKER]
import { ethers } from 'ethers';
import { CONFIG } from '../src/config.js';
import { buildAuthorization } from '../src/x402.js';
import { getBuyerWallet } from '../src/wallets.js';

const ticker = (process.argv[2] || 'AAPL').toUpperCase();
const port = Number(process.env.PORT || 8787);
const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
const { wallet: buyer } = getBuyerWallet();
const signer = buyer.connect(provider);

const first = await fetch(`http://127.0.0.1:${port}/research?ticker=${ticker}`);
const body402 = await first.json();
const req = body402.accepts?.[0];
console.log(`402 received: pay ${req.amount} to ${req.payTo}`);
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
const signature = await signer.signTypedData(domain, types, value);
const payment = Buffer.from(JSON.stringify({
  x402Version: 1, scheme: 'exact', network: req.network,
  payload: { signature, authorization: auth },
})).toString('base64');
const res = await fetch(`http://127.0.0.1:${port}/research?ticker=${ticker}`, { headers: { 'X-PAYMENT': payment } });
console.log(`server replied HTTP ${res.status}`);
console.log(await res.text());
