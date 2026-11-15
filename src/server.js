// Research agent HTTP server — sells stock research for test USDC via x402.
// Base Sepolia TESTNET ONLY. Run: node src/server.js (PORT env, default 8787).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';
import { CONFIG } from './config.js';
import { fetchQuote, analyze } from './stocks.js';
import { writeResearch } from './llm.js';
import { paymentRequirements, parsePaymentHeader, verifyPayment, USDC_ABI } from './x402.js';
import { getSellerWallet } from './wallets.js';
import { recordSale, readPortfolio } from './portfolio.js';
import { settlePayment } from './settle.js';

const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
const { wallet: seller, created: sellerCreated } = getSellerWallet();
const sellerAddress = process.env.SELLER_ADDRESS || seller.address;
if (sellerCreated) console.log(`[server] new throwaway seller wallet: ${sellerAddress} (fund with test ETH only if on-chain settlement is wanted)`);
const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function send(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(body);
}

function catalog() {
  return {
    service: 'Stocks Maxxing — Agentic Stock Finance (demo)',
    concept: 'Sell stock research as a service. Pay test USDC via x402 (Base Sepolia testnet), receive an analyst research report. Profits are allocated to tokenized stocks.',
    network: CONFIG.chainName,
    chainId: CONFIG.chainId,
    usdc: CONFIG.usdcAddress,
    priceUsdc: CONFIG.reportPriceUsdc,
    payTo: sellerAddress,
    universe: CONFIG.universe.map((u) => ({ ticker: u.ticker, name: u.name, tokenized: u.tokenized })),
    endpoints: {
      catalog: 'GET /',
      research: 'GET /research?ticker=AAPL  (402 without X-PAYMENT, report with valid X-PAYMENT)',
      portfolio: 'GET /portfolio',
      health: 'GET /health',
    },
  };
}

async function handleResearch(req, res, ticker) {
  const entry = CONFIG.universe.find((u) => u.ticker === ticker);
  if (!entry) return send(res, 400, { error: `unknown ticker ${ticker}`, universe: CONFIG.universe.map((u) => u.ticker) });
  const paymentHeader = req.headers['x-payment'];
  if (!paymentHeader) {
    return send(res, 402, paymentRequirements({
      payTo: sellerAddress,
      amountBaseUnits: CONFIG.reportPriceBaseUnits,
      description: `Research report for ${ticker} — ${CONFIG.reportPriceUsdc} USDC (Base Sepolia testnet)`,
    }));
  }
  let parsed;
  try {
    parsed = parsePaymentHeader(paymentHeader);
  } catch (e) {
    return send(res, 400, { error: `invalid X-PAYMENT: ${e.message}` });
  }
  const check = await verifyPayment({
    provider,
    auth: parsed.auth,
    signature: parsed.signature,
    expectedTo: sellerAddress,
    expectedValue: CONFIG.reportPriceBaseUnits,
  });
  if (!check.ok) return send(res, 402, { error: 'payment verification failed', reason: check.reason });
  // Payment verified (signature + balance). Try on-chain settlement; if the
  // seller wallet has no test ETH, settlement stays pending and the sale is
  // still valid — the signed authorization is held for later settlement.
  let settlement = { status: 'pending-no-gas', note: 'seller wallet not funded with test ETH; transferWithAuthorization will be submitted once funded' };
  try {
    const sellerWithProvider = seller.connect(provider);
    const receipt = await settlePayment({ provider, sellerWallet: sellerWithProvider, auth: parsed.auth, signature: parsed.signature });
    settlement = { status: 'settled', txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (e) {
    settlement = { status: 'pending', note: `settlement attempt failed: ${e.message}` };
  }
  const quote = await fetchQuote(ticker);
  const notes = analyze(quote);
  const report = await writeResearch(quote, notes, entry.name);
  const sale = recordSale({
    ticker,
    buyer: check.signer,
    amountBaseUnits: String(CONFIG.reportPriceBaseUnits),
    settlement,
    reportEngine: report.engine,
  });
  return send(res, 200, {
    report: { ticker, name: entry.name, asOf: report.asOf, source: report.source, engine: report.engine, fromCache: report.fromCache, text: report.text },
    quote: { price: quote.price, currency: quote.currency, changePct: quote.changePct, fiveDayChangePct: quote.fiveDayChangePct, source: quote.source },
    payment: { verified: true, signer: check.signer, settlement },
    sale,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, catalog());
    if (req.method === 'GET' && url.pathname === '/health') {
      const usdc = new ethers.Contract(CONFIG.usdcAddress, USDC_ABI, provider);
      const [ethBal, usdcBal] = await Promise.all([
        provider.getBalance(sellerAddress),
        usdc.balanceOf(sellerAddress),
      ]);
      return send(res, 200, {
        ok: true, network: CONFIG.chainName, chainId: CONFIG.chainId,
        seller: sellerAddress, sellerEth: ethers.formatEther(ethBal), sellerUsdc: ethers.formatUnits(usdcBal, 6),
        blockNumber: await provider.getBlockNumber(),
      });
    }
    if (req.method === 'GET' && url.pathname === '/portfolio') return send(res, 200, readPortfolio());
    if (req.method === 'GET' && url.pathname === '/research') {
      const ticker = (url.searchParams.get('ticker') || 'AAPL').toUpperCase();
      return await handleResearch(req, res, ticker);
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.message });
  }
});

server.listen(CONFIG.serverPort, () => {
  console.log(`[server] listening on http://127.0.0.1:${CONFIG.serverPort}`);
  console.log(`[server] seller (payTo): ${sellerAddress}`);
  console.log(`[server] price: ${CONFIG.reportPriceUsdc} USDC (Base Sepolia testnet) per report`);
});
