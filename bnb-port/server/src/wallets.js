// Throwaway demo wallets (BNB Chain MAINNET — real USDC/BNB, small amounts only).
// Generated locally with ethers; stored under demo/ with chmod 600.
// These are NOT Suci's wallets (never the Agentic wallet, never the farming
// wallet). Regenerate anytime with:
//   node src/wallets.js --new
// NOTE: the live server no longer needs a seller wallet — payment goes to
// the StockSageAccess contract, not to a seller address. This helper is kept
// for ad-hoc demo use only.
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';

const DEMO_DIR = path.join(process.cwd(), 'demo');
export const BUYER_KEY_FILE = path.join(DEMO_DIR, 'buyer-key.json');
export const SELLER_KEY_FILE = path.join(DEMO_DIR, 'seller-key.json');

function loadOrCreate(file, label) {
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  if (fs.existsSync(file)) {
    const { privateKey } = JSON.parse(fs.readFileSync(file, 'utf8'));
    const wallet = new ethers.Wallet(privateKey);
    return { wallet, created: false };
  }
  const wallet = ethers.Wallet.createRandom();
  fs.writeFileSync(file, JSON.stringify({ label, address: wallet.address, privateKey: wallet.privateKey }, null, 2), { mode: 0o600 });
  return { wallet, created: true };
}

export function getBuyerWallet() {
  const { wallet, created } = loadOrCreate(BUYER_KEY_FILE, 'demo-buyer (throwaway, BNB Chain mainnet — small amounts only)');
  return { wallet, created };
}

export function getSellerWallet() {
  const { wallet, created } = loadOrCreate(SELLER_KEY_FILE, 'demo-seller (throwaway, BNB Chain mainnet — small amounts only)');
  return { wallet, created };
}

if (process.argv.includes('--new')) {
  const b = getBuyerWallet();
  const s = getSellerWallet();
  console.log(`buyer : ${b.wallet.address} (${b.created ? 'created' : 'existing'})`);
  console.log(`seller: ${s.wallet.address} (${s.created ? 'created' : 'existing'})`);
  console.log('Fund the buyer with Binance-Peg USDC + a little BNB for gas (mainnet — small amounts only).');
  console.log('The seller wallet is no longer used by the server (payment goes to the StockSageAccess contract).');
}
