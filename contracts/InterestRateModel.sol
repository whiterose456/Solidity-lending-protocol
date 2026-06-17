// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Jump Rate Model for Dynamic Interest Rate Adjustments
 * @notice Computes interest rates as a function of utilization.
 *         Follows a standard kinked slope model similar to Compound and Aave.
 */
contract InterestRateModel {
    uint256 public constant BaseScale = 1e18;

    uint256 public immutable baseRatePerYear;     // APY at 0% utilization
    uint256 public immutable multiplierPerYear;   // Rate curve slope up to kink
    uint256 public immutable kink;                // Spot where the interest jumps aggressively
    uint256 public immutable jumpMultiplierPerYear; // Aggressive slope post-kink

    constructor(
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear,
        uint256 _kink,
        uint256 _jumpMultiplierPerYear
    ) {
        baseRatePerYear = _baseRatePerYear;
        multiplierPerYear = _multiplierPerYear;
        kink = _kink;
        jumpMultiplierPerYear = _jumpMultiplierPerYear;
    }

    /**
     * @notice Computes utilization rate: Borrows / (Cash + Borrows - Reserves)
     */
    function getUtilizationRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public pure returns (uint256) {
        if (borrows == 0) {
            return 0;
        }
        uint256 totalAssets = cash + borrows - reserves;
        if (totalAssets == 0) return 0;
        return (borrows * BaseScale) / totalAssets;
    }

    /**
     * @notice Gets current borrow APY rate based on system utilization
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public view returns (uint256) {
        uint256 utilization = getUtilizationRate(cash, borrows, reserves);

        if (utilization <= kink) {
            // Standard slope: baseRate + (utilization * multiplier) / kink
            return baseRatePerYear + (utilization * multiplierPerYear) / kink;
        } else {
            // High utilization slope triggered (jump multiplier)
            uint256 standardRate = baseRatePerYear + multiplierPerYear;
            uint256 excessUtil = utilization - kink;
            uint256 jumpShare = (excessUtil * jumpMultiplierPerYear) / (BaseScale - kink);
            return standardRate + jumpShare;
        }
    }

    /**
     * @notice Gets supply APY rate based on system borrows and reserve fees
     */
    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveFactorBps
    ) external view returns (uint256) {
        uint256 utilization = getUtilizationRate(cash, borrows, reserves);
        uint256 borrowRate = getBorrowRate(cash, borrows, reserves);
        
        // Supply APY = borrowRate * utilization * (1 - reserveFactorBps)
        uint256 yieldToSuppliers = (borrowRate * utilization) / BaseScale;
        uint256 reserveShare = (yieldToSuppliers * reserveFactorBps) / 10000;
        
        return yieldToSuppliers - reserveShare;
    }
}
