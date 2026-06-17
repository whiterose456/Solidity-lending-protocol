// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPriceOracle
 * @notice Interface for price oracle contracts that provide asset pricing.
 */
interface IPriceOracle {
    /**
     * @notice Get the current price of the asset
     * @return The price with 6 decimal places (USDC scale)
     */
    function getAssetPrice() external view returns (uint256);
    
    /**
     * @notice Update the asset price (typically restricted to owner)
     * @param _price The new price with 6 decimal places
     */
    function setAssetPrice(uint256 _price) external;
}
