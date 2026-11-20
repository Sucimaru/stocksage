// SPDX-License-Identifier: MIT
// StockSageAccess — on-chain purchase of StockSage stock-research reports on BNB Chain.
// Agent ID Hackathon (Binance Wallet + BNB Chain), submission deadline 9 Dec 2026.
//
// Business rule (Agent ID is core, not a sticker): an Agent ID holder pays a
// DISCOUNTED price for the same report; a non-holder pays the FULL price.
// Every purchase is recorded on-chain (buyer, ticker, timestamp, price, holder
// flag) so it counts as on-chain Agent ID interaction for the hackathon metrics
// (interacting Agent ID addresses, tx count, volume).
//
// Payment token: Binance-Peg USDC on BSC, 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
// (18 decimals). VERIFIED on-chain 20 Nov 2026: name "USD Coin", symbol "USDC",
// decimals 18, NO version()/DOMAIN_SEPARATOR()/nonces() and NO
// transferWithAuthorization selector in bytecode — i.e. this token does NOT
// support EIP-3002. Circle's official USDC address page lists NO BNB Chain
// entry, so there is no native Circle USDC on BSC to use instead. Payment is
// therefore plain ERC20: buyer approves the EXACT price, then calls purchase()
// which pulls exactly that amount via transferFrom. No unlimited approvals are
// ever requested; no EIP-3002 authorization flow is used anywhere.
//
// Agent ID: SPACE ID Agent ID (ERC-721, non-transferable),
// 0x60b9262456de011f7d15a54cdd8c48baaa8b022f. Holder check is a read-only
// balanceOf(buyer) > 0 call. The contract NEVER looks up anyone else's wallet:
// it only checks the caller's own Agent ID balance, and only for pricing.
//
// Owner permissions (documented, per hackathon red lines): the owner can
// withdraw collected USDC (withdraw) and change the two prices (setPrices).
// The owner CANNOT change the USDC/Agent ID addresses, cannot grant access
// without payment, cannot move any user's funds, and cannot pause purchases.
// There is no fee, no tax, no mint, no blacklist.
//
// RISK WARNING (also shown on the landing page and in the server catalog):
// StockSage sells research notes, not investment advice. Stock prices can go
// down as well as up; past performance does not guarantee future results.
// Reports are informational only — do your own research before any trade.
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract StockSageAccess is Ownable, ReentrancyGuard {
    /// @notice Binance-Peg USDC on BSC (18 decimals). Plain BEP-20, no EIP-3002.
    IERC20 public immutable usdc;
    /// @notice SPACE ID Agent ID (ERC-721, non-transferable).
    IERC721 public immutable agentId;

    /// @notice Full price of one research report: 0.10 USDC (18 decimals).
    uint256 public fullPrice = 0.10 ether;
    /// @notice Discounted price for Agent ID holders: 0.05 USDC (50% off).
    uint256 public holderPrice = 0.05 ether;
    /// @notice How long a purchase unlocks the report: 24 hours.
    uint256 public constant ACCESS_WINDOW = 86400;

    /// @notice buyer => keccak256(ticker) => purchase timestamp (0 = never).
    mapping(address => mapping(bytes32 => uint256)) public purchases;

    /// @notice Emitted on every purchase — the on-chain record the hackathon
    /// metrics count (interacting address, tx, volume, holder flag).
    event ResearchPurchased(
        address indexed buyer,
        string ticker,
        bytes32 indexed tickerHash,
        uint256 price,
        bool agentIdHolder,
        uint256 timestamp
    );
    event PricesUpdated(uint256 fullPrice, uint256 holderPrice);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _usdc, address _agentId) Ownable(msg.sender) {
        require(_usdc != address(0) && _agentId != address(0), "zero address");
        usdc = IERC20(_usdc);
        agentId = IERC721(_agentId);
    }

    /// @notice True if `buyer` holds at least one Agent ID (read-only).
    function isAgentIdHolder(address buyer) public view returns (bool) {
        if (buyer == address(0)) return false;
        return agentId.balanceOf(buyer) > 0;
    }

    /// @notice Price quoted for `buyer` + whether they hold an Agent ID.
    function priceFor(address buyer) public view returns (uint256 price, bool isHolder) {
        isHolder = isAgentIdHolder(buyer);
        price = isHolder ? holderPrice : fullPrice;
    }

    /// @notice Buy the research report for `ticker` (uppercase A-Z, 1-10 chars).
    /// Pulls exactly the quoted price in USDC via transferFrom — the buyer must
    /// first approve exactly that amount. Access lasts ACCESS_WINDOW (24h).
    function purchase(string calldata ticker) external nonReentrant {
        bytes memory t = bytes(ticker);
        require(t.length >= 1 && t.length <= 10, "bad ticker length");
        for (uint256 i = 0; i < t.length; i++) {
            require(t[i] >= 0x41 && t[i] <= 0x5A, "ticker must be A-Z");
        }
        (uint256 price, bool isHolder) = priceFor(msg.sender);
        require(usdc.transferFrom(msg.sender, address(this), price), "USDC pull failed");
        bytes32 h = keccak256(t);
        purchases[msg.sender][h] = block.timestamp;
        emit ResearchPurchased(msg.sender, ticker, h, price, isHolder, block.timestamp);
    }

    /// @notice True if `buyer` bought `ticker` within the last ACCESS_WINDOW.
    function hasAccess(address buyer, string calldata ticker) external view returns (bool) {
        uint256 boughtAt = purchases[buyer][keccak256(bytes(ticker))];
        if (boughtAt == 0) return false;
        return block.timestamp < boughtAt + ACCESS_WINDOW;
    }

    /// @notice Owner collects the USDC earned from sales. No other withdrawal path.
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero address");
        require(usdc.transfer(to, amount), "USDC send failed");
        emit Withdrawn(to, amount);
    }

    /// @notice Owner repricing. Holder price must stay below full price.
    function setPrices(uint256 _fullPrice, uint256 _holderPrice) external onlyOwner {
        require(_fullPrice > 0 && _holderPrice > 0, "price zero");
        require(_holderPrice < _fullPrice, "holder must be cheaper");
        fullPrice = _fullPrice;
        holderPrice = _holderPrice;
        emit PricesUpdated(_fullPrice, _holderPrice);
    }
}
