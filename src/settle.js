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
