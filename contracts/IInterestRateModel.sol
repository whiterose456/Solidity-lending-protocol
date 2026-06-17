// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IInterestRateModel
 * @notice Interface for interest rate model contracts used by lending protocols.
 */
interface IInterestRateModel {
    /**
     * @notice Calculate the current borrow rate
     * @param cash Amount of cash available in the pool
     * @param borrows Total amount borrowed
     * @param reserves Total amount in reserves
     * @return The borrow rate per year (scaled to 1e18)
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) external view returns (uint256);
    
    /**
     * @notice Calculate the supply rate for suppliers
     * @param cash Amount of cash available in the pool
     * @param borrows Total amount borrowed
     * @param reserves Total amount in reserves
     * @param reserveFactorBps Reserve factor in basis points
     * @return The supply rate per year (scaled to 1e18)
     */
    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveFactorBps
    ) external view returns (uint256);
    
    /**
     * @notice Get the current utilization rate
     * @param cash Amount of cash available
     * @param borrows Total amount borrowed
     * @param reserves Total amount in reserves
     * @return The utilization rate (scaled to 1e18)
     */
    function getUtilizationRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) external pure returns (uint256);
}
