// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ContractErrors
 * @dev Custom errors for the CryptoMembershipNFT contract
 */
library ContractErrors {
    // General errors
    error Paused();
    error NotMember();
    error ReentrantTransfer();
    error TooSoon();
    error ZeroAddress();
    error NonTransferable();

    // Plan errors
    error InvalidCycleMembers();
    error EmptyName();
    error ZeroPrice();
    error PriceTooLow();
    error InvalidPlanID();
    error EmptyURI();
    error InactivePlan();
    error NextPlanOnly();
    error NoPlanImage();
    error Plan1Only();

    // Token errors
    error NonexistentToken();

    // Member errors
    error AlreadyMember();
    error CooldownActive();
    error ThirtyDayLock();
    error UplinePlanLow();
    error UplineNotMember();

    // Finance errors 
    error InvalidAmount();
    error LowOwnerBalance();
    error LowFeeBalance();
    error LowFundBalance();
    error InvalidRequest();
    error InvalidRequests();
    error InvalidShares();
    error DistributionError();
    error InvalidDecimals();

    // Withdrawal errors
    error NoRequest();
    error TimelockActive();
    error ZeroBalance();
    error NotPaused();
}