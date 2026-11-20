// SPDX-License-Identifier: MIT
// Foundry tests for StockSageAccess on a BSC fork (Anvil fork via --fork-url).
// Run: forge test --fork-url https://bsc.publicnode.com -vvv
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/StockSageAccess.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StockSageAccessTest is Test {
    // ---- Verified on-chain constants (BSC mainnet, checked 20 Nov 2026) ----
    address constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d; // 18 decimals
    address constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    address constant HOLDER = 0x40e589CaEa11d8C9D177060f005a2E9CfF8577eD; // Agent ID balance = 1
    address constant NON_HOLDER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // anvil acct #1, balance = 0
    address constant OWNER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // anvil acct #0
    address constant WHALE = 0x28C6c06298d514Db089934071355E5743bf21d60; // holds 29.83 USDC
    address constant POOR_BUYER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // anvil acct #2

    uint256 constant FULL_PRICE = 0.10 ether;
    uint256 constant HOLDER_PRICE = 0.05 ether;

    StockSageAccess access;

    event ResearchPurchased(
        address indexed buyer,
        string ticker,
        bytes32 indexed tickerHash,
        uint256 price,
        bool agentIdHolder,
        uint256 timestamp
    );

    function setUp() public {
        vm.startPrank(OWNER);
        access = new StockSageAccess(USDC, AGENT_ID);
        vm.stopPrank();

        // Fund both buyers (deal first, whale transfer as fallback).
        _fund(HOLDER, 1 ether);
        _fund(NON_HOLDER, 1 ether);
        vm.deal(HOLDER, 1 ether);
        vm.deal(NON_HOLDER, 1 ether);
        vm.deal(POOR_BUYER, 1 ether);
    }

    function _fund(address buyer, uint256 amount) internal {
        deal(USDC, buyer, amount);
        uint256 bal = IERC20(USDC).balanceOf(buyer);
        if (bal < amount) {
            vm.prank(WHALE);
            IERC20(USDC).transfer(buyer, amount - bal);
        }
    }

    function _approveAndBuy(address buyer, string memory ticker) internal {
        (uint256 price, ) = access.priceFor(buyer);
        vm.startPrank(buyer);
        IERC20(USDC).approve(address(access), price);
        access.purchase(ticker);
        vm.stopPrank();
    }

    // (f) priceFor correct for holder & non-holder
    function test_priceFor_holderAndNonHolder() public view {
        (uint256 pH, bool hH) = access.priceFor(HOLDER);
        assertEq(pH, HOLDER_PRICE, "holder price");
        assertTrue(hH, "holder flag");
        assertTrue(access.isAgentIdHolder(HOLDER), "isAgentIdHolder holder");

        (uint256 pN, bool hN) = access.priceFor(NON_HOLDER);
        assertEq(pN, FULL_PRICE, "non-holder price");
        assertFalse(hN, "non-holder flag");
        assertFalse(access.isAgentIdHolder(NON_HOLDER), "isAgentIdHolder non-holder");
        assertFalse(access.isAgentIdHolder(address(0)), "zero address not holder");
    }

    // (a) holder pays 0.05 USDC, hasAccess true, event recorded
    function test_holderPurchase_discountedPrice_eventAndAccess() public {
        uint256 balBefore = IERC20(USDC).balanceOf(HOLDER);
        bytes32 h = keccak256(bytes("AAPL"));

        vm.startPrank(HOLDER);
        IERC20(USDC).approve(address(access), HOLDER_PRICE);
        vm.expectEmit(true, true, false, true, address(access));
        emit ResearchPurchased(HOLDER, "AAPL", h, HOLDER_PRICE, true, block.timestamp);
        access.purchase("AAPL");
        vm.stopPrank();

        assertEq(IERC20(USDC).balanceOf(HOLDER), balBefore - HOLDER_PRICE, "holder USDC debited");
        assertEq(IERC20(USDC).balanceOf(address(access)), HOLDER_PRICE, "contract received price");
        assertEq(access.purchases(HOLDER, h), block.timestamp, "purchase timestamp recorded");
        assertTrue(access.hasAccess(HOLDER, "AAPL"), "hasAccess true after buy");
    }

    // (b) non-holder pays 0.10 USDC
    function test_nonHolderPurchase_fullPrice() public {
        uint256 balBefore = IERC20(USDC).balanceOf(NON_HOLDER);
        bytes32 h = keccak256(bytes("TSLA"));

        _approveAndBuy(NON_HOLDER, "TSLA");

        assertEq(IERC20(USDC).balanceOf(NON_HOLDER), balBefore - FULL_PRICE, "non-holder debited full");
        assertEq(IERC20(USDC).balanceOf(address(access)), FULL_PRICE, "contract received full price");
        assertEq(access.purchases(NON_HOLDER, h), block.timestamp, "purchase timestamp recorded");
        assertTrue(access.hasAccess(NON_HOLDER, "TSLA"), "hasAccess true after buy");
    }

    // (c) purchase reverts when allowance is insufficient
    function test_purchase_reverts_insufficientAllowance() public {
        vm.startPrank(NON_HOLDER);
        IERC20(USDC).approve(address(access), 0.01 ether); // less than 0.10 full price
        vm.expectRevert();
        access.purchase("AAPL");
        vm.stopPrank();
        assertFalse(access.hasAccess(NON_HOLDER, "AAPL"), "no access after failed buy");
    }

    function test_purchase_reverts_zeroAllowance() public {
        vm.startPrank(HOLDER);
        // no approve at all
        vm.expectRevert();
        access.purchase("AAPL");
        vm.stopPrank();
    }

    // (d) purchase reverts when USDC balance is insufficient
    function test_purchase_reverts_insufficientBalance() public {
        _fund(POOR_BUYER, 0.01 ether); // only 0.01 USDC, needs 0.10
        vm.startPrank(POOR_BUYER);
        IERC20(USDC).approve(address(access), FULL_PRICE);
        vm.expectRevert();
        access.purchase("NVDA");
        vm.stopPrank();
        assertFalse(access.hasAccess(POOR_BUYER, "NVDA"), "no access after failed buy");
    }

    // (e) hasAccess false before, true after, false after warp +24h
    function test_hasAccess_expiryAfter24h() public {
        assertFalse(access.hasAccess(HOLDER, "MSFT"), "no access before buy");
        _approveAndBuy(HOLDER, "MSFT");
        assertTrue(access.hasAccess(HOLDER, "MSFT"), "access right after buy");

        vm.warp(block.timestamp + 86399); // 1 second before expiry
        assertTrue(access.hasAccess(HOLDER, "MSFT"), "still access at 24h - 1s");

        vm.warp(block.timestamp + 1); // exactly +86400 from purchase
        assertFalse(access.hasAccess(HOLDER, "MSFT"), "no access at exactly +24h");

        vm.warp(block.timestamp + 3600); // well past expiry
        assertFalse(access.hasAccess(HOLDER, "MSFT"), "no access after +24h");
    }

    // (g) withdraw & setPrices revert when not owner
    function test_withdraw_reverts_nonOwner() public {
        _approveAndBuy(NON_HOLDER, "AAPL"); // contract holds 0.10 USDC
        vm.prank(NON_HOLDER);
        vm.expectRevert();
        access.withdraw(NON_HOLDER, FULL_PRICE);
        assertEq(IERC20(USDC).balanceOf(address(access)), FULL_PRICE, "funds stay in contract");
    }

    function test_setPrices_reverts_nonOwner() public {
        vm.prank(NON_HOLDER);
        vm.expectRevert();
        access.setPrices(0.20 ether, 0.10 ether);
        assertEq(access.fullPrice(), FULL_PRICE, "full price unchanged");
        assertEq(access.holderPrice(), HOLDER_PRICE, "holder price unchanged");
    }

    function test_withdraw_and_setPrices_byOwner() public {
        _approveAndBuy(NON_HOLDER, "AAPL");
        uint256 ownerBalBefore = IERC20(USDC).balanceOf(OWNER);
        vm.prank(OWNER);
        access.withdraw(OWNER, FULL_PRICE);
        assertEq(IERC20(USDC).balanceOf(OWNER), ownerBalBefore + FULL_PRICE, "owner withdrew");
        assertEq(IERC20(USDC).balanceOf(address(access)), 0, "contract drained");

        vm.prank(OWNER);
        access.setPrices(0.20 ether, 0.10 ether);
        assertEq(access.fullPrice(), 0.20 ether, "new full price");
        assertEq(access.holderPrice(), 0.10 ether, "new holder price");
    }

    function test_setPrices_reverts_invalid() public {
        vm.startPrank(OWNER);
        vm.expectRevert("holder must be cheaper");
        access.setPrices(0.10 ether, 0.10 ether); // equal prices
        vm.expectRevert("holder must be cheaper");
        access.setPrices(0.05 ether, 0.10 ether); // holder MORE expensive
        vm.expectRevert("price zero");
        access.setPrices(0, 0.01 ether);
        vm.stopPrank();
    }

    // (h) ticker validation: lowercase / empty / >10 chars revert
    function test_purchase_reverts_lowercaseTicker() public {
        vm.startPrank(HOLDER);
        IERC20(USDC).approve(address(access), HOLDER_PRICE);
        vm.expectRevert("ticker must be A-Z");
        access.purchase("aapl");
        vm.stopPrank();
    }

    function test_purchase_reverts_mixedCaseTicker() public {
        vm.startPrank(HOLDER);
        IERC20(USDC).approve(address(access), HOLDER_PRICE);
        vm.expectRevert("ticker must be A-Z");
        access.purchase("AapL");
        vm.stopPrank();
    }

    function test_purchase_reverts_emptyTicker() public {
        vm.startPrank(HOLDER);
        IERC20(USDC).approve(address(access), HOLDER_PRICE);
        vm.expectRevert("bad ticker length");
        access.purchase("");
        vm.stopPrank();
    }

    function test_purchase_reverts_tickerTooLong() public {
        vm.startPrank(HOLDER);
        IERC20(USDC).approve(address(access), HOLDER_PRICE);
        vm.expectRevert("bad ticker length");
        access.purchase("ABCDEFGHIJK"); // 11 chars
        vm.stopPrank();
    }

    function test_purchase_accepts_10CharTicker() public {
        _approveAndBuy(HOLDER, "ABCDEFGHIJ"); // exactly 10 chars
        assertTrue(access.hasAccess(HOLDER, "ABCDEFGHIJ"), "10-char ticker works");
    }

    // (i) second purchase of same ticker refreshes timestamp
    function test_secondPurchase_refreshesTimestamp() public {
        _approveAndBuy(HOLDER, "AAPL");
        bytes32 h = keccak256(bytes("AAPL"));
        uint256 firstTs = access.purchases(HOLDER, h);
        assertEq(firstTs, block.timestamp, "first timestamp");

        vm.warp(block.timestamp + 3600); // 1 hour later
        _approveAndBuy(HOLDER, "AAPL");
        uint256 secondTs = access.purchases(HOLDER, h);
        assertEq(secondTs, firstTs + 3600, "timestamp refreshed to second purchase");
        assertTrue(access.hasAccess(HOLDER, "AAPL"), "access still true");

        // Access now lasts 24h from the SECOND purchase, not the first.
        vm.warp(secondTs + 86399);
        assertTrue(access.hasAccess(HOLDER, "AAPL"), "access from second purchase");
        vm.warp(secondTs + 86400);
        assertFalse(access.hasAccess(HOLDER, "AAPL"), "expired 24h after second purchase");
    }
}
