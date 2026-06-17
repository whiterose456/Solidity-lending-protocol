// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IPriceOracle.sol";
import "./IInterestRateModel.sol";

/**
 * @title Simplified Compound/Aave-style Lending Pool Contract
 * @notice Performs deposits, dynamic borrowing, debt accrual, and safe liquidations.
 */
contract LendingPool is ReentrancyGuard {
    // Config and External Interfaces
    IERC20 public immutable debtToken;          // Stablecoin borrowed (e.g. USDC)
    IPriceOracle public priceOracle;          // Collateral pricing oracle
    IInterestRateModel public rateModel;      // Dynamic interest rate model

    // State Variables
    uint256 public constant EthDecimals = 18;
    uint256 public constant DebtDecimals = 6;
    uint256 public constant PercentageScale = 10000; // 100% = 10000 (bps)

    uint256 public collateralFactor;     // e.g., 7500 => 75% max borrow
    uint256 public liquidationThreshold; // e.g., 8000 => 80% liquidation floor
    uint256 public liquidationPenalty;   // e.g., 800  => 8% bonus paid to liquidator
    uint256 public reserveFactor;        // e.g., 1000 => 10% of borrow interest goes to reserve

    uint256 public totalCollateralETH;
    uint256 public totalBorrowedDebt;
    uint256 public totalReservesDebt;

    // User Records
    mapping(address => uint256) public userCollateral; // Collateral deposited in ETH (wei)
    mapping(address => uint256) public userPrincipal;  // Principal debt borrowed in USDC (atoms)
    mapping(address => uint256) public userLastInterestIndex; // Track index for accurate interest capture

    // Global Interest Accounting
    uint256 public globalBorrowIndex = 1e18; // Stores compounded borrow rate growth
    uint256 public lastAccrualBlock;

    // Events
    event Deposited(address indexed user, uint256 amountETH);
    event Withdrawn(address indexed user, uint256 amountETH);
    event Borrowed(address indexed user, uint256 amountDebt);
    event Repaid(address indexed user, uint256 amountDebt);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 repayAmountDebt,
        uint256 seizedCollateralETH
    );
    event InterestAccrued(uint256 cash, uint256 borrows, uint256 reserves, uint256 index);

    constructor(
        address _debtToken,
        address _priceOracle,
        address _rateModel,
        uint256 _collateralFactor,
        uint256 _liquidationThreshold,
        uint256 _liquidationPenalty,
        uint256 _reserveFactor
    ) {
        debtToken = IERC20(_debtToken);
        priceOracle = IPriceOracle(_priceOracle);
        rateModel = IInterestRateModel(_rateModel);
        
        collateralFactor = _collateralFactor;
        liquidationThreshold = _liquidationThreshold;
        liquidationPenalty = _liquidationPenalty;
        reserveFactor = _reserveFactor;
        lastAccrualBlock = block.number;
    }

    /**
     * @notice Deposit ETH as collateral to allow borrowing against it.
     */
    function depositCollateral() external payable nonReentrant {
        require(msg.value > 0, "Amount must exceed 0");
        accrueInterest();

        userCollateral[msg.sender] += msg.value;
        totalCollateralETH += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH collateral if user's resulting health factor is safe.
     */
    function withdrawCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must exceed 0");
        require(userCollateral[msg.sender] >= amount, "Insufficient collateral");
        accrueInterest();

        userCollateral[msg.sender] -= amount;
        totalCollateralETH -= amount;

        // Verify safety of remaining collateral
        require(getHealthFactor(msg.sender) >= 1e18, "Unhealthy post-withdrawal ratio");

        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Borrow stablecoins against deposited ETH collateral.
     */
    function borrow(uint256 amountDebt) external nonReentrant {
        require(amountDebt > 0, "Amount must exceed 0");
        accrueInterest();

        // Calculate compounded borrow balance
        uint256 currentBorrow = getBorrowedBalance(msg.sender);
        uint256 newBorrow = currentBorrow + amountDebt;

        // Check if collateral supports this borrowing amount
        uint256 ethPrice = priceOracle.getAssetPrice(); // scaled 1e6
        uint256 ethValueInUsdc = (userCollateral[msg.sender] * ethPrice) / 1e18;
        uint256 maxBorrowAllowed = (ethValueInUsdc * collateralFactor) / PercentageScale;

        require(newBorrow <= maxBorrowAllowed, "Borrow exceeds collateral limit");

        userPrincipal[msg.sender] = newBorrow;
        userLastInterestIndex[msg.sender] = globalBorrowIndex;
        totalBorrowedDebt += amountDebt;

        require(debtToken.transfer(msg.sender, amountDebt), "Token transfer failed");
        emit Borrowed(msg.sender, amountDebt);
    }

    /**
     * @notice Repay borrowed stablecoin to reduce debt.
     */
    function repay(uint256 amountDebt) external nonReentrant {
        require(amountDebt > 0, "Amount must exceed 0");
        accrueInterest();

        uint256 currentBorrow = getBorrowedBalance(msg.sender);
        uint256 repayAmount = amountDebt > currentBorrow ? currentBorrow : amountDebt;

        require(debtToken.transferFrom(msg.sender, address(this), repayAmount), "Transfer failed");

        userPrincipal[msg.sender] = currentBorrow - repayAmount;
        userLastInterestIndex[msg.sender] = globalBorrowIndex;
        totalBorrowedDebt -= repayAmount;

        emit Repaid(msg.sender, repayAmount);
    }

    /**
     * @notice Liquidate undercollateralized accounts where Health Factor < 1.0.
     * @param borrower The address of the unhealthy account.
     * @param repayAmountDebt The amount of stablecoin debt the liquidator wishes to pay off.
     */
    function liquidate(address borrower, uint256 repayAmountDebt) external nonReentrant {
        require(repayAmountDebt > 0, "Amount must exceed 0");
        accrueInterest();

        uint256 healthFactor = getHealthFactor(borrower);
        require(healthFactor < 1e18, "Borrower is still healthy");

        uint256 currentBorrow = getBorrowedBalance(borrower);
        uint256 maxRepay = currentBorrow / 2; // Typically max 50% debt can be liquidated at once
        uint256 finalRepay = repayAmountDebt > maxRepay ? maxRepay : repayAmountDebt;

        // Calculate collateral worth of repaid amount + bonus
        uint256 ethPrice = priceOracle.getAssetPrice(); // stablecoin scale 1e6
        // Collateral to seize = (DebtValue * (1 + bonus)) / ETH Price
        uint256 debtValueInCollateral = (finalRepay * 1e18) / ethPrice;
        uint256 collateralBonus = (debtValueInCollateral * liquidationPenalty) / PercentageScale;
        uint256 totalCollateralToSeize = debtValueInCollateral + collateralBonus;

        require(userCollateral[borrower] >= totalCollateralToSeize, "Oracle pricing failure or system illiquid");

        // Execute settlement
        userCollateral[borrower] -= totalCollateralToSeize;
        totalCollateralETH -= totalCollateralToSeize;

        userPrincipal[borrower] = currentBorrow - finalRepay;
        userLastInterestIndex[borrower] = globalBorrowIndex;
        totalBorrowedDebt -= finalRepay;

        // Liquidator transfers debt token to pool, gets ETH collateral in exchange
        require(debtToken.transferFrom(msg.sender, address(this), finalRepay), "Token transfer failed");
        payable(msg.sender).transfer(totalCollateralToSeize);

        emit Liquidated(borrower, msg.sender, finalRepay, totalCollateralToSeize);
    }

    /**
     * @notice Accrues interest on top of borrows dynamically based on elapsed block height.
     */
    function accrueInterest() public {
        if (block.number <= lastAccrualBlock) return;

        uint256 elapsedBlocks = block.number - lastAccrualBlock;
        lastAccrualBlock = block.number;

        uint256 cash = debtToken.balanceOf(address(this));
        uint256 borrowAPY = rateModel.getBorrowRate(cash, totalBorrowedDebt, totalReservesDebt);

        // Convert APY to block rate (approx 2,102,400 blocks per year on modern mainnets)
        uint256 blockRate = borrowAPY / 2102400;
        uint256 interestAccrued = (totalBorrowedDebt * blockRate * elapsedBlocks) / 1e18;

        totalBorrowedDebt += interestAccrued;
        
        // Add portion to reserves for safety, remaining yields to suppliers
        uint256 reserveShare = (interestAccrued * reserveFactor) / PercentageScale;
        totalReservesDebt += reserveShare;

        // Progress index forward
        globalBorrowIndex = globalBorrowIndex + (globalBorrowIndex * blockRate * elapsedBlocks) / 1e18;

        emit InterestAccrued(cash, totalBorrowedDebt, totalReservesDebt, globalBorrowIndex);
    }

    /**
     * @notice Calculates an account's dynamic Health Factor.
     * @dev Health Factor = (Collateral Value * Liquidation Threshold) / Borrowed Value
     *      Value >= 1e18 is healthy; < 1e18 is liquidatable.
     */
    function getHealthFactor(address user) public view returns (uint256) {
        uint256 borrows = getBorrowedBalance(user);
        if (borrows == 0) return ~uint256(0); // Infinite health if no debt

        uint256 collateral = userCollateral[user];
        if (collateral == 0) return 0;

        uint256 ethPrice = priceOracle.getAssetPrice();
        uint256 collateralValueUsdc = (collateral * ethPrice) / 1e18;
        
        // Collateral limit based on liquidation floor
        uint256 safeBorrowThreshold = (collateralValueUsdc * liquidationThreshold) / PercentageScale;

        return (safeBorrowThreshold * 1e18) / borrows;
    }

    /**
     * @notice Returns compounding borrow balance adjusted for global index progress.
     */
    function getBorrowedBalance(address user) public view returns (uint256) {
        uint256 principal = userPrincipal[user];
        if (principal == 0) return 0;

        uint256 userIndex = userLastInterestIndex[user];
        if (userIndex == 0) return principal;

        return (principal * globalBorrowIndex) / userIndex;
    }

    // Allow ETH deposits directly
    receive() external payable {
        this.depositCollateral();
    }
}
