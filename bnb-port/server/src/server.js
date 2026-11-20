// Research agent HTTP server — sells stock research for Binance-Peg USDC
// on BNB Chain (BSC mainnet) via the StockSageAccess contract.
// Agent ID Hackathon entry. Run: node src/server.js (PORT env, default 8787).
//
// Payment flow (plain ERC20 — NO EIP-3002/x402, see access.js):
//   GET /quote?ticker=AAPL&buyer=0x...    -> on-chain price + access status
//   GET /research?ticker=AAPL&buyer=0x... -> 402 with approve+purchase steps
//     if the buyer has no access; the report if they do (paid on-chain).
// The server never holds funds and never asks for a signature: payment is
// two transactions the buyer sends from their own wallet
// (approve EXACT price, then purchase(ticker)).
// The access contract is optional at startup: without
// ACCESS_CONTRACT_ADDRESS the server still runs and serves / and /portfolio,
// while /quote and /research answer with a clear 503 (not a crash).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';
import { CONFIG } from './config.js';
import { fetchQuote, analyze } from './stocks.js';
import { writeResearch } from './llm.js';
import { quoteAccess, paymentInstructions, getAccessContract, USDC_ABI, AGENT_ID_ABI } from './access.js';
import { recordSale, readPortfolio } from './portfolio.js';

const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const RISK_WARNING = 'Research only, not investment advice; prices can go down as well as up; do your own research.';

function send(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(body);
}

function catalog() {
  return {
    service: 'StockSage — Agentic Stock Finance (BNB Chain)',
    concept: 'Sell stock research as a service. Pay Binance-Peg USDC on BNB Chain via the StockSageAccess contract (approve exact amount, then purchase) and receive an analyst research report. Agent ID holders pay half price (0.05 USDC vs 0.10 USDC). Profits are allocated to tokenized stocks.',
    riskWarning: RISK_WARNING,
    network: CONFIG.chainName,
    chainId: CONFIG.chainId,
    usdc: CONFIG.usdcAddress,
    usdcDecimals: CONFIG.usdcDecimals,
    usdcNote: 'Binance-Peg USDC — plain BEP-20, no EIP-3002 (no transferWithAuthorization).',
    agentId: CONFIG.agentIdAddress,
    accessContract: CONFIG.accessContractAddress || null,
    accessContractNote: CONFIG.accessContractAddress
      ? 'StockSageAccess contract (deployed).'
      : 'Not deployed yet — set ACCESS_CONTRACT_ADDRESS once deployed; /quote and /research need it.',
    prices: {
      fullUsdc: CONFIG.fullPriceUsdc,
      holderUsdc: CONFIG.holderPriceUsdc,
      fullBaseUnits: String(CONFIG.fullPriceBaseUnits),
      holderBaseUnits: String(CONFIG.holderPriceBaseUnits),
      accessWindowSeconds: CONFIG.accessWindowSeconds,
    },
    universe: CONFIG.universe.map((u) => ({ ticker: u.ticker, name: u.name, tokenized: u.tokenized })),
    endpoints: {
      catalog: 'GET /',
      quote: 'GET /quote?ticker=AAPL&buyer=0x...  (price + holder flag + access status)',
      research: 'GET /research?ticker=AAPL&buyer=0x...  (402 with approve+purchase steps without access, report with access)',
      portfolio: 'GET /portfolio',
      health: 'GET /health',
    },
  };
}

function requireBuyer(url) {
  const buyer = url.searchParams.get('buyer') || '';
  if (!buyer) return { error: 'missing ?buyer=0x... query parameter (the address that will buy / already bought the report)' };
  if (!ethers.isAddress(buyer)) return { error: `invalid buyer address: ${buyer}` };
  return { buyer: ethers.getAddress(buyer) };
}

async function handleQuote(req, res, ticker, buyer) {
  try {
    const quote = await quoteAccess({ provider, buyer, ticker });
    return send(res, 200, quote);
  } catch (e) {
    if (e.message.includes('access contract not configured')) {
      return send(res, 503, { error: e.message, accessContract: null, hint: 'Deploy StockSageAccess (see ../contracts/) and restart with ACCESS_CONTRACT_ADDRESS set.' });
    }
    return send(res, 502, { error: `could not read price from chain: ${e.message}` });
  }
}

async function handleResearch(req, res, ticker, buyer) {
  const entry = CONFIG.universe.find((u) => u.ticker === ticker);
  if (!entry) return send(res, 400, { error: `unknown ticker ${ticker}`, universe: CONFIG.universe.map((u) => u.ticker) });
  let quote;
  try {
    quote = await quoteAccess({ provider, buyer, ticker });
  } catch (e) {
    if (e.message.includes('access contract not configured')) {
      return send(res, 503, { error: e.message, accessContract: null, hint: 'Deploy StockSageAccess (see ../contracts/) and restart with ACCESS_CONTRACT_ADDRESS set.' });
    }
    return send(res, 502, { error: `could not verify access on-chain: ${e.message}` });
  }
  if (!quote.hasAccess) {
    return send(res, 402, paymentInstructions(quote));
  }
  // Paid on-chain (verified by hasAccess eth_call). Research flow unchanged:
  // Yahoo Finance + Gemini, cached per ticker+day (see llm.js).
  const q = await fetchQuote(ticker);
  const notes = analyze(q);
  const report = await writeResearch(q, notes, entry.name);
  const sale = recordSale({
    ticker,
    buyer,
    amountBaseUnits: quote.priceBaseUnits,
    settlement: { status: 'paid-on-chain', note: `access verified via hasAccess eth_call on StockSageAccess ${CONFIG.accessContractAddress}; payment tx submitted by buyer (approve + purchase)` },
    reportEngine: report.engine,
  });
  return send(res, 200, {
    report: { ticker, name: entry.name, asOf: report.asOf, source: report.source, engine: report.engine, fromCache: report.fromCache, text: report.text },
    quote: { price: q.price, currency: q.currency, changePct: q.changePct, fiveDayChangePct: q.fiveDayChangePct, source: q.source },
    payment: {
      verified: true,
      buyer,
      priceBaseUnits: quote.priceBaseUnits,
      priceUsdc: quote.priceUsdc,
      priceTier: quote.priceTier,
      isAgentIdHolder: quote.isAgentIdHolder,
      accessContract: quote.accessContract,
      accessWindowSeconds: quote.accessWindowSeconds,
    },
    sale,
    riskWarning: RISK_WARNING,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, catalog());
    if (req.method === 'GET' && url.pathname === '/health') {
      const checks = {};
      try {
        checks.blockNumber = await provider.getBlockNumber();
      } catch (e) { checks.blockNumberError = e.message; }
      try {
        const usdc = new ethers.Contract(CONFIG.usdcAddress, USDC_ABI, provider);
        const [name, symbol, decimals] = await Promise.all([usdc.name(), usdc.symbol(), usdc.decimals()]);
        checks.usdc = { address: CONFIG.usdcAddress, name, symbol, decimals: Number(decimals), eip3002: false, note: 'Binance-Peg USDC — no EIP-3002 support by design' };
      } catch (e) { checks.usdc = { address: CONFIG.usdcAddress, error: e.message }; }
      try {
        const agentId = new ethers.Contract(CONFIG.agentIdAddress, AGENT_ID_ABI, provider);
        checks.agentId = { address: CONFIG.agentIdAddress, name: await agentId.name() };
      } catch (e) { checks.agentId = { address: CONFIG.agentIdAddress, error: e.message }; }
      if (CONFIG.accessContractAddress) {
        try {
          const access = getAccessContract(provider);
          const [full, holder, windowSecs] = await Promise.all([access.fullPrice(), access.holderPrice(), access.ACCESS_WINDOW()]);
          checks.accessContract = {
            address: CONFIG.accessContractAddress,
            fullPriceUsdc: ethers.formatUnits(full, CONFIG.usdcDecimals),
            holderPriceUsdc: ethers.formatUnits(holder, CONFIG.usdcDecimals),
            accessWindowSeconds: Number(windowSecs),
          };
        } catch (e) { checks.accessContract = { address: CONFIG.accessContractAddress, error: e.message }; }
      } else {
        checks.accessContract = { address: null, note: 'not configured — set ACCESS_CONTRACT_ADDRESS once StockSageAccess is deployed' };
      }
      const ok = checks.blockNumber !== undefined
        && !checks.usdc.error && !checks.agentId.error
        && (!CONFIG.accessContractAddress || !checks.accessContract.error);
      return send(res, 200, {
        ok, network: CONFIG.chainName, chainId: CONFIG.chainId,
        rpcUrl: CONFIG.rpcUrl, checks,
      });
    }
    if (req.method === 'GET' && url.pathname === '/portfolio') {
      const p = readPortfolio();
      return send(res, 200, { ...p, riskWarning: RISK_WARNING });
    }
    if (req.method === 'GET' && url.pathname === '/quote') {
      const ticker = (url.searchParams.get('ticker') || 'AAPL').toUpperCase();
      const entry = CONFIG.universe.find((u) => u.ticker === ticker);
      if (!entry) return send(res, 400, { error: `unknown ticker ${ticker}`, universe: CONFIG.universe.map((u) => u.ticker) });
      const { buyer, error } = requireBuyer(url);
      if (error) return send(res, 400, { error });
      return await handleQuote(req, res, ticker, buyer);
    }
    if (req.method === 'GET' && url.pathname === '/research') {
      const ticker = (url.searchParams.get('ticker') || 'AAPL').toUpperCase();
      const { buyer, error } = requireBuyer(url);
      if (error) return send(res, 400, { error });
      return await handleResearch(req, res, ticker, buyer);
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.message });
  }
});

server.listen(CONFIG.serverPort, () => {
  console.log(`[server] listening on http://127.0.0.1:${CONFIG.serverPort}`);
  console.log(`[server] network: ${CONFIG.chainName} (chain ${CONFIG.chainId}), RPC ${CONFIG.rpcUrl}`);
  console.log(`[server] USDC (Binance-Peg, 18 decimals, no EIP-3002): ${CONFIG.usdcAddress}`);
  console.log(`[server] Agent ID: ${CONFIG.agentIdAddress}`);
  console.log(`[server] access contract: ${CONFIG.accessContractAddress || '(not set — /quote and /research will answer 503 until ACCESS_CONTRACT_ADDRESS is set)'}`);
  console.log(`[server] prices: full ${CONFIG.fullPriceUsdc} USDC, Agent ID holder ${CONFIG.holderPriceUsdc} USDC, access ${CONFIG.accessWindowSeconds / 3600}h`);
});
