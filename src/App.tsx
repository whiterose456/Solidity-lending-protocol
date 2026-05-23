import React, { useState, useEffect } from 'react';
import { 
  UserCircle, 
  HelpCircle, 
  ChevronRight, 
  Percent, 
  Coins, 
  ShieldAlert, 
  TrendingUp, 
  Compass, 
  BookOpen, 
  Cpu, 
  Zap, 
  DollarSign, 
  Layers, 
  TrendingDown, 
  Award,
  ArrowRightLeft,
  Settings,
  Info,
  RefreshCw
} from 'lucide-react';
import { UserState, ProtocolParameters, ProtocolState, TransactionLog } from './types';
import { 
  calculateUtilizationRate, 
  calculateBorrowAPY, 
  calculateSupplyAPY, 
  calculateHealthFactor,
  generateRateCurveData 
} from './utils/math';
import { SolidityCodeViewer } from './components/SolidityCodeViewer';
import { TransactionLedger } from './components/TransactionLedger';

export default function App() {
  // Protocol Parameters State
  const [params, setParams] = useState<ProtocolParameters>({
    collateralFactorHex: 0.75, // 75% max LTV
    liquidationThreshold: 0.80, // 80% liquidation trigger floor
    liquidationPenalty: 0.08,  // 8% liquidation bonus
    baseRate: 0.02,           // 2% base interest
    multiplier: 0.08,         // 8% rate slope below kink
    kink: 0.80,               // 80% utilization kink
    jumpMultiplier: 0.85,     // 85% steep jump slope above kink
    reserveFactor: 0.10,      // 10% interest redirect to protocol safety fund
  });

  // Price Feed Oracle
  const [ethPrice, setEthPrice] = useState<number>(3000); // 1 ETH = 3000 USDC

  // Protocol Global State
  const [protocol, setProtocol] = useState<ProtocolState>({
    totalCollateralEth: 3.7, // sum of users' deposits
    totalBorrowedUsdc: 4200, // Alice (1500) + Bob (2700)
    totalReservesUsdc: 0,
    ethPriceUsdc: 3000,
    blockNumber: 19829281,
    simulationTimeDays: 0,
  });

  // Users Database State
  const [users, setUsers] = useState<Record<string, UserState>>({
    alice: {
      address: '0xa11ce51770000000000000000000000000000000',
      name: 'Alice (Conservative)',
      collateralBalance: 2.0,    // 2.0 ETH
      borrowedBalance: 1500,     // 1,500 USDC
      initialDeposit: 2.0,
      walletEth: 8.0,
      walletUsdc: 1000,
    },
    bob: {
      address: '0xb0b517700000000000000000000000000000000',
      name: 'Bob (Highly Leveraged)',
      collateralBalance: 1.2,    // 1.2 ETH (worth 3600 USDC at 3000)
      borrowedBalance: 2700,     // 2,700 USDC (LTV is 75%, maximum borrow)
      initialDeposit: 1.2,
      walletEth: 3.8,
      walletUsdc: 300,
    },
    charlie: {
      address: '0xcc8917700000000000000000000000000000000',
      name: 'Charlie (Stable Saver)',
      collateralBalance: 0,
      borrowedBalance: 0,
      initialDeposit: 0,
      walletEth: 1.0,
      walletUsdc: 15000,
    },
    dillon: {
      address: '0xdd1151770512218491024810243405781204578',
      name: 'Dillon (Liquidator Bot)',
      collateralBalance: 0.5,
      borrowedBalance: 0,
      initialDeposit: 0.5,
      walletEth: 1.5,
      walletUsdc: 8000,
    }
  });

  // Pure USDC deposits outside users (pool initial liquidity provider seed)
  const [seedLiquidityUsdc, setSeedLiquidityUsdc] = useState<number>(10000);

  // Active Selected Wallet User
  const [activeUserKey, setActiveUserKey] = useState<string>('alice');
  const activeUser = users[activeUserKey];

  // Forms Input States
  const [ethAmount, setEthAmount] = useState<string>('');
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [simDays, setSimDays] = useState<string>('30');

  // Interactive logs ledger
  const [logs, setLogs] = useState<TransactionLog[]>([
    {
      id: 'init',
      block: 19829280,
      timestamp: 'Just now',
      event: 'OracleUpdate',
      user: 'Oracle',
      details: 'Price feed seeded: 1 ETH = $3,000.00 USDC',
      status: 'success',
    },
    {
      id: 'seed-liquidity',
      block: 19829281,
      timestamp: 'Just now',
      event: 'Deposit',
      user: '0x00...0000',
      details: 'Pool initialized with $10,000.00 USDC seed liquidity',
      status: 'success',
    },
    {
      id: 'init-alice-collateral',
      block: 19829281,
      timestamp: 'Just now',
      event: 'Deposit',
      user: '0xa11ce51770000000000000000000000000000000',
      details: 'Deposited 2.00 ETH collateral ($6,000.00 value)',
      status: 'success',
    },
    {
      id: 'init-alice-borrow',
      block: 19829281,
      timestamp: 'Just now',
      event: 'Borrow',
      user: '0xa11ce51770000000000000000000000000000000',
      details: 'Borrowed $1,500.00 USDC',
      status: 'success',
    },
    {
      id: 'init-bob-collateral',
      block: 19829281,
      timestamp: 'Just now',
      event: 'Deposit',
      user: '0xb0b517700000000000000000000000000000000',
      details: 'Deposited 1.20 ETH collateral ($3,600.00 value)',
      status: 'success',
    },
    {
      id: 'init-bob-borrow',
      block: 19829281,
      timestamp: 'Just now',
      event: 'Borrow',
      user: '0xb0b517700000000000000000000000000000000',
      details: 'Borrowed $2,700.00 USDC (Leveraged 75% limit)',
      status: 'success',
    }
  ]);

  // Toast / System updates notification
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Auto clear toast after 5s
  useEffect(() => {
    if (alertMsg) {
      const t = setTimeout(() => setAlertMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [alertMsg]);

  // Derived Values
  // In a model where seed + Charlie supplies USDC:
  const totalUsdcDeposited = seedLiquidityUsdc; 
  const totalBorrowedUsdc = (Object.values(users) as UserState[]).reduce((acc, u) => acc + u.borrowedBalance, 0);
  const totalCollateralEth = (Object.values(users) as UserState[]).reduce((acc, u) => acc + u.collateralBalance, 0);

  // Cash in the pool is what's left
  const poolCashUsdc = Math.max(0, totalUsdcDeposited - totalBorrowedUsdc);

  // Utilization Rate
  const utilization = calculateUtilizationRate(poolCashUsdc, totalBorrowedUsdc, protocol.totalReservesUsdc);
  const currentBorrowAPY = calculateBorrowAPY(utilization, params);
  const currentSupplyAPY = calculateSupplyAPY(utilization, params);

  // Update ETH Price Oracle
  const triggerPriceChange = (newPrice: number) => {
    setEthPrice(newPrice);
    setProtocol(prev => ({
      ...prev,
      ethPriceUsdc: newPrice,
      blockNumber: prev.blockNumber + 1
    }));
    
    // Add transaction log
    addLog('OracleUpdate', 'Oracle', `Price feed updated: 1 ETH = $${newPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC`, 'success');
    
    // Check if any users got liquidated
    let warningThrown = false;
    (Object.entries(users) as [string, UserState][]).forEach(([key, user]) => {
      const hf = calculateHealthFactor(user.collateralBalance, user.borrowedBalance, newPrice, params.liquidationThreshold);
      if (hf < 1.0 && user.borrowedBalance > 0) {
        setAlertMsg({
          text: `Risk Alert! ${user.name}'s Health Factor dropped or stayed below 1.0 (${hf.toFixed(2)})! Liquidator can now resolve their debt.`,
          type: 'warning'
        });
        warningThrown = true;
      }
    });

    if (!warningThrown) {
      setAlertMsg({
        text: `ETH Oracle price updated to $${newPrice.toLocaleString('en-US')} USDC. All healthy positions adjusted.`,
        type: 'success'
      });
    }
  };

  const addLog = (
    event: TransactionLog['event'], 
    user: string, 
    details: string, 
    status: 'success' | 'failure'
  ) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newLog: TransactionLog = {
      id: `${event}-${Date.now()}-${Math.random()}`,
      block: protocol.blockNumber + 1,
      timestamp,
      event,
      user,
      details,
      status,
    };
    setLogs(prev => [newLog, ...prev]);
    setProtocol(prev => ({ ...prev, blockNumber: prev.blockNumber + 1 }));
  };

  // Deposit Collateral ETH
  const handleDepositCollateral = () => {
    const amount = parseFloat(ethAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setAlertMsg({ text: "Please enter a valid ETH amount", type: "error" });
      return;
    }
    if (activeUser.walletEth < amount) {
      setAlertMsg({ text: "Insufficient ETH in external wallet", type: "error" });
      return;
    }

    // Accrue interest first to represent smart contract logic
    accrueInterestInternal(0);

    setUsers(prev => ({
      ...prev,
      [activeUserKey]: {
        ...prev[activeUserKey],
        walletEth: parseFloat((prev[activeUserKey].walletEth - amount).toFixed(4)),
        collateralBalance: parseFloat((prev[activeUserKey].collateralBalance + amount).toFixed(4)),
      }
    }));

    addLog('Deposit', activeUser.address, `Deposited ${amount.toFixed(3)} ETH collateral`, 'success');
    setAlertMsg({ text: `Successfully deposited ${amount} ETH collateral!`, type: "success" });
    setEthAmount('');
  };

  // Withdraw Collateral ETH
  const handleWithdrawCollateral = () => {
    const amount = parseFloat(ethAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setAlertMsg({ text: "Please enter a valid ETH amount", type: "error" });
      return;
    }
    if (activeUser.collateralBalance < amount) {
      setAlertMsg({ text: "Insufficient collateral balance in protocol", type: "error" });
      return;
    }

    accrueInterestInternal(0);

    // Calculate post Health Factor
    const postCollateral = activeUser.collateralBalance - amount;
    const postHealthFactor = calculateHealthFactor(
      postCollateral, 
      activeUser.borrowedBalance, 
      ethPrice, 
      params.liquidationThreshold
    );

    if (postHealthFactor < 1.0) {
      setAlertMsg({ 
        text: `Cannot withdraw! This would lower your health factor to ${postHealthFactor.toFixed(2)}, which violates the protocol's 80% liquidation threshold.`, 
        type: "error" 
      });
      return;
    }

    setUsers(prev => ({
      ...prev,
      [activeUserKey]: {
        ...prev[activeUserKey],
        walletEth: parseFloat((prev[activeUserKey].walletEth + amount).toFixed(4)),
        collateralBalance: parseFloat((prev[activeUserKey].collateralBalance - amount).toFixed(4)),
      }
    }));

    addLog('Withdraw', activeUser.address, `Withdrew ${amount.toFixed(3)} ETH collateral`, 'success');
    setAlertMsg({ text: `Successfully withdrew ${amount} ETH collateral!`, type: "success" });
    setEthAmount('');
  };

  // Supply USDC Liquidity
  const handleSupplyUsdc = () => {
    const amount = parseFloat(usdcAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setAlertMsg({ text: "Please enter a valid USDC amount", type: "error" });
      return;
    }
    if (activeUser.walletUsdc < amount) {
      setAlertMsg({ text: "Insufficient USDC in active wallet", type: "error" });
      return;
    }

    accrueInterestInternal(0);

    setUsers(prev => ({
      ...prev,
      [activeUserKey]: {
        ...prev[activeUserKey],
        walletUsdc: prev[activeUserKey].walletUsdc - amount,
      }
    }));
    
    // In this pool model, USDC supplies represent the liquidity base
    setSeedLiquidityUsdc(prev => prev + amount);

    addLog('Deposit', activeUser.address, `Supplied $${amount.toLocaleString()} USDC liquidity to pool`, 'success');
    setAlertMsg({ text: `Successfully supplied $${amount.toLocaleString()} USDC to earn yield!`, type: "success" });
    setUsdcAmount('');
  };

  // Withdraw USDC Liquidity
  const handleWithdrawUsdc = () => {
    const amount = parseFloat(usdcAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setAlertMsg({ text: "Please enter a valid USDC amount", type: "error" });
      return;
    }

    // Suppliers are capped by available liquidity in pool
    if (amount > poolCashUsdc) {
      setAlertMsg({ text: `Cannot withdraw! Pool only has $${poolCashUsdc.toLocaleString()} USDC idle cash.`, type: "error" });
      return;
    }

    // Since this is a simple simulator, user can withdraw up to what they've added or seed liquidity
    if (amount > seedLiquidityUsdc) {
      setAlertMsg({ text: `Withdrawal amount exceeds pool's total supplier parameters`, type: "error" });
      return;
    }

    accrueInterestInternal(0);

    setUsers(prev => ({
      ...prev,
      [activeUserKey]: {
        ...prev[activeUserKey],
        walletUsdc: prev[activeUserKey].walletUsdc + amount,
      }
    }));

    setSeedLiquidityUsdc(prev => prev - amount);

    addLog('Withdraw', activeUser.address, `Withdrew $${amount.toLocaleString()} USDC liquidity from pool`, 'success');
    setAlertMsg({ text: `Successfully withdrew $${amount.toLocaleString()} USDC from pool!`, type: "success" });
    setUsdcAmount('');
  };

  // Borrow USDC against ETH Collateral
  const handleBorrowUsdc = () => {
    const amount = parseFloat(usdcAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setAlertMsg({ text: "Please enter a valid USDC amount", type: "error" });
      return;
    }

    if (amount > poolCashUsdc) {
      setAlertMsg({ text: "Insufficent Liquidity in Pool! Try supplying USDC first to seed the lender pool.", type: "error" });
      return;
    }

    accrueInterestInternal(0);

    // Calculate Max Borrow based on Collateral Factor (75%)
    const maxLtvValueUsdc = activeUser.collateralBalance * ethPrice * params.collateralFactorHex;
    const currentBorrow = activeUser.borrowedBalance;
    const remainingBorrowCapacity = maxLtvValueUsdc - currentBorrow;

    if (amount > remainingBorrowCapacity) {
      setAlertMsg({ 
        text: `Borrow exceeds collateral factor limits! Your maximum remaining borrow capacity is $${Math.max(0, remainingBorrowCapacity).toFixed(2)} USDC.`, 
        type: "error" 
      });
      return;
    }

    setUsers(prev => ({
      ...prev,
      [activeUserKey]: {
        ...prev[activeUserKey],
        walletUsdc: prev[activeUserKey].walletUsdc + amount,
        borrowedBalance: prev[activeUserKey].borrowedBalance + amount,
      }
    }));

    addLog('Borrow', activeUser.address, `Borrowed $${amount.toLocaleString()} USDC against collateral`, 'success');
    setAlertMsg({ text: `Successfully borrowed $${amount.toLocaleString()} USDC!`, type: "success" });
    setUsdcAmount('');
  };

  // Repay USDC debt
  const handleRepayUsdc = () => {
    const amount = parseFloat(usdcAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setAlertMsg({ text: "Please enter a valid USDC amount", type: "error" });
      return;
    }

    if (activeUser.walletUsdc < amount) {
      setAlertMsg({ text: "Insufficient USDC tokens in wallet to repay debt", type: "error" });
      return;
    }

    accrueInterestInternal(0);

    const actualRepay = Math.min(amount, activeUser.borrowedBalance);

    setUsers(prev => ({
      ...prev,
      [activeUserKey]: {
        ...prev[activeUserKey],
        walletUsdc: prev[activeUserKey].walletUsdc - actualRepay,
        borrowedBalance: prev[activeUserKey].borrowedBalance - actualRepay,
      }
    }));

    addLog('Repay', activeUser.address, `Repaid $${actualRepay.toLocaleString()} USDC of borrowed debt`, 'success');
    setAlertMsg({ text: `Successfully repaid $${actualRepay.toLocaleString()} USDC of debt!`, type: "success" });
    setUsdcAmount('');
  };

  // Trigger Accrued Interest (Simulation time warp)
  const handleTimeWarp = () => {
    const days = parseInt(simDays);
    if (!days || isNaN(days) || days <= 0) {
      setAlertMsg({ text: "Please enter a valid number of days", type: "error" });
      return;
    }

    accrueInterestInternal(days);
    setAlertMsg({ text: `Successfully compiled state & accrued dynamic compound interest for ${days} days!`, type: "success" });
  };

  const accrueInterestInternal = (days: number) => {
    if (days === 0 && totalBorrowedUsdc === 0) return;

    // Standard block progression
    const blocksElapsed = days > 0 ? (days * 7200) : 100; // ~7200 ethereum blocks per day
    const timeProgressed = days > 0 ? days : 0.013; // equivalent fractional day progress

    // Compound over elapsed duration based on current Borrow APY
    const rateFactor = (currentBorrowAPY * (timeProgressed / 365));

    // Calculate total interest amount generated
    const totalNewInterest = totalBorrowedUsdc * rateFactor;
    if (totalNewInterest <= 0) return;

    const reserveShare = totalNewInterest * params.reserveFactor;
    const supplierYieldShare = totalNewInterest - reserveShare;

    // Update balances of active borrowers
    setUsers(prev => {
      const updated: Record<string, UserState> = {};
      Object.keys(prev).forEach(key => {
        const u = prev[key];
        updated[key] = {
          ...u,
          borrowedBalance: u.borrowedBalance > 0
            ? Math.round(u.borrowedBalance * (1 + rateFactor) * 100) / 100
            : u.borrowedBalance
        };
      });
      return updated;
    });

    // Supplier yield share compound represents growth in pool liquidity base
    setSeedLiquidityUsdc(prev => prev + supplierYieldShare);

    // Update protocol ledger
    setProtocol(prev => ({
      ...prev,
      totalReservesUsdc: prev.totalReservesUsdc + reserveShare,
      blockNumber: prev.blockNumber + blocksElapsed,
      simulationTimeDays: parseFloat((prev.simulationTimeDays + timeProgressed).toFixed(2))
    }));

    addLog(
      'InterestAccrued', 
      '0x00...0000', 
      `Accrued $${totalNewInterest.toFixed(2)} total interest over ${days > 0 ? `${days} days` : '100 blocks'} (Reserves: +$${reserveShare.toFixed(2)}, Supplier Rewards: +$${supplierYieldShare.toFixed(2)})`, 
      'success'
    );
  };

  // Perform Liquidation Action
  const handleLiquidate = (borrowerKey: string) => {
    const borrower = users[borrowerKey];
    const hf = calculateHealthFactor(borrower.collateralBalance, borrower.borrowedBalance, ethPrice, params.liquidationThreshold);
    
    if (hf >= 1.0) {
      setAlertMsg({ text: `${borrower.name}'s Health Factor is safe (${hf.toFixed(2)}). Only unhealthy accounts (< 1.0) can be liquidated.`, type: "error" });
      return;
    }

    // Dillon matches the liquidator address
    const liquidatorKey = 'dillon';
    const liquidator = users[liquidatorKey];

    // Liquidator pays up to 50% of borrower's debt
    const debtToLiquidate = borrower.borrowedBalance / 2;
    
    if (liquidator.walletUsdc < debtToLiquidate) {
      setAlertMsg({ text: `Liquidator Dillon has insufficient USDC ($${liquidator.walletUsdc.toLocaleString()}) to cover the 50% debt payoff ($${debtToLiquidate.toLocaleString()} USDC).`, type: "error" });
      return;
    }

    // Calculate collateral seized by liquidator = debt value paid in ETH + 8% liquidator bonus penalty
    const debtValueInEth = debtToLiquidate / ethPrice;
    const bonusCollateralEth = debtValueInEth * params.liquidationPenalty;
    const totalSeizedEth = debtValueInEth + bonusCollateralEth;

    if (borrower.collateralBalance < totalSeizedEth) {
      setAlertMsg({ text: "Oracle error: Borrower has insufficient collateral to satisfy the liquidator bonus.", type: "error" });
      return;
    }

    // Settle accounts
    setUsers(prev => ({
      ...prev,
      [borrowerKey]: {
        ...prev[borrowerKey],
        borrowedBalance: parseFloat((prev[borrowerKey].borrowedBalance - debtToLiquidate).toFixed(2)),
        collateralBalance: parseFloat((prev[borrowerKey].collateralBalance - totalSeizedEth).toFixed(4))
      },
      [liquidatorKey]: {
        ...prev[liquidatorKey],
        walletUsdc: parseFloat((prev[liquidatorKey].walletUsdc - debtToLiquidate).toFixed(2)),
        walletEth: parseFloat((prev[liquidatorKey].walletEth + totalSeizedEth).toFixed(4))
      }
    }));

    addLog(
      'Liquidate', 
      liquidator.address, 
      `Liquidated ${borrower.name}. Paid $${debtToLiquidate.toFixed(2)} USDC, seized ${totalSeizedEth.toFixed(4)} ETH ($${(totalSeizedEth * ethPrice).toFixed(2)} value including penalty)`, 
      'success'
    );

    setAlertMsg({ 
      text: `Liquidation executed! Dillon successfully absorbed $${debtToLiquidate.toFixed(2)} USDC debt for ${totalSeizedEth.toFixed(3)} ETH collateral reward.`, 
      type: "success" 
    });
  };

  // Helper Walkthrough Scenarios
  const runScenario = (scenarioId: string) => {
    // Reset or execute custom situations
    if (scenarioId === 'leverage_shifter') {
      // Bob stakes everything and borrows maximum USDC
      setUsers(prev => ({
        ...prev,
        bob: {
          address: '0xb0b517700000000000000000000000000000000',
          name: 'Bob (Highly Leveraged)',
          collateralBalance: 1.5, // 1.5 ETH ($4,500 collateral)
          borrowedBalance: 3300,  // Or maximum (collateral factor limit at 3000 price is 1.5 * 3000 * 0.75 = 3375 USDC)
          initialDeposit: 1.5,
          walletEth: 3.5,
          walletUsdc: 0
        }
      }));
      setEthPrice(3000);
      addLog('Deposit', '0xb0b517700000000000000000000000000000000', 'Bob leveraged scenario: Added 1.50 ETH and borrowed $3,300 USDC', 'success');
      setAlertMsg({ text: "Bob is now set at critical 73% Loan-to-Value (LTV). Any small slide in ETH price will trigger liquidation!", type: "success" });
    } else if (scenarioId === 'price_crash') {
      // Drop eth price to 2300, thrusting Bob below 1.0 health factor
      triggerPriceChange(2250);
      setAlertMsg({ text: "Ethereum price dropped to $2,250! Check Bob's health factor—it is now below 1.0. Liquidator is ready!", type: "warning" });
    } else if (scenarioId === 'credit_crunch') {
      // Massive borrows to push utilization near 95%
      setSeedLiquidityUsdc(5000); // lower pool suppliers
      setUsers(prev => ({
        ...prev,
        bob: {
          ...prev.bob,
          borrowedBalance: 4600 // borrows high
        }
      }));
      setAlertMsg({ text: "Supplies collapsed & Bob borrows bloated! Utilization spiked. See the interest rate jump dynamically!", type: "success" });
    }
  };

  // Custom SVG Plot Coordinates Generator representing double slope kink model
  const curveDataPoints = generateRateCurveData(params);
  const currentUtilPercent = Math.round(utilization * 100);

  // Map utilization coordinate to SVG pixels for overlay circle
  // SVG width = 500, height = 240
  const getSvgX = (utilPercent: number) => {
    return 40 + (utilPercent / 100) * 420;
  };

  const getSvgY = (ratePercent: number) => {
    // scale max APY to 120%
    return 200 - (ratePercent / 120) * 160;
  };

  // Generate path string for Borrow rate
  let borrowCurvePath = '';
  // Generate path string for Supply rate
  let supplyCurvePath = '';

  curveDataPoints.forEach((pt, i) => {
    const x = getSvgX(pt.utilization);
    const borrowY = getSvgY(pt.borrowAPY);
    const supplyY = getSvgY(pt.supplyAPY);

    if (i === 0) {
      borrowCurvePath = `M ${x} ${borrowY}`;
      supplyCurvePath = `M ${x} ${supplyY}`;
    } else {
      borrowCurvePath += ` L ${x} ${borrowY}`;
      supplyCurvePath += ` L ${x} ${supplyY}`;
    }
  });

  const activeBorrowAPY = currentBorrowAPY * 100;
  const activeSupplyAPY = currentSupplyAPY * 100;
  const currentCircleX = getSvgX(currentUtilPercent);
  const currentCircleYBorrow = getSvgY(activeBorrowAPY);
  const currentCircleYSupply = getSvgY(activeSupplyAPY);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Top Banner Alert / Toast */}
      {alertMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-2xl transition-all duration-300 max-w-sm font-sans text-xs ${
          alertMsg.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' 
            : alertMsg.type === 'error'
            ? 'bg-red-950/90 border-red-800 text-red-200'
            : 'bg-amber-950/95 border-amber-700 text-amber-200'
        }`}>
          <div className="p-1 rounded-full bg-black/20">
            <Zap className={`w-4 h-4 ${alertMsg.type === 'success' ? 'text-emerald-400' : alertMsg.type === 'error' ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div>{alertMsg.text}</div>
        </div>
      )}

      {/* Primary Application Header */}
      <header className="border-b border-zinc-850 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Cpu className="w-5 h-5 text-indigo-50" />
            </div>
            <div>
              <h1 className="text-base font-bold font-sans tracking-tight text-zinc-100 flex items-center gap-1.5 leading-none">
                Solidity Lending Protocol 
                <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                  v2.0 JumpRate
                </span>
              </h1>
              <p className="text-[11px] text-zinc-400 mt-1">Compound & Aave Math Integration & Interactive Sandboxed EVM</p>
            </div>
          </div>

          {/* Time & Price HUD metrics */}
          <div className="flex items-center gap-2.5">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-1.5 text-right shrink-0">
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Blocks Simulated</div>
              <div className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                {protocol.blockNumber.toLocaleString()}
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-1.5 text-right shrink-0">
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Chain Accrued Delay</div>
              <div className="text-xs font-mono font-bold text-zinc-300">
                {protocol.simulationTimeDays.toFixed(1)} Days
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
        
        {/* State Panel Overview Banner */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          
          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">ETH Price Oracle</span>
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-bold font-mono text-zinc-100">${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-[10px] text-zinc-500 mt-1">USD per ETH Feed</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">Pool Utilization</span>
              <Percent className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-bold font-mono text-sky-400">
                {currentUtilPercent}%
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                USDC Borrows: <b className="text-zinc-300">${totalBorrowedUsdc.toLocaleString()}</b>
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">Borrow APY (Dynamic)</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-bold font-mono text-amber-400">
                {activeBorrowAPY.toFixed(2)}%
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Variable interest cost</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">Supply APY (Earnings)</span>
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-bold font-mono text-emerald-400">
                {activeSupplyAPY.toFixed(2)}%
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Yield distributed to Suppliers</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl col-span-2 lg:col-span-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">System Cash Liquidity</span>
              <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-bold font-mono text-indigo-300">
                ${poolCashUsdc.toLocaleString()}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                Total supplied: <b className="text-zinc-300">${totalUsdcDeposited.toLocaleString()}</b>
              </p>
            </div>
          </div>

        </section>

        {/* Dynamic Sandbox Walkthrough Guide / Scenarios */}
        <section className="bg-indigo-950/20 border border-indigo-900/45 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 font-sans uppercase tracking-wider">
                DeFi Risk simulation walkthroughs
              </h4>
              <p className="text-xs text-indigo-200/85 mt-0.5 max-w-xl">
                Quick-launch simulated stress tests to understand smart contract liquidation thresholds, loan parameters, and interest multipliers.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => runScenario('leverage_shifter')}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-sans font-medium rounded-lg text-zinc-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              1. Leveraged Bob State
            </button>
            <button
              onClick={() => runScenario('price_crash')}
              className="px-3 py-2 bg-red-950/30 hover:bg-red-950/50 border border-red-900/60 text-[11px] font-sans font-medium rounded-lg text-red-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              2. Crash Collateral ETH
            </button>
            <button
              onClick={() => runScenario('credit_crunch')}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-sans font-medium rounded-lg text-zinc-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
              3. Spurt Credit Crunch
            </button>
          </div>
        </section>

        {/* Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Environment Parameters, Select Active Wallet, and Action Forms */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* 1. Protocol Controllers */}
            <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zinc-450" />
                  <h3 className="font-semibold text-zinc-200 text-sm tracking-tight uppercase font-mono text-xs">EVM Control & Parameter Board</h3>
                </div>
                <div className="text-[10px] text-zinc-500 italic">Adjust variables live</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ETH Price slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono">ETH Price Oracle (USDC)</span>
                    <span className="font-bold font-mono text-indigo-400">${ethPrice.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="1500"
                    max="4500"
                    step="50"
                    value={ethPrice}
                    onChange={(e) => triggerPriceChange(Number(e.target.value))}
                    className="w-full accent-indigo-500 bg-zinc-800 rounded-lg outline-none cursor-pointer h-1.5"
                  />
                  <span className="text-[9px] text-zinc-500 italic">Slide left to triggers Bob's undercollateralization!</span>
                </div>

                {/* Collateral Factor (LTV limit) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono">Collateral Factor (Max LTV)</span>
                    <span className="font-bold font-mono text-indigo-450">{Math.round(params.collateralFactorHex * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.85"
                    step="0.05"
                    value={params.collateralFactorHex}
                    onChange={(e) => setParams(prev => ({ ...prev, collateralFactorHex: Number(e.target.value) }))}
                    className="w-full accent-indigo-500 bg-zinc-800 rounded-lg outline-none cursor-pointer h-1.5"
                  />
                  <span className="text-[9px] text-zinc-500 italic">Limit debt borrowers can build per ETH stake</span>
                </div>

                {/* Time Fast Forward */}
                <div className="sm:col-span-2 border-t border-zinc-850 pt-3.5 mt-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-950/40 p-3 rounded-lg">
                  <div className="text-xs text-zinc-400 flex items-center gap-1.5 shrink-0 font-sans">
                    <Info className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Interest Time Warp Accruals:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Days"
                      value={simDays}
                      onChange={(e) => setSimDays(e.target.value)}
                      className="w-20 text-xs bg-zinc-900 border border-zinc-800 px-2 pl-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-600 text-zinc-200 font-mono text-center"
                    />
                    <button
                      onClick={handleTimeWarp}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded transition-all cursor-pointer inline-flex items-center gap-1 font-mono"
                    >
                      <RefreshCw className="w-3 h-3 text-white" />
                      Warp Time
                    </button>
                    <button
                      onClick={() => accrueInterestInternal(0)}
                      className="px-2.5 py-1.5 bg-zinc-855 hover:bg-zinc-800 border border-zinc-800 text-[11px] rounded transition-all text-zinc-350 cursor-pointer font-mono"
                    >
                      +100 Blks
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* 2. Interactive Accounts & Asset Balances */}
            <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4.5">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-zinc-450" />
                  <h3 className="font-semibold text-zinc-200 text-sm tracking-tight uppercase font-mono text-xs">Simulated Metamask Accounts</h3>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono bg-zinc-950 px-2 py-0.5 rounded">
                  Choose Active Account
                </span>
              </div>

              {/* Account Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {(Object.entries(users) as [string, UserState][]).map(([key, user]) => {
                  const hf = calculateHealthFactor(user.collateralBalance, user.borrowedBalance, ethPrice, params.liquidationThreshold);
                  const isUnhealthy = hf < 1.0 && user.borrowedBalance > 0;
                  const isWarning = hf >= 1.0 && hf < 1.3 && user.borrowedBalance > 0;
                  const maxBorrow = user.collateralBalance * ethPrice * params.collateralFactorHex;
                  const ltvPercent = maxBorrow > 0 ? (user.borrowedBalance / (user.collateralBalance * ethPrice)) * 100 : 0;

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setActiveUserKey(key);
                        setAlertMsg({ text: `Switched MetaMask to ${user.name}`, type: 'success' });
                      }}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-34 ${
                        activeUserKey === key
                          ? 'bg-zinc-900 border-indigo-500/80 ring-1 ring-indigo-500/20 shadow-lg'
                          : 'bg-zinc-950 hover:bg-zinc-900/60 border-zinc-850 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full gap-2">
                        <div>
                          <span className="font-mono text-[10px] block text-zinc-500 mb-0.5">
                            {user.address.slice(0, 6)}...{user.address.slice(-4)}
                          </span>
                          <span className={`text-xs font-bold font-sans tracking-tight ${activeUserKey === key ? 'text-indigo-300' : 'text-zinc-200'}`}>
                            {user.name.split(' (')[0]}
                          </span>
                          <span className="text-[9px] block text-zinc-450 font-sans italic mt-0.5">
                            {user.name.includes('Conservative') ? 'Balanced deposits' : user.name.includes('Leveraged') ? 'Stakes volatile ETH' : user.name.includes('Stable') ? 'Pure stable coin asset' : 'Runs liquidator triggers'}
                          </span>
                        </div>
                        
                        {/* Selected Radio Indicator / Badge */}
                        <div className="shrink-0 flex flex-col items-end">
                          <span className={`w-2.5 h-2.5 rounded-full ${activeUserKey === key ? 'bg-indigo-500 ring-4 ring-indigo-500/10' : 'bg-zinc-800'}`} />
                        </div>
                      </div>

                      {/* State metrics inside account selector */}
                      <div className="mt-2 text-right border-t border-zinc-850/80 pt-2 flex items-center justify-between w-full">
                        <div className="text-[10px] text-zinc-400">
                          Debt/Max: <span className="font-mono text-zinc-300 font-bold">${user.borrowedBalance.toFixed(0)}/${maxBorrow.toFixed(0)}</span>
                        </div>

                        {/* Health Factor Badge */}
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">HF</span>
                          {user.borrowedBalance === 0 ? (
                            <span className="text-zinc-500 font-semibold font-mono text-xs">∞</span>
                          ) : (
                            <span className={`font-bold font-mono text-xs px-1.5 py-0.2 rounded ${
                              isUnhealthy 
                                ? 'text-red-400 bg-red-950/40 border border-red-900/30' 
                                : isWarning 
                                ? 'text-amber-400 bg-amber-950/40 border border-amber-905/30' 
                                : 'text-emerald-400 bg-emerald-950/40 border border-emerald-905/30'
                            }`}>
                              {hf.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Wallet asset totals */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850/80 flex flex-col gap-3 font-mono text-xs leading-relaxed">
                <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest pb-1 border-b border-zinc-850">
                  <span>MetaMask Wallet Assets</span>
                  <span>Smart Contract Protocol Balances</span>
                </div>
                
                {/* Collateral ETH row */}
                <div className="flex justify-between items-center py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-zinc-400 font-sans">ETH (Collateral asset)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-zinc-300 font-bold">{activeUser.walletEth.toFixed(3)} ETH</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-indigo-300 font-bold bg-indigo-950/45 px-2 py-0.5 rounded border border-indigo-900/30">
                      {activeUser.collateralBalance.toFixed(3)} ETH
                    </span>
                  </div>
                </div>

                {/* USDC row */}
                <div className="flex justify-between items-center py-0.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-zinc-400 font-sans">USDC (Stable coin tokens)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-zinc-300 font-bold">${activeUser.walletUsdc.toLocaleString()}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-605" />
                    <span className="text-emerald-400 font-bold bg-emerald-950/45 px-2 py-0.5 rounded border border-emerald-900/30">
                      Borrows: ${activeUser.borrowedBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. EVM Transactions Control Tabs */}
            <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-zinc-850 pb-3 mb-4.5">
                <ArrowRightLeft className="w-4 h-4 text-zinc-450" />
                <h3 className="font-semibold text-zinc-200 text-sm tracking-tight uppercase font-mono text-xs">Simulated Wallet Interaction</h3>
              </div>

              {/* Transactions grid list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Box A: Collateral ETH Actions */}
                <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-855 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-3 bg-indigo-500 rounded-sm" />
                      Staking Collateral (ETH)
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-1 italic font-sans leading-relaxed">
                      Deposit ETH to enable USDC stablecoin borrows against it safely or withdraw back into metamask wallet.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00 ETH"
                        value={ethAmount}
                        onChange={(e) => setEthAmount(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 rounded pl-3 pr-20 py-2 text-zinc-200 focus:outline-none focus:border-indigo-650"
                      />
                      <div className="absolute right-2 top-2 text-[10px] font-mono text-zinc-550 flex items-center gap-1.5">
                        <button 
                          onClick={() => setEthAmount(activeUser.walletEth.toString())}
                          className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 hover:text-zinc-100 cursor-pointer"
                        >
                          Max
                        </button>
                        <span>ETH</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleDepositCollateral}
                        className="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded transition-all cursor-pointer font-sans"
                      >
                        Deposit Collateral
                      </button>
                      <button
                        onClick={handleWithdrawCollateral}
                        className="w-full text-center py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-250 font-semibold text-xs rounded transition-all cursor-pointer font-sans"
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>

                {/* Box B: USDC Liquidity / Supplier Actions */}
                <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-855 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-3 bg-emerald-500 rounded-sm" />
                      Supply USDC Liquidity
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-1 italic font-sans leading-relaxed">
                      Supply cash to the lender pools to earn the dynamic variable supply APY based on total borrows utilization.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00 USDC"
                        value={usdcAmount}
                        onChange={(e) => setUsdcAmount(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 rounded pl-3 pr-20 py-2 text-zinc-200 focus:outline-none focus:border-indigo-650"
                      />
                      <div className="absolute right-2 top-2 text-[10px] font-mono text-zinc-550 flex items-center gap-1.5">
                        <button 
                          onClick={() => setUsdcAmount(activeUser.walletUsdc.toString())}
                          className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-350 hover:text-zinc-100 cursor-pointer"
                        >
                          Max
                        </button>
                        <span>USDC</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleSupplyUsdc}
                        className="w-full text-center py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded transition-all cursor-pointer font-sans"
                      >
                        Supply
                      </button>
                      <button
                        onClick={handleWithdrawUsdc}
                        className="w-full text-center py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-250 font-semibold text-xs rounded transition-all cursor-pointer font-sans"
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>

                {/* Box C: Borrow Debt USDC Actions */}
                <div className="sm:col-span-2 bg-zinc-950 rounded-xl p-4 border border-zinc-855 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="md:max-w-[45%]">
                    <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-3 bg-amber-500 rounded-sm" />
                      Borrow Stablecoin USDC
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-1 italic font-sans leading-relaxed">
                      Borrow stablecoins at current variable rate APY. Your limit is capped by Collateral Factor (75%). High utilization spikes cost. Outlive debt risks!
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 w-full md:w-[50%] shrink-0">
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0 USDC"
                        value={usdcAmount}
                        onChange={(e) => setUsdcAmount(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 rounded pl-3 pr-16 py-2 text-zinc-200 focus:outline-none focus:border-indigo-650"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-mono text-zinc-550">USDC</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleBorrowUsdc}
                        className="w-full text-center py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded transition-all cursor-pointer font-sans"
                      >
                        Borrow Contract
                      </button>
                      <button
                        onClick={handleRepayUsdc}
                        className="w-full text-center py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded transition-all cursor-pointer font-sans"
                      >
                        Repay Debt
                      </button>
                    </div>
                  </div>
                </div>

                {/* Box D: Liquidation Trigger Panel */}
                <div className="sm:col-span-2 bg-red-950/10 rounded-xl p-4 border border-red-900/30 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="md:max-w-[60%]">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <ShieldAlert className="w-4 h-4 text-red-400 rotate-0" />
                      <h4 className="text-xs font-bold">Public Liquidation Bots Trigger Dashboard</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                      Liquidate open collateral debt loops when user <b>Health Factor drops below 1.00</b>. Liquidators repay borrow debt using Dillon's wallet, receiving equivalent borrower's collateral worth + 8% liquidator penalty discount reward.
                    </p>
                  </div>

                  {/* Active liquidations lists */}
                  <div className="w-full md:w-[35%] shrink-0 flex flex-col gap-1.5">
                    {(Object.entries(users) as [string, UserState][]).map(([key, u]) => {
                      const hf = calculateHealthFactor(u.collateralBalance, u.borrowedBalance, ethPrice, params.liquidationThreshold);
                      const isLiquidatable = hf < 1.0 && u.borrowedBalance > 0;
                      
                      if (u.borrowedBalance === 0) return null;

                      return (
                        <div key={key} className="flex items-center justify-between bg-zinc-950 p-2 rounded border border-zinc-850 text-xs">
                          <div className="font-mono text-[10px]">
                            <span className="text-zinc-400 select-none capitalize">{key}</span>: hf <b className={isLiquidatable ? 'text-red-400 animate-pulse' : 'text-zinc-500'}>{hf.toFixed(2)}</b>
                          </div>
                          
                          {isLiquidatable ? (
                            <button
                              onClick={() => handleLiquidate(key)}
                              className="px-2 py-1 bg-red-655 hover:bg-red-600 text-white font-bold text-[10px] uppercase rounded transition-colors cursor-pointer flex items-center gap-0.5 animate-bounce font-sans"
                            >
                              <Zap className="w-2.5 h-2.5 text-white" />
                              Liquidate
                            </button>
                          ) : (
                            <span className="text-[9px] text-zinc-650 select-none uppercase tracking-wider font-mono">Safe</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Right Panel: APY Curve Chart Visualizer, Smart Contracts Code Tab, EVM Logs */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* 1. Dynamic Interest Rate Curve Visualizer */}
            <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold text-zinc-200 text-sm tracking-tight uppercase font-mono text-xs">Dynamic APY Rate curves</h3>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[9px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full text-indigo-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Live model curve plotter
                </div>
              </div>

              {/* Param Explainer Box */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 mb-4 flex flex-col gap-2 text-[11px] text-zinc-400 font-sans leading-relaxed">
                <div className="flex items-center justify-between text-zinc-300 font-semibold">
                  <span className="font-mono text-xs"> piecewise jump rate curve:</span>
                  <span className="text-zinc-450 text-[10px]">util: {currentUtilPercent}%</span>
                </div>
                <p>
                  Calculated by <code className="text-indigo-300">InterestRateModel.sol</code>:
                  Below <code className="text-yellow-200">Kink ({params.kink * 100}%)</code>, rates rise linearly up to {Math.round((params.baseRate + params.multiplier) * 100)}%. Beyond that, jump multiplier triggers extremely steep rates to protect pool reserves.
                </p>

                {/* Legend */}
                <div className="flex items-center gap-3.5 mt-1 pt-1.5 border-t border-zinc-850/80">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-500 inline-block" />
                    <span>Cost to Borrow (APY)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" />
                    <span>Lender Yield (APY)</span>
                  </div>
                </div>
              </div>

              {/* Custom SVG Curve plotter */}
              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-850 relative">
                <svg viewBox="0 0 500 240" className="w-full h-auto text-zinc-700">
                  {/* Grid background rails */}
                  <line x1="40" y1="40" x2="460" y2="40" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3,3" />
                  <line x1="40" y1="80" x2="460" y2="80" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3,3" />
                  <line x1="40" y1="120" x2="460" y2="120" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3,3" />
                  <line x1="40" y1="160" x2="460" y2="160" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3,3" />
                  <line x1="40" y1="200" x2="460" y2="200" stroke="#374151" strokeWidth="1" />

                  {/* Kink line marker */}
                  <line 
                    x1={getSvgX(params.kink * 100)} 
                    y1="40" 
                    x2={getSvgX(params.kink * 100)} 
                    y2="200" 
                    stroke="#4b5563" 
                    strokeWidth="0.75" 
                    strokeDasharray="4,4" 
                  />
                  <text 
                    x={getSvgX(params.kink * 100) + 4} 
                    y="50" 
                    fill="#9ca3af" 
                    fontSize="8 font-mono"
                    className="font-mono text-[8px]"
                  >
                    Kink ({params.kink * 100}%)
                  </text>

                  {/* X Axis Coordinates */}
                  <text x="40" y="215" fill="#6b7280" fontSize="9 font-mono" textAnchor="middle">0%</text>
                  <text x={getSvgX(50)} y="215" fill="#6b7280" fontSize="9 font-mono" textAnchor="middle">50%</text>
                  <text x={getSvgX(params.kink * 100)} y="215" fill="#6b7280" fontSize="9 font-mono" textAnchor="middle">{params.kink * 100}%</text>
                  <text x="460" y="215" fill="#6b7280" fontSize="9 font-mono" textAnchor="middle">100% UTIL</text>

                  {/* Y Axis Coordinates (APY) */}
                  <text x="32" y="204" fill="#6b7280" fontSize="9 font-mono" textAnchor="end">0%</text>
                  <text x="32" y="164" fill="#6b7280" fontSize="9 font-mono" textAnchor="end">30% APY</text>
                  <text x="32" y="124" fill="#6b7280" fontSize="9 font-mono" textAnchor="end">60% APY</text>
                  <text x="32" y="84" fill="#6b7280" fontSize="9 font-mono" textAnchor="end">90% APY</text>
                  <text x="32" y="44" fill="#6b7280" fontSize="9 font-mono" textAnchor="end">120% APY</text>

                  {/* Curve Paths */}
                  <path d={borrowCurvePath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <path d={supplyCurvePath} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />

                  {/* Current State markers overlay */}
                  <line 
                    x1={currentCircleX} 
                    y1="40" 
                    x2={currentCircleX} 
                    y2="200" 
                    stroke="#4338ca" 
                    strokeWidth="1.5" 
                  />
                  
                  {/* Glowing borrow rate marker */}
                  <circle cx={currentCircleX} cy={currentCircleYBorrow} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                  {/* Glowing supply rate marker */}
                  <circle cx={currentCircleX} cy={currentCircleYSupply} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                </svg>

                {/* Floating tool tips */}
                <div className="absolute top-3 left-12 bg-black/80 font-mono text-[9px] text-zinc-400 p-1.5 border border-zinc-800 rounded">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                    <span>Borrow APY: {activeBorrowAPY.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    <span>Supply APY: {activeSupplyAPY.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Adjustable Rate Sliders */}
              <div className="mt-4 pt-3.5 border-t border-zinc-850/80 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {/* Base rate adjuster */}
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between font-mono text-zinc-500">
                    <span>Base Borrow APY</span>
                    <span className="text-zinc-300 font-bold">{Math.round(params.baseRate * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.00" max="0.10" step="0.01" 
                    value={params.baseRate} 
                    onChange={(e) => setParams(prev => ({ ...prev, baseRate: Number(e.target.value) }))}
                    className="accent-indigo-500 h-1 cursor-pointer bg-zinc-800 rounded"
                  />
                </div>

                {/* Regular Multiplier slope */}
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between font-mono text-zinc-500">
                    <span>Multiplier (Slope A)</span>
                    <span className="text-zinc-300 font-bold">{Math.round(params.multiplier * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.02" max="0.25" step="0.01" 
                    value={params.multiplier} 
                    onChange={(e) => setParams(prev => ({ ...prev, multiplier: Number(e.target.value) }))}
                    className="accent-indigo-500 h-1 cursor-pointer bg-zinc-800 rounded"
                  />
                </div>

                {/* Kink percentage */}
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between font-mono text-zinc-500">
                    <span>Jump Kink %</span>
                    <span className="text-zinc-300 font-bold">{Math.round(params.kink * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.60" max="0.90" step="0.05" 
                    value={params.kink} 
                    onChange={(e) => setParams(prev => ({ ...prev, kink: Number(e.target.value) }))}
                    className="accent-indigo-500 h-1 cursor-pointer bg-zinc-800 rounded"
                  />
                </div>

                {/* Jump multiplier */}
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between font-mono text-zinc-500">
                    <span>Jump Multip (Slope B)</span>
                    <span className="text-zinc-300 font-bold">{Math.round(params.jumpMultiplier * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.40" max="1.50" step="0.05" 
                    value={params.jumpMultiplier} 
                    onChange={(e) => setParams(prev => ({ ...prev, jumpMultiplier: Number(e.target.value) }))}
                    className="accent-indigo-500 h-1 cursor-pointer bg-zinc-800 rounded"
                  />
                </div>
              </div>

            </div>

            {/* 2. Interactive Block Event Log Ledger */}
            <TransactionLedger 
              logs={logs} 
              onClearLogs={() => {
                setLogs([]);
                setAlertMsg({ text: 'EVM local memory wiped.', type: 'warning' });
              }} 
            />

          </div>

        </div>

        {/* Full Solidity Contracts reference repository */}
        <section className="mt-4">
          <SolidityCodeViewer />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500 font-mono mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>Decentralized Risk Engine Sandbox • MIT Licensed</span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-zinc-650" />
            Designed for educational token math modeling simulations
          </span>
        </div>
      </footer>

    </div>
  );
}
