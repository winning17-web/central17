async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const PlayPlusTicket = await ethers.getContractFactory("PlayPlusTicket");
  // Pass the deployer's address as the initialOwner for the Ownable contract
  const playPlusTicket = await PlayPlusTicket.deploy(deployer.address);

  await playPlusTicket.waitForDeployment();

  console.log("PlayPlusTicket deployed to:", await playPlusTicket.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
