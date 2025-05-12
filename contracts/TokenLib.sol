// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ContractErrors.sol";

/**
 * @title TokenLib
 * @dev Library for safe token transfers and financial operations
 */
library TokenLib {
    using SafeERC20 for IERC20;

    /**
     * @dev Safely transfers tokens from sender to receiver
     * @param token The ERC20 token contract
     * @param from The sender address
     * @param to The receiver address
     * @param amount The amount to transfer
     */
    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        uint256 balanceBefore = token.balanceOf(to);
        token.safeTransferFrom(from, to, amount);
        
        if (token.balanceOf(to) < balanceBefore + amount) 
            revert ContractErrors.InvalidAmount();
    }

    /**
     * @dev Safely transfers tokens to receiver
     * @param token The ERC20 token contract
     * @param to The receiver address
     * @param amount The amount to transfer
     */
    function safeTransfer(
        IERC20 token,
        address to,
        uint256 amount
    ) internal {
        uint256 balanceBefore = token.balanceOf(to);
        token.safeTransfer(to, amount);
        
        if (token.balanceOf(to) < balanceBefore + amount) 
            revert ContractErrors.InvalidAmount();
    }

    /**
     * @dev Validates a withdrawal request
     * @param requestedAmount The amount requested
     * @param availableBalance The available balance
     */
    function validateWithdrawal(
        uint256 requestedAmount,
        uint256 availableBalance
    ) internal pure {
        if (requestedAmount > availableBalance) {
            revert ContractErrors.LowFundBalance();
        }
    }
}