# Solidity Lending Protocol Simulator

An educational, locally runnable DeFi lending protocol built with **Solidity, Hardhat, TypeScript, React, and Vite**. Users deposit ETH as collateral, borrow mock USDC, accrue variable interest, repay debt, and liquidate undercollateralized positions.

> *anot audited and not suitable for real funds or production deployment.

## Protocol at a glance

- **Collateral asset:** ETH (native currency)
- **Debt asset:** Mock USDC (6 decimals)
- **Collateral factor (LTV):** 75%
- **Liquidation threshold:** 80%
- **Liquidation bonus:** 8%
- **Reserve factor:** 10%
- **Interest model:** Utilization-based kinked rate model

The simulator separates the lending pool, price oracle, and interest-rate model so each part can be inspected and tested independently.

## Architecture

```text
                 ┌──────────────────────┐
                 │      React UI        │
                 │ protocol dashboard   │
                 └──────────┬───────────┘
                            │
                 ┌──────────▼───────────┐
                 │     LendingPool      │
                 │ deposits / borrowing │
                 │ repayment/liquidation│
                 └──────┬────────┬─────┘
                        │        │
             ┌──────────▼──┐  ┌──▼────────────────┐
             │ PriceOracle │  │ InterestRateModel │
             │ ETH / USDC  │  │ utilization → rate│
             └─────────────┘  └───────────────────┘
                        │
                 ┌──────▼──────┐
                 │   MockUSDC  │
                 │  ERC-20     │
                 └─────────────┘
```

### Contract responsibilities

| Contract | Responsibility |
|---|---|
| `LendingPool.sol` | Collateral accounting, borrowing, repayment, interest accrual, health factors, and liquidation |
| `InterestRateModel.sol` | Calculates utilization and variable borrow/supply rates |
| `PriceOracle.sol` | Supplies the simulated ETH/USDC price |
| `MockUSDC.sol` | ERC-20 debt token for local development |
| `IPriceOracle.sol`, `IInterestRateModel.sol` | Interfaces used by the pool |

## How the protocol works

1. **Deposit:** A user deposits ETH. The pool records the user's collateral balance.
2. **Borrow:** The pool values the collateral using the oracle and checks the collateral factor before transferring USDC.
3. **Accrue interest:** The pool updates the global borrow index according to the utilization-based annual rate and elapsed blocks.
4. **Repay:** The borrower approves the pool to transfer USDC, then repays some or all outstanding debt.
5. **Withdraw:** Collateral can be withdrawn only if the account remains above the minimum health factor.
6. **Liquidate:** When health factor falls below 1, a liquidator repays eligible debt and receives collateral plus the configured bonus.

## Core formulas

All percentage parameters use basis points (10,000 = 100%). The oracle returns ETH price in USDC with 6 decimals; ETH collateral is denominated in wei.

### Maximum borrowing power

```text
collateralValue = collateralETH(wei) × ethPrice(USDC, 6 decimals) / 1e18
maxBorrow       = collateralValue × collateralFactor / 10,000
```

With ETH at $3,000 and a 75% collateral factor, 1 ETH supports up to 2,250 USDC of debt (before accounting for any existing debt).

### Health factor

```text
healthFactor = collateralValue × liquidationThreshold
               / (10,000 × outstandingDebt)
```

The contract returns this ratio scaled by 1e18. A value at or above 1e18 is healthy; below 1e18 is eligible for liquidation.

### Utilization

```text
utilization = borrows / (cash + borrows - reserves)
```

The kinked interest model increases rates more aggressively after utilization crosses its configured kink. This is intended to discourage borrowing when pool liquidity is scarce.

## Repository structure

```text
contracts/       Solidity contracts and interfaces
scripts/         Local deployment and setup scripts
test/            Hardhat integration tests
src/             React + Vite simulator
hardhat.config.ts Hardhat compiler and network configuration
```

## Run locally

### Requirements

- Node.js 18+
- npm

### Install and start the frontend

```bash
npm install
npm run dev
```

### Compile and test contracts

```bash
npm run hardhat:compile
npm run hardhat:test
```

### Deploy to a local Hardhat node

Terminal 1:

```bash
npm run hardhat:node
```

Terminal 2:

```bash
npm run hardhat:deploy
```

The deployment script deploys MockUSDC, InterestRateModel, PriceOracle, and LendingPool, then seeds the pool with mock liquidity.

## Testing

The integration suite exercises the core lending lifecycle, including:

- ETH collateral deposits through the receive function and explicit deposit function
- Correct collateral accounting
- Health factor for accounts without debt
- Borrow limits and rejection of excessive borrowing
- Debt repayment
- Safe collateral withdrawal
- Oracle price updates

Run the suite with `npm run hardhat:test`.

## Security model and known limitations

This repository is a learning simulator. It intentionally does not claim production-grade security.

- The price oracle is owner-controlled; it is not a decentralized or manipulation-resistant oracle.
- The pool uses a simplified global interest index and block-based linear accrual model.
- There is no full supplier-share accounting or depositor withdrawal queue.
- Liquidation and liquidity management are simplified compared with production lending markets.
- The contracts have not undergone an independent security audit.
- Do not deploy with real assets or private keys holding funds.

Before any production-oriented evolution, prioritize audited oracle integrations, robust interest accounting, access-control review, invariant/fuzz testing, liquidation edge cases, and an independent audit.

## Further reading

- [Solidity documentation](https://docs.soliditylang.org/)
- [Hardhat documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Aave developer documentation](https://docs.aave.com/)
- [Compound documentation](https://docs.compound.finance/)

## License

See the repository license file.
