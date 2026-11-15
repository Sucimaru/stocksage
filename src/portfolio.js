// Profit ledger: research-sale earnings -> tokenized-stock portfolio.
// The allocation is a paper ledger (notional buys of tokenized stocks) until
// a Base Sepolia DEX pool for tokenized equities exists to swap against.
// Every entry records the sale it came from, so the demo is auditable.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const SALES_FILE = path.join(DATA_DIR, 'sales.jsonl');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');

function readSales() {
  if (!fs.existsSync(SALES_FILE)) return [];
  return fs.readFileSync(SALES_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function recordSale({ ticker, buyer, amountBaseUnits, settlement, reportEngine }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const amount = BigInt(amountBaseUnits);
  const allocations = CONFIG.allocation.map(({ ticker: t, pct }) => ({
    ticker: t,
    pct,
    amountBaseUnits: String((amount * BigInt(pct)) / 100n),
    amountUsdc: (Number(amount * BigInt(pct)) / 100 / 1e6).toFixed(6),
  }));
  const sale = {
    id: `sale-${Date.now()}`,
    time: new Date().toISOString(),
    ticker,
    buyer,
    amountBaseUnits: String(amount),
    amountUsdc: (Number(amount) / 1e6).toFixed(6),
    settlement,
    reportEngine,
    allocations,
  };
  fs.appendFileSync(SALES_FILE, JSON.stringify(sale) + '\n');
  return sale;
}

export function readPortfolio() {
  const sales = readSales();
  const earned = sales.reduce((a, s) => a + BigInt(s.amountBaseUnits), 0n);
  const byTicker = {};
  for (const s of sales) {
    for (const a of s.allocations) {
      byTicker[a.ticker] = (byTicker[a.ticker] || 0n) + BigInt(a.amountBaseUnits);
    }
  }
  return {
    network: CONFIG.chainName,
    note: 'Paper ledger: earnings are notionally allocated to tokenized stocks. On-chain swap to real tokenized equities is wired in once a Base Sepolia DEX pool exists (see README).',
    totalSales: sales.length,
    totalEarnedBaseUnits: String(earned),
    totalEarnedUsdc: (Number(earned) / 1e6).toFixed(6),
    allocations: Object.entries(byTicker).map(([ticker, v]) => ({
      ticker,
      tokenized: CONFIG.universe.find((u) => u.ticker === ticker)?.tokenized || ticker,
      amountBaseUnits: String(v),
      amountUsdc: (Number(v) / 1e6).toFixed(6),
    })),
    sales: sales.map((s) => ({ id: s.id, time: s.time, ticker: s.ticker, buyer: s.buyer, amountUsdc: s.amountUsdc, settlement: s.settlement?.status, txHash: s.settlement?.txHash || null })),
  };
}
