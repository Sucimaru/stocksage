// Throwaway demo wallets (Base Sepolia TESTNET ONLY).
// Generated locally with ethers; stored under demo/ with chmod 600.
// These are NOT Suci's wallets (never the Agentic wallet, never the farming
// wallet). They hold only testnet funds. Regenerate anytime with:
//   node src/wallets.js --new
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
  const { wallet, created } = loadOrCreate(BUYER_KEY_FILE, 'demo-buyer (throwaway, Base Sepolia testnet only)');
  return { wallet, created };
}

export function getSellerWallet() {
  const { wallet, created } = loadOrCreate(SELLER_KEY_FILE, 'demo-seller (throwaway, Base Sepolia testnet only)');
  return { wallet, created };
}

if (process.argv.includes('--new')) {
  const b = getBuyerWallet();
  const s = getSellerWallet();
  console.log(`buyer : ${b.wallet.address} (${b.created ? 'created' : 'existing'})`);
  console.log(`seller: ${s.wallet.address} (${s.created ? 'created' : 'existing'})`);
  console.log('Fund the buyer with test USDC via https://faucet.circle.com (Base Sepolia, 20 USDC / 2h, needs reCAPTCHA in a browser).');
  console.log('Fund either wallet with test ETH via a Base Sepolia faucet (see README.md) for on-chain settlement.');
}
