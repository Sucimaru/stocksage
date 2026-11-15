// SPDX-License-Identifier: MIT
// MockUSDC — TEST ONLY. A minimal USDC-compatible token for local fork tests.
// Implements ERC20 (6 decimals) + EIP-3002 transferWithAuthorization with the
// same EIP-712 domain as Circle USDC (name "USDC", version "2").
// NEVER deploy to mainnet; NEVER use for real value.
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MockUSDC is ERC20, EIP712 {
    mapping(address => uint256) public nonces;
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    constructor() ERC20("USDC", "USDC") EIP712("USDC", "2") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function version() public pure returns (string memory) {
        return "2";
    }

    // TEST ONLY: anyone can mint test tokens on the local fork.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool) {
        require(block.timestamp > validAfter, "authorization not yet valid");
        require(block.timestamp < validBefore, "authorization expired");
        bytes32 structHash = keccak256(
            abi.encode(TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == from, "invalid signature");
        // Mark this nonce as used by storing a sentinel in a separate mapping
        // (reuse nonces mapping as a used-flag keyed by hash of nonce).
        bytes32 nonceKey = keccak256(abi.encodePacked(from, nonce));
        require(_usedNonces[nonceKey] == false, "nonce already used");
        _usedNonces[nonceKey] = true;
        _transfer(from, to, value);
        return true;
    }

    mapping(bytes32 => bool) internal _usedNonces;
}
