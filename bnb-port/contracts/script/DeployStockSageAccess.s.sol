// SPDX-License-Identifier: MIT
// Deploy script for StockSageAccess on BNB Chain (BSC mainnet, chain 56).
//
// ⚠️  DO NOT RUN THIS SCRIPT YOURSELF AS AN AGENT. Deployment is a mainnet,
// state-changing action that only Suci runs, with his own wallet/key, after
// explicit confirmation. This file exists so the deployment is one command
// when he is ready.
//
// How Suci runs it (from this directory):
//   export PRIVATE_KEY=<his deployer key, never shared in chat>
//   ~/.foundry/bin/forge script script/DeployStockSageAccess.s.sol:DeployStockSageAccess \
//     --rpc-url https://bsc.publicnode.com --broadcast --slow
//   # dry-run first (no broadcast) to preview the deployment:
//   ~/.foundry/bin/forge script script/DeployStockSageAccess.s.sol:DeployStockSageAccess \
//     --rpc-url https://bsc.publicnode.com
//
// The deployer becomes the contract owner (withdraw + setPrices). Use the
// wallet that should receive the sales revenue.
//
// Verification on BscScan (after broadcast, needs a BscScan API key):
//   ~/.foundry/bin/forge verify-contract <DEPLOYED_ADDRESS> src/StockSageAccess.sol:StockSageAccess \
//     --chain 56 --etherscan-api-key $BSCSCAN_API_KEY \
//     --constructor-args $(~/.foundry/bin/cast abi-encode "constructor(address,address)" \
//       0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d \
//       0x60b9262456de011f7d15a54cdd8c48baaa8b022f)
//   (or verify via the BscScan GUI: "Verify & Publish", Solidity 0.8.24,
//   optimizer ON, 200 runs, MIT license, paste the flattened source.)
//
// Estimated deploy gas: MEASURED on the BSC fork, 20 Nov 2026 — 826,404 gas
// (deploy tx 0x58cb6b64cbfec0e5318b13d92b47ba8f035fed77514ea0843083fa72a280b42b,
// fork block 134678337; contract 0xAe66761DA292774868326fA9e5b6Eb10Dea2d931).
// Cost at 1 gwei = 0.000826 BNB; at 3 gwei = 0.002479 BNB; at 5 gwei =
// 0.004132 BNB. (Mainnet gas use should match closely — same bytecode and
// constructor args — but confirm from the real receipt after broadcast.)
// A purchase costs ~102,000 gas (measured on the fork) + a plain ERC20
// approve (~46k gas, typical) paid by the buyer on top of the report price.

pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/StockSageAccess.sol";

contract DeployStockSageAccess is Script {
    // Binance-Peg USDC on BSC (18 decimals) — verified on-chain 20 Nov 2026.
    address internal constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
    // SPACE ID Agent ID (ERC-721, non-transferable) — verified on-chain.
    // (EIP-55 checksummed form; the announcement prints it lowercase.)
    address internal constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        StockSageAccess access = new StockSageAccess(USDC, AGENT_ID);
        vm.stopBroadcast();
        console.log("StockSageAccess deployed at:", address(access));
        console.log("owner (deployer):", access.owner());
        console.log("usdc:", address(access.usdc()));
        console.log("agentId:", address(access.agentId()));
        console.log("fullPrice (USDC base units, 18 dec):", access.fullPrice());
        console.log("holderPrice (USDC base units, 18 dec):", access.holderPrice());
    }
}
