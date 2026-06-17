// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Price Oracle Contract
 * @notice Provides real-time asset prices (ETH value expressed in USDC with 6 decimals).
 *         Designed for dynamic risk simulations and custom volatility scenarios.
 */
contract PriceOracle is Ownable {
    uint256 private ethPrice; // Scaled to 6 decimal places (e.g. 3500 * 1e6)

    event PriceUpdated(uint256 newPrice);

    constructor(uint256 _initialPrice) Ownable(msg.sender) {
        setAssetPrice(_initialPrice);
    }

    /**
     * @notice Updates the current simulated asset price
     * @param _price The price with 6 decimal places
     */
    function setAssetPrice(uint256 _price) public onlyOwner {
        require(_price > 0, "Price must be non-zero");
        ethPrice = _price;
        emit PriceUpdated(_price);
    }

    /**
     * @notice Retrieves the current asset price used by Lending Pool calculations
     */
    function getAssetPrice() external view returns (uint256) {
        return ethPrice;
    }
}
