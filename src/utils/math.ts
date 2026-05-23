/**
 * Dynamic Aave/Compound Math Solver
 */

import { ProtocolParameters } from '../types';

export function calculateUtilizationRate(
  cash: number,
  borrows: number,
  reserves: number
): number {
  if (borrows <= 0) return 0;
  const totalAssets = cash + borrows - reserves;
  if (totalAssets <= 0) return 0;
  return borrows / totalAssets;
}

export function calculateBorrowAPY(
  utilization: number, // 0.0 to 1.0
  params: ProtocolParameters
): number {
  const { baseRate, multiplier, kink, jumpMultiplier } = params;
  
  if (utilization <= kink) {
    if (kink === 0) return baseRate;
    return baseRate + (utilization / kink) * multiplier;
  } else {
    const standardRate = baseRate + multiplier;
    const excessUtil = utilization - kink;
    const denominator = 1.0 - kink;
    if (denominator === 0) return standardRate;
    const jumpShare = (excessUtil / denominator) * jumpMultiplier;
    return standardRate + jumpShare;
  }
}

export function calculateSupplyAPY(
  utilization: number, // 0.0 to 1.0
  params: ProtocolParameters
): number {
  const borrowAPY = calculateBorrowAPY(utilization, params);
  return borrowAPY * utilization * (1 - params.reserveFactor);
}

export interface ChartDataPoint {
  utilization: number; // 0 to 100
  borrowAPY: number;   // 0 to 100 (percentage)
  supplyAPY: number;   // 0 to 100 (percentage)
}

export function generateRateCurveData(params: ProtocolParameters): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  for (let u = 0; u <= 100; u += 2) {
    const uDecimal = u / 100;
    const borrow = calculateBorrowAPY(uDecimal, params) * 100;
    const supply = calculateSupplyAPY(uDecimal, params) * 100;
    data.push({
      utilization: u,
      borrowAPY: parseFloat(borrow.toFixed(2)),
      supplyAPY: parseFloat(supply.toFixed(2)),
    });
  }
  return data;
}

/**
 * Calculates user health factor:
 * Health Factor = (Collateral Value * Liquidation Threshold) / Borrowed Value
 */
export function calculateHealthFactor(
  collateralEth: number,
  borrowedUsdc: number,
  ethPriceUsdc: number,
  liquidationThreshold: number
): number {
  if (borrowedUsdc <= 0) return Infinity;
  if (collateralEth <= 0) return 0;

  const collateralValueUsdc = collateralEth * ethPriceUsdc;
  const safeBorrowThreshold = collateralValueUsdc * liquidationThreshold;
  return safeBorrowThreshold / borrowedUsdc;
}
