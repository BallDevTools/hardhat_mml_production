
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ContractErrors.sol";

/**
 * @title MembershipLib
 * @dev Library for managing NFT membership operations
 */
library MembershipLib {
    struct MembershipPlan {
        uint256 price;
        string name;
        uint256 membersPerCycle;
        bool isActive;
    }

    struct Member {
        address upline;
        uint256 totalReferrals;
        uint256 totalEarnings;
        uint256 planId;
        uint256 cycleNumber;
        uint256 registeredAt;
    }

    struct CycleInfo {
        uint256 currentCycle;
        uint256 membersInCurrentCycle;
    }

    /**
     * @dev Updates a membership cycle and returns the current cycle number
     * @param cycleInfo The cycle info storage reference
     * @param plan The membership plan
     * @return The current cycle number
     */
    function updateCycle(
        CycleInfo storage cycleInfo,
        MembershipPlan storage plan
    ) internal returns (uint256) {
        cycleInfo.membersInCurrentCycle++;
        
        if (cycleInfo.membersInCurrentCycle >= plan.membersPerCycle) {
            cycleInfo.currentCycle++;
            cycleInfo.membersInCurrentCycle = 0;
        }
        
        return cycleInfo.currentCycle;
    }

    /**
     * @dev Validates a plan upgrade request
     * @param newPlanId The ID of the target plan
     * @param currentMember The current member data
     * @param plans Mapping of plan IDs to plans
     * @param planCount The total number of plans
     */
    function validatePlanUpgrade(
        uint256 newPlanId,
        Member storage currentMember,
        mapping(uint256 => MembershipPlan) storage plans,
        uint256 planCount
    ) internal view {
        if (newPlanId == 0 || newPlanId > planCount) revert ContractErrors.InvalidPlanID();
        if (!plans[newPlanId].isActive) revert ContractErrors.InactivePlan();
        if (newPlanId != currentMember.planId + 1) revert ContractErrors.NextPlanOnly();
    }

    /**
     * @dev Determines the valid upline for a new member
     * @param upline The proposed upline address
     * @param planId The plan ID of the new member
     * @param sender The address of the new member
     * @param isFirstMember Whether this is the first member registration
     * @param contractOwner The owner of the contract
     * @param members Mapping of addresses to members
     * @param hasBalance Function to check if an address has a balance
     * @return The determined upline address
     */
    function determineUpline(
        address upline,
        uint256 planId,
        address sender,
        bool isFirstMember,
        address contractOwner,
        mapping(address => Member) storage members,
        function(address) external view returns (bool) hasBalance
    ) internal view returns (address) {
        if (isFirstMember) {
            return contractOwner;
        }
        
        if (upline == address(0) || upline == sender) {
            return contractOwner;
        }
        
        if (!hasBalance(upline)) revert ContractErrors.UplineNotMember();
        if (members[upline].planId < planId) revert ContractErrors.UplinePlanLow();
        
        return upline;
    }
}