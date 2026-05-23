export interface UserState {
  address: string;
  name: string;
  collateralBalance: number; // in ETH
  borrowedBalance: number;   // in USDC
  initialDeposit: number;    // original ETH deposited
  walletEth: number;         // ETH in user's external wallet
  walletUsdc: number;        // USDC in user's external wallet
}

export interface ProtocolParameters {
  collateralFactorHex: number; // e.g. 0.75 (75%)
  liquidationThreshold: number; // e.g. 0.80 (80%)
  liquidationPenalty: number;   // e.g. 0.08 (8%) bonus to liquidator
  baseRate: number;            // e.g. 0.02 (2% base borrow rate)
  multiplier: number;          // e.g. 0.15 (15% rate slope up to kink)
  kink: number;                // e.g. 0.80 (80% utilization kink)
  jumpMultiplier: number;      // e.g. 1.00 (100% rate slope after kink)
  reserveFactor: number;       // e.g. 0.10 (10% of borrow interest goes to reserves)
}

export interface ProtocolState {
  totalCollateralEth: number;
  totalBorrowedUsdc: number;
  totalReservesUsdc: number;
  ethPriceUsdc: number; // Oracle price of ETH in USDC
  blockNumber: number;
  simulationTimeDays: number;
}

export interface TransactionLog {
  id: string;
  block: number;
  timestamp: string;
  event: 'Deposit' | 'Withdraw' | 'Borrow' | 'Repay' | 'Liquidate' | 'InterestAccrued' | 'OracleUpdate';
  user: string;
  details: string;
  status: 'success' | 'failure';
}
