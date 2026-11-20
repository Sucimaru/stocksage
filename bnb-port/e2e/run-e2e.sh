#!/usr/bin/env bash
# End-to-end proof: StockSage BNB Chain port on a LOCAL Anvil fork of BSC.
# No mainnet, no real money, no Suci wallets/keys. Every on-chain tx here
# runs on the fork only. No private key is stored in this file: all fork
# transactions use anvil impersonation (--unlocked) or a fresh throwaway
# wallet generated at runtime (key lives only in shell memory, never echoed).
#
# Usage: bash run-e2e.sh   (from this directory)
# Outputs: anvil.log, server.log, client-bnb.log, E2E-LOG.md (this run's log)
set -u
cd "$(dirname "$0")"
ROOT="$PWD/.."
FORGE="$HOME/.foundry/bin"
RPC_FORK="http://127.0.0.1:8545"
RPC_BSC="https://bsc-mainnet.public.blastapi.io"  # publicnode blocks the archive calls anvil needs (403, token required); BlastAPI public allows historical state
USDC="0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
AGENTID="0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"
HOLDER="0x40e589CaEa11d8C9D177060f005a2E9CfF8577eD"   # Agentic wallet (holder, pranked on fork only)
WHALE="0x28C6c06298d514Db089934071355E5743bf21d60"   # holds 29.83 USDC on BSC
DEPLOYER="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" # anvil account #0
LOG="$PWD/E2E-LOG.md"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
fail() { log "FAIL: $*"; kill_jobs; exit 1; }
kill_jobs() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null
  [ -n "${ANVIL_PID:-}" ] && kill "$ANVIL_PID" 2>/dev/null
  pkill -f "anvil --fork-url" 2>/dev/null || true
  pkill -f "node src/server.js" 2>/dev/null || true
}
trap kill_jobs EXIT

: > "$LOG"
log "# StockSage BNB port — end-to-end proof (Anvil fork of BSC)"
log "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ) | Fork: $RPC_BSC | Local RPC: $RPC_FORK"
log ""

# 1. Start anvil fork (PINNED fork block: without pinning, anvil's reported
# head follows upstream BSC blocks and eth_getTransactionCount can briefly
# return a stale nonce for a locally-created account right after its first
# mined tx — observed twice as NONCE_EXPIRED on purchase. Pinning makes the
# fork deterministic.)
FORK_BLOCK=$("$FORGE/cast" block-number --rpc-url "$RPC_BSC" 2>/dev/null) || fail "cannot read BSC head"
log "Pinning fork at BSC block $FORK_BLOCK"
"$FORGE/anvil" --fork-url "$RPC_BSC" --fork-block-number "$FORK_BLOCK" --port 8545 --chain-id 56 > anvil.log 2>&1 &
ANVIL_PID=$!
for i in $(seq 1 60); do
  "$FORGE/cast" block-number --rpc-url "$RPC_FORK" >/dev/null 2>&1 && break
  sleep 2
done
FORK_BLOCK=$("$FORGE/cast" block-number --rpc-url "$RPC_FORK" 2>/dev/null) || fail "anvil fork did not start (see anvil.log)"
log "Anvil fork up, block $FORK_BLOCK, chain $("$FORGE/cast" chain-id --rpc-url "$RPC_FORK")"

# 2. Fund deployer + holder with fork BNB (mainnet balances of anvil accounts are ~0)
"$FORGE/cast" rpc anvil_setBalance "$DEPLOYER" 0x8AC7230489E80000 --rpc-url "$RPC_FORK" >/dev/null
"$FORGE/cast" rpc anvil_setBalance "$HOLDER" 0xDE0B6B3A7640000 --rpc-url "$RPC_FORK" >/dev/null
log "Funded deployer + holder with fork BNB (anvil_setBalance)"

# 3. Deploy StockSageAccess on the fork (impersonated deployer, no key)
log "## 2. Deploy StockSageAccess on fork"
BYTECODE=$(python3 -c "import json; print(json.load(open('$ROOT/contracts/out/StockSageAccess.sol/StockSageAccess.json'))['bytecode']['object'])")
ARGS=$("$FORGE/cast" abi-encode "constructor(address,address)" "$USDC" "$AGENTID")
"$FORGE/cast" rpc anvil_impersonateAccount "$DEPLOYER" --rpc-url "$RPC_FORK" >/dev/null
DEPLOY_OUT=$("$FORGE/cast" send --rpc-url "$RPC_FORK" --from "$DEPLOYER" --unlocked --create "${BYTECODE}${ARGS#0x}" 2>&1) || fail "deploy failed: $DEPLOY_OUT"
echo "$DEPLOY_OUT" >> "$LOG"
DEPLOY_TX=$(echo "$DEPLOY_OUT" | grep -E "^transactionHash" | grep -oE "0x[0-9a-fA-F]{64}")
ACCESS=$("$FORGE/cast" receipt "$DEPLOY_TX" --rpc-url "$RPC_FORK" --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['contractAddress'])")
DEPLOY_GAS=$("$FORGE/cast" receipt "$DEPLOY_TX" --rpc-url "$RPC_FORK" --json 2>/dev/null | python3 -c "import json,sys; print(int(json.load(sys.stdin)['gasUsed'],16))")
log "Deployed at: $ACCESS"
log "Deploy tx: $DEPLOY_TX | gas used: $DEPLOY_GAS"
"$FORGE/cast" rpc anvil_stopImpersonatingAccount "$DEPLOYER" --rpc-url "$RPC_FORK" >/dev/null

# 4. Fund holder + fresh buyer with fork USDC from the whale (impersonated)
log "## 3. Fund buyers with fork USDC (whale impersonation)"
FRESH_JSON=$("$FORGE/cast" wallet new 2>/dev/null)
FRESH_ADDR=$(echo "$FRESH_JSON" | grep -oE "0x[0-9a-fA-F]{40}" | head -1)
FRESH_KEY=$(echo "$FRESH_JSON" | grep -oE "0x[0-9a-fA-F]{64}" | head -1)
log "Fresh throwaway buyer (non-holder): $FRESH_ADDR (key in memory only, never logged)"
"$FORGE/cast" rpc anvil_setBalance "$FRESH_ADDR" 0xDE0B6B3A7640000 --rpc-url "$RPC_FORK" >/dev/null
"$FORGE/cast" rpc anvil_impersonateAccount "$WHALE" --rpc-url "$RPC_FORK" >/dev/null
"$FORGE/cast" send "$USDC" "transfer(address,uint256)" "$HOLDER" 10000000000000000000 --from "$WHALE" --unlocked --rpc-url "$RPC_FORK" >/dev/null || fail "whale->holder USDC failed"
"$FORGE/cast" send "$USDC" "transfer(address,uint256)" "$FRESH_ADDR" 10000000000000000000 --from "$WHALE" --unlocked --rpc-url "$RPC_FORK" >/dev/null || fail "whale->fresh USDC failed"
"$FORGE/cast" rpc anvil_stopImpersonatingAccount "$WHALE" --rpc-url "$RPC_FORK" >/dev/null
log "Holder USDC: $("$FORGE/cast" call "$USDC" "balanceOf(address)(uint256)" "$HOLDER" --rpc-url "$RPC_FORK")"
log "Fresh buyer USDC: $("$FORGE/cast" call "$USDC" "balanceOf(address)(uint256)" "$FRESH_ADDR" --rpc-url "$RPC_FORK")"

# 5. Start the adapted server against the fork
log "## 4. Start adapted server (fork RPC, deployed access contract)"
cd "$ROOT/server"
ACCESS_CONTRACT_ADDRESS="$ACCESS" RPC_URL="$RPC_FORK" CHAIN_ID=56 PORT=8788 node src/server.js > "$OLDPWD/server.log" 2>&1 &
SERVER_PID=$!
sleep 3
curl -s http://127.0.0.1:8788/health | tee -a "$LOG" | head -c 1200; echo ""
cd "$OLDPWD"

# 6. Quotes (holder vs non-holder)
log "## 5. Quotes"
log "Holder /quote: $(curl -s "http://127.0.0.1:8788/quote?ticker=AAPL&buyer=$HOLDER")"
log "Fresh /quote: $(curl -s "http://127.0.0.1:8788/quote?ticker=AAPL&buyer=$FRESH_ADDR")"

# 7. Holder path: 402 first, then approve+purchase via impersonation, then 200
log "## 6. Holder path (0x40e5..., Agent ID holder)"
log "GET /research before purchase: $(curl -s -o /dev/null -w "HTTP %{http_code}" "http://127.0.0.1:8788/research?ticker=AAPL&buyer=$HOLDER")"
"$FORGE/cast" rpc anvil_impersonateAccount "$HOLDER" --rpc-url "$RPC_FORK" >/dev/null
"$FORGE/cast" send "$USDC" "approve(address,uint256)" "$ACCESS" 50000000000000000 --from "$HOLDER" --unlocked --rpc-url "$RPC_FORK" >/dev/null || fail "holder approve failed"
BUY_OUT=$("$FORGE/cast" send "$ACCESS" "purchase(string)" AAPL --from "$HOLDER" --unlocked --rpc-url "$RPC_FORK" 2>&1) || fail "holder purchase failed: $BUY_OUT"
BUY_TX=$(echo "$BUY_OUT" | grep -E "^transactionHash" | grep -oE "0x[0-9a-fA-F]{64}")
BUY_GAS=$("$FORGE/cast" receipt "$BUY_TX" --rpc-url "$RPC_FORK" --json 2>/dev/null | python3 -c "import json,sys; print(int(json.load(sys.stdin)['gasUsed'],16))" 2>/dev/null || echo "?")
"$FORGE/cast" rpc anvil_stopImpersonatingAccount "$HOLDER" --rpc-url "$RPC_FORK" >/dev/null
log "Holder purchase tx: $BUY_TX (gas used: $BUY_GAS)"
log "Holder hasAccess: $("$FORGE/cast" call "$ACCESS" "hasAccess(address,string)(bool)" "$HOLDER" AAPL --rpc-url "$RPC_FORK")"
HOLDER_RES=$(curl -s "http://127.0.0.1:8788/research?ticker=AAPL&buyer=$HOLDER")
echo "$HOLDER_RES" | head -c 1500 | tee -a "$LOG"; echo ""
echo "$HOLDER_RES" | python3 -c "import json,sys; d=json.load(sys.stdin); print('holder report engine:', d.get('report',{}).get('engine'), '| source:', d.get('report',{}).get('source'), '| payment:', d.get('payment',{}))" | tee -a "$LOG"

# 8. Fresh buyer path via client-bnb.js (full flow: quote -> approve -> purchase -> report)
log "## 7. Fresh buyer path via client-bnb.js"
cd "$ROOT/server"
ACCESS_CONTRACT_ADDRESS="$ACCESS" RPC_URL="$RPC_FORK" CHAIN_ID=56 PORT=8788 BUYER_PRIVATE_KEY="$FRESH_KEY" node src/client-bnb.js AAPL > "$OLDPWD/client-bnb.log" 2>&1
CLIENT_RC=$?
cd "$OLDPWD"
log "client-bnb.js exit code: $CLIENT_RC"
grep -E "quote:|approve confirmed|purchase confirmed|report engine|report saved|payment verified" client-bnb.log | tee -a "$LOG"
log "Fresh buyer hasAccess: $("$FORGE/cast" call "$ACCESS" "hasAccess(address,string)(bool)" "$FRESH_ADDR" AAPL --rpc-url "$RPC_FORK")"
log "Access contract USDC balance (expect 0.15 USDC = 150000000000000000): $("$FORGE/cast" call "$USDC" "balanceOf(address)(uint256)" "$ACCESS" --rpc-url "$RPC_FORK")"
if [ -f "$ROOT/server/demo/last-report-bnb-AAPL.md" ]; then
  log "Saved report: $ROOT/server/demo/last-report-bnb-AAPL.md ($(wc -c < "$ROOT/server/demo/last-report-bnb-AAPL.md") bytes)"
  head -20 "$ROOT/server/demo/last-report-bnb-AAPL.md" | tee -a "$LOG"
else
  fail "report file not created"
fi

log ""
log "## RESULT"
if [ "$CLIENT_RC" = "0" ]; then log "E2E PASS: holder (0.05 USDC) + fresh buyer (0.10 USDC) both bought and received reports on the fork."; else log "E2E PARTIAL: client-bnb.js exited $CLIENT_RC — see client-bnb.log"; fi
log "Deploy gas (fork): $DEPLOY_GAS | Contract: $ACCESS"
kill_jobs
trap - EXIT
