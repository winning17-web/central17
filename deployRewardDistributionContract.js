const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying RewardDistributionContract with the account:", deployer.address);

  // 1. Deploy MockERC20 (to be used as rewardToken)
  const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const mockRewardToken = await MockERC20.deploy("MockRewardToken", "mRT", ethers.parseUnits("2000000", 18)); // 2M tokens
  await mockRewardToken.waitForDeployment();
  const mockRewardTokenAddress = await mockRewardToken.getAddress();
  console.log("MockRewardToken (for RewardDistributionContract) deployed to:", mockRewardTokenAddress);

  // 2. Deploy PaymentContract (as RewardDistributionContract needs its address)
  // We need its constructor arguments as well.
  const initialTreasuryAddress = "0x0000000000000000000000000000000000000001"; // Placeholder
  const initialPrizePoolAddress = "0x0000000000000000000000000000000000000002"; // Placeholder
  const initialPlatformFeeBasisPoints = 500; // 5%

  const PaymentContract = await ethers.getContractFactory("PaymentContract");
  const paymentContract = await PaymentContract.deploy(
    deployer.address,             // initialOwner for PaymentContract
    mockRewardTokenAddress,       // Accepted token for PaymentContract (can be same as reward for simplicity here)
    initialTreasuryAddress,
    initialPrizePoolAddress,
    initialPlatformFeeBasisPoints
  );
  await paymentContract.waitForDeployment();
  const paymentContractAddress = await paymentContract.getAddress();
  console.log("PaymentContract (dependency for RewardDistribution) deployed to:", paymentContractAddress);

  // 3. Deploy RewardDistributionContract
  const RewardDistributionContract = await ethers.getContractFactory("RewardDistributionContract");
  const rewardDistributionContract = await RewardDistributionContract.deploy(
    deployer.address,         // initialOwner for RewardDistributionContract
    mockRewardTokenAddress,   // initialRewardTokenAddress
    paymentContractAddress    // initialPaymentContractAddress
  );
  await rewardDistributionContract.waitForDeployment();
  const rewardDistributionContractAddress = await rewardDistributionContract.getAddress();

  console.log("RewardDistributionContract deployed to:", rewardDistributionContractAddress);
  console.log("Constructor arguments used for RewardDistributionContract:");
  console.log("  Initial Owner:", deployer.address);
  console.log("  Reward Token (MockRewardToken):", mockRewardTokenAddress);
  console.log("  Payment Contract Address:", paymentContractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
