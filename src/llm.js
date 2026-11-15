// LLM research writer.
// Primary: Google Gemini via the already-connected helper CLI
//   python3 ~/workspace/custom-connectors/custom.google-gemini/bin/generate_content.py gemini-2.5-flash "<prompt>"
// The helper uses the Secure Vault surrogate mechanism — NO API key is ever
// in code, env vars, or logs here. Verified working 15 Nov 2026.
// Fallback: OpenRouter free-tier helper; last resort: quantitative template
// (clearly labeled, no LLM). Results are cached per ticker+day (Gemini free
// tier is ~20 req/day for flash models).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const GEMINI_CLI = path.join(os.homedir(), 'workspace', 'custom-connectors', 'custom.google-gemini', 'bin', 'generate_content.py');
const OPENROUTER_CLI = path.join(os.homedir(), 'workspace', 'custom-connectors', 'custom.openrouter', 'bin', 'chat.py');
// Free-tier models seen on the OpenRouter roster 15 Nov 2026 (roster changes;
// try in order, first success wins).
const OPENROUTER_FALLBACK_MODELS = ['google/gemma-4-31b-it:free', 'liquid/lfm-3-1.7b:free'];

function cachePath(ticker) {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(CACHE_DIR, `${ticker}-${day}.json`);
}

function buildPrompt(quote, notes, name) {
  return [
    `You are a concise equity research analyst. Write a short research note (max ~350 words) for ${quote.ticker} (${name}).`,
    `Live market data (source: ${quote.source}, as of ${quote.asOf}):`,
    `- Price: $${quote.price} ${quote.currency} on ${quote.exchange}; day change ${quote.changePct ?? '?'}%; 5-day change ${quote.fiveDayChangePct ?? '?'}%.`,
    `- Day range $${quote.dayLow ?? '?'} - $${quote.dayHigh ?? '?'}; 52-week range $${quote.fiftyTwoWeekLow ?? '?'} - $${quote.fiftyTwoWeekHigh ?? '?'}; volume ${quote.volume ?? '?'} (5d avg ${quote.avgVolume5d ?? '?'}).`,
    `- Analyst notes: ${notes.join(' ')}`,
    `Structure: 1) One-line summary with a stance (Bullish / Neutral / Bearish) and one sentence why.`,
    `2) Key drivers (2-3 bullets). 3) Risks (2 bullets). 4) What to watch next.`,
    `Do not invent earnings dates, guidance, or news. If a fact is not in the data above, say so or omit it. No disclaimer paragraph.`,
  ].join('\n');
}

async function callGemini(prompt) {
  const { stdout } = await execFileAsync(
    'python3', [GEMINI_CLI, 'gemini-2.5-flash', prompt],
    { timeout: 60000, maxBuffer: 1024 * 1024 },
  );
  const raw = stdout.trim();
  if (!raw) throw new Error('gemini: empty response');
  try {
    const json = JSON.parse(raw);
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    if (text) return text;
  } catch { /* helper printed plain text, not JSON */ }
  return raw;
}

async function callOpenRouter(prompt) {
  for (const model of OPENROUTER_FALLBACK_MODELS) {
    try {
      const { stdout } = await execFileAsync(
        'python3', [OPENROUTER_CLI, '--model', model, '--message', prompt, '--max-tokens', '800'],
        { timeout: 90000, maxBuffer: 1024 * 1024 },
      );
      const raw = stdout.trim();
      if (!raw) continue;
      try {
        const json = JSON.parse(raw);
        const text = json?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, model };
      } catch { /* plain-text output */ }
      return { text: raw, model };
    } catch { /* try next model */ }
  }
  throw new Error('openrouter: all fallback models failed');
}

function templateReport(quote, notes, name) {
  return [
    `# ${quote.ticker} — ${name} (quantitative note, no LLM)`,
    ``,
    `**Stance: Neutral (quant-only).** Price $${quote.price} ${quote.currency}; day ${quote.changePct ?? '?'}%; 5-day ${quote.fiveDayChangePct ?? '?'}%.`,
    ``,
    `## Key observations`,
    ...notes.map((n) => `- ${n}`),
    ``,
    `## Risks`,
    `- Momentum can reverse; this note uses price/volume data only.`,
    `- No news or fundamentals were analyzed in this version.`,
    ``,
    `*Source: ${quote.source}. Generated without an LLM (template fallback).*`,
  ].join('\n');
}

export async function writeResearch(quote, notes, name) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cp = cachePath(quote.ticker);
  if (fs.existsSync(cp)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cp, 'utf8'));
      return { ...cached, fromCache: true };
    } catch { /* regenerate */ }
  }
  const prompt = buildPrompt(quote, notes, name);
  let text = null;
  let engine = null;
  try {
    text = await callGemini(prompt);
    engine = 'gemini-2.5-flash';
  } catch (geminiErr) {
    try {
      const r = await callOpenRouter(prompt);
      text = r.text;
      engine = `openrouter:${r.model}`;
    } catch (orErr) {
      text = templateReport(quote, notes, name);
      engine = `template-fallback (gemini: ${geminiErr.message}; openrouter: ${orErr.message})`;
    }
  }
  const report = {
    ticker: quote.ticker,
    name,
    asOf: quote.asOf,
    source: quote.source,
    engine,
    text,
    fromCache: false,
  };
  fs.writeFileSync(cp, JSON.stringify(report, null, 2));
  return report;
}
