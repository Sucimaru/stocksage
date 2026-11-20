// Free stock data via the Yahoo Finance v8 chart API (no key required).
// Verified reachable from this VM 15 Nov 2026 (query1 + query2).
// Falls back to clearly-labeled sample data when the network/API is unavailable.
import { SAMPLE_QUOTES } from './sample-data.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

export async function fetchQuote(ticker) {
  const symbol = ticker.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`yahoo http ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('yahoo: empty result');
    const meta = result.meta || {};
    const closes = (result.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === 'number');
    const volumes = (result.indicators?.quote?.[0]?.volume || []).filter((v) => typeof v === 'number');
    const price = meta.regularMarketPrice;
    if (typeof price !== 'number') throw new Error('yahoo: no price');
    const prevClose = meta.chartPreviousClose || closes[closes.length - 2];
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    const fiveDayChangePct = closes.length >= 2 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : null;
    const avgVolume = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null;
    return {
      ticker: symbol,
      source: 'yahoo-finance-live',
      asOf: new Date((meta.regularMarketTime || Date.now() / 1000) * 1000).toISOString(),
      currency: meta.currency || 'USD',
      exchange: meta.fullExchangeName || meta.exchangeName || '',
      price,
      prevClose: prevClose ?? null,
      changePct: changePct == null ? null : Number(changePct.toFixed(2)),
      fiveDayChangePct: fiveDayChangePct == null ? null : Number(fiveDayChangePct.toFixed(2)),
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      volume: meta.regularMarketVolume ?? null,
      avgVolume5d: avgVolume == null ? null : Math.round(avgVolume),
      closes,
    };
  } catch (err) {
    // Honest fallback: clearly-labeled sample data, never presented as live.
    const sample = SAMPLE_QUOTES[symbol];
    if (!sample) throw new Error(`live fetch failed (${err.message}) and no sample data for ${symbol}`);
    return { ...sample, source: 'SAMPLE-DATA (labeled example, NOT live)', fetchError: err.message };
  }
}

export function analyze(quote) {
  const notes = [];
  if (quote.changePct != null) {
    notes.push(quote.changePct >= 0
      ? `Up ${quote.changePct}% on the day.`
      : `Down ${Math.abs(quote.changePct)}% on the day.`);
  }
  if (quote.fiveDayChangePct != null) {
    notes.push(`5-day momentum ${quote.fiveDayChangePct >= 0 ? '+' : ''}${quote.fiveDayChangePct}%.`);
  }
  if (quote.fiftyTwoWeekHigh && quote.price) {
    const offHigh = ((quote.fiftyTwoWeekHigh - quote.price) / quote.fiftyTwoWeekHigh) * 100;
    notes.push(`${offHigh.toFixed(1)}% below its 52-week high ($${quote.fiftyTwoWeekHigh}).`);
  }
  if (quote.volume && quote.avgVolume5d) {
    const ratio = quote.volume / quote.avgVolume5d;
    notes.push(ratio >= 1.2 ? `Volume is elevated (${ratio.toFixed(1)}x the 5-day average).` : 'Volume is near its 5-day average.');
  }
  return notes;
}
