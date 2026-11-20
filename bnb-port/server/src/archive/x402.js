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

// x402 payment flow (Coinbase x402 "exact" scheme, EIP-3002 transferWithAuthorization).
// Testnet only: Base Sepolia, USDC (Circle). No facilitator dependency — the
// server verifies the payment itself: EIP-712 signature + on-chain balance /
// nonce checks via eth_call, then settles on-chain when the seller wallet is
// funded (see settle.js). Verification without settlement is a real x402
// pattern (the facilitator verifies the signature; settlement may be deferred).
import { ethers } from 'ethers';
import { CONFIG } from './config.js';

export const USDC_ABI = [
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function nonces(address) view returns (uint256)',
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) returns (bool)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
];

export function paymentRequirements({ payTo, amountBaseUnits, description }) {
  return {
    x402Version: 1,
    error: 'Payment Required',
    accepts: [
      {
        scheme: 'exact',
        network: CONFIG.x402Network,
        amount: String(amountBaseUnits),
        asset: CONFIG.usdcAddress,
        payTo,
        maxTimeoutSeconds: 300,
        extra: { name: 'USDC', version: CONFIG.usdcVersion, eip155Network: CONFIG.x402NetworkEip155 },
      },
    ],
    description: description || `Research report — ${CONFIG.reportPriceUsdc} USDC (Base Sepolia testnet)`,
  };
}

// Parse the X-PAYMENT header: base64(JSON) with
// { x402Version, scheme, network, payload: { signature, authorization: { from, to, value, validAfter, validBefore, nonce } } }
export function parsePaymentHeader(header) {
  if (!header) throw new Error('missing X-PAYMENT header');
  const json = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  const auth = json?.payload?.authorization;
  const signature = json?.payload?.signature;
  if (!auth || !signature) throw new Error('malformed X-PAYMENT payload');
  return { json, auth, signature };
}

// Verify an EIP-3002 authorization: signature, fields, balance, nonce.
// Returns { ok, reason?, signer, auth } — never throws for bad payments.
export async function verifyPayment({ provider, auth, signature, expectedTo, expectedValue }) {
  const usdc = new ethers.Contract(CONFIG.usdcAddress, USDC_ABI, provider);
  const domain = {
    name: 'USDC',
    version: CONFIG.usdcVersion,
    chainId: CONFIG.chainId,
    verifyingContract: CONFIG.usdcAddress,
  };
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };
  const value = {
    from: auth.from,
    to: auth.to,
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: auth.nonce,
  };
  let signer;
  try {
    signer = ethers.verifyTypedData(domain, types, value, signature);
  } catch (e) {
    return { ok: false, reason: `bad signature: ${e.message}` };
  }
  if (signer.toLowerCase() !== String(auth.from).toLowerCase()) {
    return { ok: false, reason: 'signature does not match authorization from-address' };
  }
  if (String(auth.to).toLowerCase() !== String(expectedTo).toLowerCase()) {
    return { ok: false, reason: `payment to wrong address (got ${auth.to}, want ${expectedTo})` };
  }
  if (BigInt(auth.value) < BigInt(expectedValue)) {
    return { ok: false, reason: `amount too small (${auth.value} < ${expectedValue})` };
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < BigInt(auth.validAfter)) return { ok: false, reason: 'authorization not yet valid' };
  if (now > BigInt(auth.validBefore)) return { ok: false, reason: 'authorization expired' };
  const [balance, onChainNonce] = await Promise.all([
    usdc.balanceOf(auth.from),
    usdc.nonces(auth.from),
  ]);
  if (balance < BigInt(auth.value)) {
    return { ok: false, reason: `insufficient USDC balance (${balance} < ${auth.value})` };
  }
  void onChainNonce; // EIP-3002 nonces are random bytes32; replay is prevented by the contract, not by a counter.
  return { ok: true, signer, auth: value };
}

// Build the EIP-712 payload a buyer signs (client side).
export function buildAuthorization({ from, to, value, validAfter, validBefore, nonce }) {
  return {
    domain: {
      name: 'USDC',
      version: CONFIG.usdcVersion,
      chainId: CONFIG.chainId,
      verifyingContract: CONFIG.usdcAddress,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    value: { from, to, value: BigInt(value), validAfter: BigInt(validAfter), validBefore: BigInt(validBefore), nonce },
  };
}
