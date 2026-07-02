# Solidity Lending Protocol Simulator

A complete local simulator for an ETH-collateralized lending protocol built with Hardhat, Solidity, and a React/Vite frontend.

## Project Overview

This repository contains:
- A Solidity lending protocol that supports ETH collateral deposits, USDC borrowing, repayment, and liquidations.
- A dynamic interest rate model with utilization-based borrow and supply rates.
- A simple price oracle for ETH/USDC pricing used to calculate borrowing power and liquidation thresholds.
- A React/Vite UI for reviewing protocol state, transaction logs, and smart contract source code.
- Hardhat scripts and tests for deployment and integration validation.

## Key Features

- ETH collateral deposits
- USDC stablecoin borrowing with collateral factor enforcement
- Debt repayment and health factor checks
- Liquidation of undercollateralized positions
- Dynamic interest rates using a kinked slope model
- Mock USDC for local testing
- Frontend simulator with contract code viewer

## Repository Structure

- `contracts/` - Solidity smart contracts and contract-specific documentation
- `scripts/` - Deployment scripts for local Hardhat networks
- `src/` - React application UI source code
- `test/` - Hardhat tests for the lending pool workflow
- `hardhat.config.ts` - Hardhat compiler and network configuration
- `package.json` - Project dependencies and npm scripts

## Setup

### Prerequisites

- Node.js 18+ recommended
- npm

### Install dependencies

```bash
npm install
```

## Local Development

### Run the React app

```bash
npm run dev
```

Then open the local Vite address shown in the terminal (usually `http://localhost:5173`).

### Compile contracts

```bash
npm run hardhat:compile
```

### Run tests

```bash
npm run hardhat:test
```

### Start a local Hardhat node

```bash
npm run hardhat:node
```

### Deploy contracts locally

Open a second terminal and run:

```bash
npm run hardhat:deploy
```

This deploys the following contracts to the local Hardhat network:
- `MockUSDC`
- `InterestRateModel`
- `PriceOracle`
- `LendingPool`

The deployment script also seeds the lending pool with USDC for local simulation.

## Smart Contract Overview

### `contracts/LendingPool.sol`

The main protocol contract that:
- accepts ETH deposits as collateral
- allows users to borrow USDC against collateral
- supports debt repayment and withdrawal of collateral
- enforces health factor checks and liquidation rules

### `contracts/InterestRateModel.sol`

Implements a utilization-based interest model with:
- base borrow rate
- slope multiplier below a utilization kink
- jump multiplier above the kink
- reserve factor support

### `contracts/PriceOracle.sol`

A test oracle for ETH price data used to value collateral and calculate maximum borrow limits.

### `contracts/MockUSDC.sol`

A local ERC20 mock token that simulates USDC and supports minting for tests.

## Frontend Notes

The React app visualizes the protocol state and includes:
- protocol parameter cards
- utilization and APY calculations
- transaction log history
- smart contract code viewer

The frontend source is in `src/`, with UI components stored under `src/components/`.

## Testing

The test suite in `test/LendingPool.test.ts` covers:
- ETH collateral deposits
- borrow limits and health factor checks
- repayment workflows
- price oracle updates
- rejection of unsafe borrow amounts

Run all tests with:

```bash
npm run hardhat:test
```

## Notes

- This project is intended as a simulator and educational example rather than a production-ready lending protocol.
- The oracle is owner-controlled and meant for local testing only.
- Review `contracts/README.md` for contract-level documentation.

## Useful Commands

```bash
npm install
npm run dev
npm run hardhat:compile
npm run hardhat:test
npm run hardhat:node
npm run hardhat:deploy
```
