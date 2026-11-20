// Demo buyer for the BNB Chain port: reads /quote, approves the EXACT
// USDC price, calls StockSageAccess.purchase(ticker), then fetches the
// report with GET /research?buyer=... and saves it.
// Usage: node src/client-bnb.js [TICKER]   (server must be running; default AAPL)
//   Env: PORT (default 8787), BUYER_PRIVATE_KEY (throwaway wallet; if unset
//   a fresh random throwaway wallet is generated for this run only and its
//   address is printed — fund it first, then re-run with the key set).
//   RPC_URL / ACCESS_CONTRACT_ADDRESS / CHAIN_ID come from config.js env.
//   Works against an Anvil fork: set RPC_URL to the fork and
//   ACCESS_CONTRACT_ADDRESS to the deployed contract on the fork.
// The buyer wallet is NEVER Suci's wallet (never the Agentic wallet, never
// the farming wallet). No private key is ever hardcoded here.
// Needs: BNB for gas + enough Binance-Peg USDC (0.10 full / 0.05 Agent ID
// holder) on BNB Chain. On a fork, fund the throwaway via anvil cheatcodes
// or a faucet transfer — see README.md.
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { USDC_ABI, ACCESS_ABI } from './access.js';

const ticker = (process.argv[2] || 'AAPL').toUpperCase();
const port = Number(process.env.PORT || 8787);
const base = `http://127.0.0.1:${port}`;
const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);

function getBuyerWallet() {
  const key = process.env.BUYER_PRIVATE_KEY;
  if (key) {
    const wallet = new ethers.Wallet(key);
    return { wallet, created: false };
  }
  const wallet = ethers.Wallet.createRandom();
  console.log('[client] no BUYER_PRIVATE_KEY set — generated a fresh throwaway buyer wallet for this run only (NOT saved):');
  console.log(`[client]   address: ${wallet.address}`);
  console.log('[client]   fund it with BNB (gas) + Binance-Peg USDC, then re-run with BUYER_PRIVATE_KEY=<its key>.');
  return { wallet, created: true };
}

async function main() {
  if (!CONFIG.accessContractAddress) {
    console.log('[client] ACCESS_CONTRACT_ADDRESS is not set — the server cannot price or verify access yet.');
    console.log('[client] Deploy StockSageAccess (see ../contracts/) and restart the server with ACCESS_CONTRACT_ADDRESS set.');
    process.exit(2);
  }
  const { wallet: buyer, created } = getBuyerWallet();
  const buyerSigner = buyer.connect(provider);
  // Explicit nonce tracking: on an Anvil fork of BSC the reported head can
  // briefly point at a fresh upstream block whose state does not yet include
  // this account's just-mined transaction, so eth_getTransactionCount can
  // return a stale nonce (observed: approve mined, then purchase built with
  // nonce 0 -> NONCE_EXPIRED). Tracking the nonce locally after each mined
  // transaction avoids the race. Also retry once on NONCE_EXPIRED.
  let nextNonce = await provider.getTransactionCount(buyer.address, 'latest');
  async function sendWithNonceRetry(label, sendFn) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const tx = await sendFn(nextNonce);
        nextNonce += 1;
        return tx;
      } catch (e) {
        if (e?.code === 'NONCE_EXPIRED' && attempt === 0) {
          console.log(`[client] ${label}: nonce expired, re-fetching nonce and retrying...`);
          nextNonce = await provider.getTransactionCount(buyer.address, 'latest');
          continue;
        }
        throw e;
      }
    }
  }
  console.log(`[client] buyer: ${buyer.address}${created ? ' (fresh throwaway, this run only)' : ''}`);
  console.log(`[client] network: ${CONFIG.chainName} (chain ${CONFIG.chainId}), access contract ${CONFIG.accessContractAddress}`);

  console.log(`[client] asking /quote for ${ticker} ...`);
  const quoteRes = await fetch(`${base}/quote?ticker=${ticker}&buyer=${buyer.address}`);
  const quote = await quoteRes.json();
  if (!quoteRes.ok) {
    console.log(`[client] /quote failed HTTP ${quoteRes.status}: ${quote.error || JSON.stringify(quote)}`);
    process.exit(1);
  }
  console.log(`[client] quote: ${quote.priceUsdc} USDC (${quote.priceTier}${quote.isAgentIdHolder ? ', Agent ID holder' : ''}), hasAccess=${quote.hasAccess}`);
  const price = BigInt(quote.priceBaseUnits);

  if (!quote.hasAccess) {
    const usdc = new ethers.Contract(CONFIG.usdcAddress, USDC_ABI, provider);
    const [balance, bnb] = await Promise.all([
      usdc.balanceOf(buyer.address),
      provider.getBalance(buyer.address),
    ]);
    console.log(`[client] buyer USDC balance: ${ethers.formatUnits(balance, CONFIG.usdcDecimals)} USDC; BNB balance: ${ethers.formatEther(bnb)} BNB`);
    if (balance < price) {
      console.log('[client] INSUFFICIENT USDC. Fund the buyer first:');
      console.log(`[client]   - Buy/bridge Binance-Peg USDC (${CONFIG.usdcAddress}) to ${buyer.address} on BNB Chain`);
      console.log(`[client]   - Also send a little BNB for gas.`);
      console.log('[client]   (On an Anvil fork: fund via cast/anvil cheatcodes — see README.md.)');
      process.exit(2);
    }
    if (bnb === 0n) {
      console.log('[client] buyer has no BNB for gas — send a little BNB first.');
      process.exit(2);
    }
    const access = new ethers.Contract(CONFIG.accessContractAddress, ACCESS_ABI, provider);
    const logNonce = async (tag) => console.log(`[client] nonce ${tag}: latest=${await provider.getTransactionCount(buyer.address, 'latest')} pending=${await provider.getTransactionCount(buyer.address, 'pending')}`);
    const allowance = await usdc.allowance(buyer.address, CONFIG.accessContractAddress);
    if (allowance < price) {
      await logNonce('before approve');
      console.log(`[client] approving EXACTLY ${quote.priceUsdc} USDC to the access contract (never unlimited)...`);
      const approveTx = await sendWithNonceRetry('approve', (nonce) => usdc.connect(buyerSigner).approve(CONFIG.accessContractAddress, price, { nonce }));
      const approveRc = await approveTx.wait(1);
      console.log(`[client] approve confirmed: ${approveTx.hash}${CONFIG.chainId === 56 ? ` — https://bscscan.com/tx/${approveTx.hash}` : ''} (block ${approveRc.blockNumber})`);
    } else {
      console.log(`[client] existing allowance ${ethers.formatUnits(allowance, CONFIG.usdcDecimals)} USDC already covers the price — skipping approve.`);
    }
    await logNonce('before purchase');
    console.log(`[client] calling purchase("${ticker}") ...`);
    const buyTx = await sendWithNonceRetry('purchase', (nonce) => access.connect(buyerSigner).purchase(ticker, { nonce }));
    const buyRc = await buyTx.wait(1);
    console.log(`[client] purchase confirmed: ${buyTx.hash}${CONFIG.chainId === 56 ? ` — https://bscscan.com/tx/${buyTx.hash}` : ''} (block ${buyRc.blockNumber})`);
  } else {
    console.log('[client] already has access (purchased within the last 24h) — skipping payment.');
  }

  console.log(`[client] fetching report for ${ticker} ...`);
  const res = await fetch(`${base}/research?ticker=${ticker}&buyer=${buyer.address}`);
  const result = await res.json();
  console.log(`[client] server replied HTTP ${res.status}`);
  if (res.status !== 200) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(`[client] payment verified on-chain: tier ${result.payment.priceTier}, ${result.payment.priceUsdc} USDC, holder=${result.payment.isAgentIdHolder}`);
  console.log(`[client] report engine: ${result.report.engine} (cached: ${result.report.fromCache})`);
  const outFile = path.join(process.cwd(), 'demo', `last-report-bnb-${ticker}.md`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `# ${ticker} research report (BNB Chain)\n\n${result.report.text}\n\n---\n\n- Source: ${result.report.source}\n- Engine: ${result.report.engine}\n- Price: ${result.quote.price} ${result.quote.currency} (change ${result.quote.changePct}%, 5d ${result.quote.fiveDayChangePct}%)\n- Paid: ${result.payment.priceUsdc} USDC (${result.payment.priceTier}) via StockSageAccess ${result.payment.accessContract}\n- ${result.riskWarning}\n`);
  console.log(`[client] report saved to ${outFile}`);
  console.log('--- report ---');
  console.log(result.report.text);
}

main().catch((e) => { console.error('[client] error:', e.message); process.exit(1); });
