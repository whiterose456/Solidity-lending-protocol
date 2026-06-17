# Solidity Smart Contracts

This directory contains the complete Solidity smart contracts for the lending protocol simulator.

## 📁 Contract Files

### Core Contracts
- **LendingPool.sol** - Main lending protocol contract
  - Handles collateral deposits (ETH)
  - Manages borrowing against collateral (USDC)
  - Processes repayments and debt accrual
  - Executes liquidations for undercollateralized accounts
  - Accrues interest dynamically based on utilization

- **InterestRateModel.sol** - Dynamic interest rate calculator
  - Implements kinked slope model (similar to Compound/Aave)
  - Calculates borrow and supply rates based on utilization
  - Two-slope model: standard slope up to kink, steep jump multiplier above

- **PriceOracle.sol** - Asset price feed contract
  - Provides ETH/USDC price data to the lending pool
  - Owner-controlled for simulation scenarios
  - Allows dynamic price updates for testing different market conditions

### Interface Contracts
- **IPriceOracle.sol** - Interface specification for price oracles
- **IInterestRateModel.sol** - Interface specification for interest rate models

### Test/Mock Contracts
- **MockUSDC.sol** - ERC20 mock token for testing
  - Simulates USDC stablecoin (6 decimals)
  - Includes minting for test scenarios
  - Full ERC20 functionality

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile Contracts
```bash
npm run hardhat:compile
```

### 3. Run Tests
```bash
npm run hardhat:test
```

### 4. Deploy to Local Network
```bash
# Terminal 1: Start local Hardhat node
npm run hardhat:node

# Terminal 2: Deploy contracts
npm run hardhat:deploy
```

## 📊 Contract Architecture

```
LendingPool (Core)
├── IPriceOracle (interface)
│   └── PriceOracle (implementation)
├── IInterestRateModel (interface)
│   └── InterestRateModel (implementation)
└── IERC20 (OpenZeppelin)
    └── MockUSDC (test implementation)
```

## 🔐 Key Security Features

- **ReentrancyGuard** - Prevents reentrancy attacks on critical functions
- **Access Control** - Oracle price updates restricted to owner
- **Safe Math** - Solidity 0.8.20 built-in overflow/underflow protection
- **Health Factor Validation** - Ensures liquidation safety thresholds

## 📝 Key Parameters (Default)

| Parameter | Value | Description |
|-----------|-------|-------------|
| Collateral Factor | 75% | Max LTV (Loan-to-Value) |
| Liquidation Threshold | 80% | Liquidation trigger point |
| Liquidation Penalty | 8% | Bonus to liquidators |
| Base Rate | 2% | Minimum borrow rate |
| Multiplier | 8% | Rate slope up to kink |
| Kink | 80% | Utilization kink point |
| Jump Multiplier | 85% | Steep rate slope above kink |
| Reserve Factor | 10% | Interest redirected to reserves |

## 🧪 Testing

Run the comprehensive test suite:
```bash
npm run hardhat:test
```

Tests cover:
- ETH collateral deposits
- Health factor calculations
- Borrowing mechanics
- Repayment functionality
- Collateral withdrawal safety
- Price oracle updates
- Borrow limit enforcement

## 📖 Documentation

Each contract includes extensive NatSpec comments:
- Function descriptions
- Parameter documentation
- Return value specifications
- Event emissions

## 🔗 Integration with React App

The TypeScript viewer in `/src/components/SolidityCodeViewer.tsx` displays these contracts with syntax highlighting.

You can:
- View contract code in the web UI
- Copy contracts to clipboard
- Download individual contract files
- Reference contracts in your dApp

## 🛠️ Deployment Configuration

See `hardhat.config.ts` for:
- Solidity compiler version (0.8.20)
- Network configurations
- Optimization settings
- Path configurations

## 📚 Further Reading

- [Compound Protocol](https://compound.finance/docs) - Lending pool inspiration
- [Aave Protocol](https://aave.com/) - Liquidation and risk management reference
- [Solidity Docs](https://docs.soliditylang.org/) - Language reference
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/) - Security libraries
