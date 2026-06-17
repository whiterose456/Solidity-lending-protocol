import { expect } from "chai";
import { ethers } from "hardhat";

describe("LendingPool Integration Tests", function () {
  let lendingPool: any;
  let usdc: any;
  let oracle: any;
  let rateModel: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy InterestRateModel
    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    rateModel = await InterestRateModel.deploy(
      ethers.parseEther("0.02"),
      ethers.parseEther("0.08"),
      ethers.parseEther("0.80"),
      ethers.parseEther("0.85")
    );
    await rateModel.waitForDeployment();

    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    oracle = await PriceOracle.deploy(ethers.parseUnits("3000", 6));
    await oracle.waitForDeployment();

    // Deploy LendingPool
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(
      await usdc.getAddress(),
      await oracle.getAddress(),
      await rateModel.getAddress(),
      7500,
      8000,
      800,
      1000
    );
    await lendingPool.waitForDeployment();

    // Mint USDC to lending pool and user1
    await usdc.mint(await lendingPool.getAddress(), ethers.parseUnits("1000000", 6));
    await usdc.mint(user1.address, ethers.parseUnits("50000", 6));

    // Approve lending pool to use USDC
    await usdc.connect(user1).approve(await lendingPool.getAddress(), ethers.parseUnits("50000", 6));
  });

  it("Should allow users to deposit ETH collateral", async function () {
    const depositAmount = ethers.parseEther("10");
    
    await user1.sendTransaction({
      to: await lendingPool.getAddress(),
      value: depositAmount,
    });

    const userCollateral = await lendingPool.userCollateral(user1.address);
    expect(userCollateral).to.equal(depositAmount);
  });

  it("Should calculate health factor correctly", async function () {
    // User deposits 10 ETH
    await user1.sendTransaction({
      to: await lendingPool.getAddress(),
      value: ethers.parseEther("10"),
    });

    // Check health factor (should be infinite with no debt)
    const healthFactor = await lendingPool.getHealthFactor(user1.address);
    expect(healthFactor).to.equal(ethers.MaxUint256);
  });

  it("Should allow borrowing against collateral", async function () {
    // User deposits 10 ETH
    await user1.sendTransaction({
      to: await lendingPool.getAddress(),
      value: ethers.parseEther("10"),
    });

    // ETH price is 3000 USDC, collateral factor is 75%
    // Max borrow = 10 * 3000 * 0.75 = 22,500 USDC
    const borrowAmount = ethers.parseUnits("20000", 6);
    
    await lendingPool.connect(user1).borrow(borrowAmount);

    const userBorrow = await lendingPool.getBorrowedBalance(user1.address);
    expect(userBorrow).to.equal(borrowAmount);
  });

  it("Should prevent borrowing above collateral limit", async function () {
    // User deposits 10 ETH
    await user1.sendTransaction({
      to: await lendingPool.getAddress(),
      value: ethers.parseEther("10"),
    });

    // Try to borrow more than allowed (25,000 > 22,500 max)
    const excessiveAmount = ethers.parseUnits("25000", 6);
    
    await expect(
      lendingPool.connect(user1).borrow(excessiveAmount)
    ).to.be.revertedWith("Borrow exceeds collateral limit");
  });

  it("Should allow repayment of debt", async function () {
    // User deposits 10 ETH
    await user1.sendTransaction({
      to: await lendingPool.getAddress(),
      value: ethers.parseEther("10"),
    });

    // User borrows 10,000 USDC
    const borrowAmount = ethers.parseUnits("10000", 6);
    await lendingPool.connect(user1).borrow(borrowAmount);

    // User repays 5,000 USDC
    const repayAmount = ethers.parseUnits("5000", 6);
    await lendingPool.connect(user1).repay(repayAmount);

    const remainingBorrow = await lendingPool.getBorrowedBalance(user1.address);
    expect(remainingBorrow).to.equal(borrowAmount - repayAmount);
  });

  it("Should allow price oracle updates", async function () {
    const newPrice = ethers.parseUnits("4000", 6);
    await oracle.setAssetPrice(newPrice);

    const currentPrice = await oracle.getAssetPrice();
    expect(currentPrice).to.equal(newPrice);
  });
});
