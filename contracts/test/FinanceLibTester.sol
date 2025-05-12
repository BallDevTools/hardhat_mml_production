// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../FinanceLib.sol";

contract FinanceLibTester {
    function testGetPlanShares(uint256 planId) public pure returns (uint256 userShare, uint256 companyShare) {
        return FinanceLib.getPlanShares(planId);
    }

    function testDistributeFunds(uint256 _amount, uint256 _currentPlanId)
        public
        pure
        returns (
            uint256 ownerShare,
            uint256 feeShare,
            uint256 fundShare,
            uint256 uplineShare
        )
    {
        return FinanceLib.distributeFunds(_amount, _currentPlanId);
    }
}