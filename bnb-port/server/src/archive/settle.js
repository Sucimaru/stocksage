// ============================================================================
// ARCHIVED — DO NOT USE ON BNB CHAIN.
// This file implements the EIP-3002 / x402 transferWithAuthorization flow
// from the Base Sepolia version of StockSage. It is kept here ONLY as a
// historical reference for the old testnet entry.
//
// WHY IT IS DEAD ON BSC: Binance-Peg USDC on BSC
// (0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d, 18 decimals) does NOT support
// EIP-3002 — verified on-chain 20 Nov 2026: no version(),
// no DOMAIN_SEPARATOR(), no nonces(), and no transferWithAuthorization
// selector in the token bytecode. Circle lists no BNB Chain address, so
// there is no native Circle USDC on BSC to use instead.
// Payment on BSC is plain ERC20 instead: buyer approves the EXACT price,
// then calls StockSageAccess.purchase(ticker) — see ../access.js and
// ../server.js. Nothing in the live server imports this file.
// ============================================================================

// On-chain settlement: submit transferWithAuthorization (EIP-3002) so the
// verified USDC payment actually moves from buyer to seller.
// Needs the SELLER wallet funded with Base Sepolia test ETH (gas). If the
// seller has no ETH this throws and the server records settlement as pending.
import { ethers } from 'ethers';
import { CONFIG } from './config.js';
import { USDC_ABI } from './x402.js';

export async function settlePayment({ provider, sellerWallet, auth, signature }) {
  const usdc = new ethers.Contract(CONFIG.usdcAddress, USDC_ABI, sellerWallet);
  const { v, r, s } = ethers.Signature.from(signature);
  const tx = await usdc.transferWithAuthorization(
    auth.from,
    auth.to,
    BigInt(auth.value),
    BigInt(auth.validAfter),
    BigInt(auth.validBefore),
    auth.nonce,
    v, r, s,
  );
  const receipt = await tx.wait(1);
  if (receipt.status !== 1n && receipt.status !== 1) throw new Error(`settlement tx reverted: ${tx.hash}`);
  return receipt;
}
