// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../NFTMetadataLib.sol";

contract NFTMetadataLibTester {
    function testUint2str(uint256 _i) public pure returns (string memory) {
        return NFTMetadataLib.uint2str(_i);
    }

    function testBase64Encode(bytes memory data) public pure returns (string memory) {
        return NFTMetadataLib.base64Encode(data);
    }
}

