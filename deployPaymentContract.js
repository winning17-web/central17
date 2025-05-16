const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying PaymentContract with the account:", deployer.address);

  // For deployment, we need to provide constructor arguments:
  // address initialOwner,
  // address initialAcceptedTokenAddress, (e.g., a mock ERC20 for testing)
  // address initialTreasuryAddress,
  // address initialPrizePoolAddress,
  // uint256 initialPlatformFeeBasisPoints

  // Deploy a mock ERC20 token for testing purposes (e.g., MockUSDC)
  const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20"); // Adjust path if your mock is elsewhere
  const mockUSDC = await MockERC20.deploy("MockUSDC", "mUSDC", ethers.parseUnits("1000000", 18)); // 1M tokens with 18 decimals
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", mockUSDCAddress);

  const initialAcceptedTokenAddress = mockUSDCAddress;
  const initialTreasuryAddress = "0x0000000000000000000000000000000000000001"; // Placeholder, replace with actual or deployer for testing
  const initialPrizePoolAddress = "0x0000000000000000000000000000000000000002"; // Placeholder, replace with actual or another account for testing
  const initialPlatformFeeBasisPoints = 500; // 5%

  const PaymentContract = await ethers.getContractFactory("PaymentContract");
  const paymentContract = await PaymentContract.deploy(
    deployer.address, // initialOwner
    initialAcceptedTokenAddress,
    initialTreasuryAddress,
    initialPrizePoolAddress,
    initialPlatformFeeBasisPoints
  );

  await paymentContract.waitForDeployment();
  const paymentContractAddress = await paymentContract.getAddress();

  console.log("PaymentContract deployed to:", paymentContractAddress);
  console.log("Constructor arguments used:");
  console.log("  Initial Owner:", deployer.address);
  console.log("  Accepted Token (MockUSDC):", initialAcceptedTokenAddress);
  console.log("  Treasury Address:", initialTreasuryAddress);
  console.log("  Prize Pool Address:", initialPrizePoolAddress);
  console.log("  Platform Fee (500 BP = 5%):", initialPlatformFeeBasisPoints);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
