import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting deployment...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Deploy MockUSDC
  console.log("\n1️⃣  Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("✅ MockUSDC deployed at:", await usdc.getAddress());

  // Deploy InterestRateModel
  console.log("\n2️⃣  Deploying InterestRateModel...");
  const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
  // Parameters: baseRate (2%), multiplier (8%), kink (80%), jumpMultiplier (85%)
  const rateModel = await InterestRateModel.deploy(
    ethers.parseEther("0.02"),   // baseRate: 2%
    ethers.parseEther("0.08"),   // multiplier: 8%
    ethers.parseEther("0.80"),   // kink: 80%
    ethers.parseEther("0.85")    // jumpMultiplier: 85%
  );
  await rateModel.waitForDeployment();
  console.log("✅ InterestRateModel deployed at:", await rateModel.getAddress());

  // Deploy PriceOracle
  console.log("\n3️⃣  Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  // Initial ETH price: 3000 USDC (scaled to 1e6)
  const oracle = await PriceOracle.deploy(ethers.parseUnits("3000", 6));
  await oracle.waitForDeployment();
  console.log("✅ PriceOracle deployed at:", await oracle.getAddress());

  // Deploy LendingPool
  console.log("\n4️⃣  Deploying LendingPool...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  // Parameters:
  // - debtToken (USDC address)
  // - priceOracle
  // - rateModel
  // - collateralFactor: 75%
  // - liquidationThreshold: 80%
  // - liquidationPenalty: 8%
  // - reserveFactor: 10%
  const lendingPool = await LendingPool.deploy(
    await usdc.getAddress(),
    await oracle.getAddress(),
    await rateModel.getAddress(),
    7500,  // 75% collateral factor
    8000,  // 80% liquidation threshold
    800,   // 8% liquidation penalty
    1000   // 10% reserve factor
  );
  await lendingPool.waitForDeployment();
  console.log("✅ LendingPool deployed at:", await lendingPool.getAddress());

  // Mint some USDC to the lending pool for testing
  console.log("\n5️⃣  Minting USDC to LendingPool...");
  const initialUsdcAmount = ethers.parseUnits("100000", 6); // 100,000 USDC
  await usdc.mint(await lendingPool.getAddress(), initialUsdcAmount);
  console.log("✅ Minted 100,000 USDC to LendingPool");

  console.log("\n📋 Deployment Summary:");
  console.log("========================");
  console.log("MockUSDC:        ", await usdc.getAddress());
  console.log("InterestRateModel:", await rateModel.getAddress());
  console.log("PriceOracle:     ", await oracle.getAddress());
  console.log("LendingPool:     ", await lendingPool.getAddress());
  console.log("========================");
  console.log("\n✨ All contracts deployed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
