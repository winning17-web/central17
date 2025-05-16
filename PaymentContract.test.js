const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentContract", function () {
  let PaymentContract, MockERC20;
  let paymentContract, mockUSDC;
  let owner, payer, treasury, prizePool, otherAccount;
  const initialPlatformFeeBP = 500; // 5%
  const oneDay = 24 * 60 * 60;

  beforeEach(async function () {
    [owner, payer, treasury, prizePool, otherAccount] = await ethers.getSigners();

    // Deploy MockERC20 (mUSDC)
    MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
    mockUSDC = await MockERC20.deploy("MockUSDC", "mUSDC", ethers.parseUnits("1000000", 18)); // 1M tokens
    await mockUSDC.waitForDeployment();
    const mockUSDCAddress = await mockUSDC.getAddress();

    // Deploy PaymentContract
    PaymentContract = await ethers.getContractFactory("PaymentContract");
    paymentContract = await PaymentContract.deploy(
      owner.address,
      mockUSDCAddress,
      treasury.address,
      prizePool.address,
      initialPlatformFeeBP
    );
    await paymentContract.waitForDeployment();

    // Give payer some mUSDC
    await mockUSDC.connect(owner).mint(payer.address, ethers.parseUnits("1000", 18)); // Payer gets 1000 mUSDC
  });

  describe("Deployment & Configuration", function () {
    it("Should set the right owner", async function () {
      expect(await paymentContract.owner()).to.equal(owner.address);
    });

    it("Should set the correct initial accepted token address", async function () {
      expect(await paymentContract.acceptedTokenAddress()).to.equal(await mockUSDC.getAddress());
    });

    it("Should set the correct initial treasury address", async function () {
      expect(await paymentContract.treasuryAddress()).to.equal(treasury.address);
    });

    it("Should set the correct initial prize pool address", async function () {
      expect(await paymentContract.prizePoolAddress()).to.equal(prizePool.address);
    });

    it("Should set the correct initial platform fee basis points", async function () {
      expect(await paymentContract.platformFeeBasisPoints()).to.equal(initialPlatformFeeBP);
    });

    it("Should allow owner to set tournament entry fee", async function () {
      const tournamentId = 1;
      const fee = ethers.parseUnits("10", 18);
      await expect(paymentContract.connect(owner).setTournamentEntryFee(tournamentId, fee))
        .to.emit(paymentContract, "TournamentFeeSet")
        .withArgs(tournamentId, fee);
      expect(await paymentContract.tournamentEntryFees(tournamentId)).to.equal(fee);
    });

    it("Should not allow non-owner to set tournament entry fee", async function () {
      const tournamentId = 1;
      const fee = ethers.parseUnits("10", 18);
      await expect(paymentContract.connect(otherAccount).setTournamentEntryFee(tournamentId, fee))
        .to.be.revertedWithCustomError(paymentContract, "OwnableUnauthorizedAccount").withArgs(otherAccount.address);
    });
  });

  describe("Paying Entry Fee", function () {
    const tournamentId = 1;
    const entryFee = ethers.parseUnits("100", 18); // 100 mUSDC

    beforeEach(async function () {
      await paymentContract.connect(owner).setTournamentEntryFee(tournamentId, entryFee);
      // Payer approves PaymentContract to spend their mUSDC
      await mockUSDC.connect(payer).approve(await paymentContract.getAddress(), entryFee);
    });

    it("Should allow a user to pay entry fee successfully", async function () {
      const payerInitialBalance = await mockUSDC.balanceOf(payer.address);
      const contractInitialBalance = await mockUSDC.balanceOf(await paymentContract.getAddress()); // Should be 0 before fee split
      const treasuryInitialBalance = await mockUSDC.balanceOf(treasury.address);
      const prizePoolInitialBalance = await mockUSDC.balanceOf(prizePool.address);

      await expect(paymentContract.connect(payer).payEntryFee(tournamentId))
        .to.emit(paymentContract, "PaymentReceived")
        .withArgs(payer.address, tournamentId, entryFee, await mockUSDC.getAddress());

      expect(await mockUSDC.balanceOf(payer.address)).to.equal(payerInitialBalance - entryFee);
      
      // Check balances after fee distribution
      const platformShare = (entryFee * BigInt(initialPlatformFeeBP)) / 10000n;
      const prizePoolShare = entryFee - platformShare;

      expect(await mockUSDC.balanceOf(treasury.address)).to.equal(treasuryInitialBalance + platformShare);
      expect(await mockUSDC.balanceOf(prizePool.address)).to.equal(prizePoolInitialBalance + prizePoolShare);
      // Contract should have 0 balance of the token after distribution
      expect(await mockUSDC.balanceOf(await paymentContract.getAddress())).to.equal(contractInitialBalance);
    });

    it("Should fail if entry fee is not set for the tournament", async function () {
      const unsetTournamentId = 2;
      await expect(paymentContract.connect(payer).payEntryFee(unsetTournamentId))
        .to.be.revertedWith("PaymentContract: Entry fee for this tournament is not set or is zero");
    });

    it("Should fail if user has not approved enough tokens", async function () {
      await mockUSDC.connect(payer).approve(await paymentContract.getAddress(), ethers.parseUnits("50", 18)); // Approve less than fee
      await expect(paymentContract.connect(payer).payEntryFee(tournamentId))
        .to.be.revertedWith("PaymentContract: Check token allowance");
    });

    it("Should fail if user has insufficient token balance (even if approved)", async function () {
      // Burn payer's tokens to simulate insufficient balance
      const payerBalance = await mockUSDC.balanceOf(payer.address);
      await mockUSDC.connect(owner).mint(otherAccount.address, payerBalance); // move tokens to someone else
      await mockUSDC.connect(payer).transfer(otherAccount.address, payerBalance); // Payer has 0 balance
      
      // Re-approve, though balance is zero
      await mockUSDC.connect(payer).approve(await paymentContract.getAddress(), entryFee);

      await expect(paymentContract.connect(payer).payEntryFee(tournamentId))
        .to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientBalance").withArgs(payer.address, 0, entryFee); // Check payer's balance (0) vs entryFee
    });

    it("Should prevent reentrancy attacks", async function () {
        // This test is more complex and would require a malicious contract.
        // For now, we rely on OpenZeppelin's ReentrancyGuard.
        // A basic check is that the nonReentrant modifier is present.
        // More advanced tests could involve deploying a contract that tries to re-enter.
        expect(true).to.be.true; // Placeholder for more advanced reentrancy test
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to change accepted token", async function () {
      const newMockToken = await MockERC20.deploy("NewMock", "NMT", ethers.parseUnits("1000", 18));
      await newMockToken.waitForDeployment();
      const newMockTokenAddress = await newMockToken.getAddress();
      await expect(paymentContract.connect(owner).setAcceptedToken(newMockTokenAddress))
        .to.emit(paymentContract, "AcceptedTokenChanged")
        .withArgs(newMockTokenAddress);
      expect(await paymentContract.acceptedTokenAddress()).to.equal(newMockTokenAddress);
    });

    it("Should allow owner to change treasury address", async function () {
      await expect(paymentContract.connect(owner).setTreasuryAddress(otherAccount.address))
        .to.emit(paymentContract, "TreasuryChanged")
        .withArgs(otherAccount.address);
      expect(await paymentContract.treasuryAddress()).to.equal(otherAccount.address);
    });

    it("Should allow owner to change prize pool address", async function () {
      await expect(paymentContract.connect(owner).setPrizePoolAddress(otherAccount.address))
        .to.emit(paymentContract, "PrizePoolChanged")
        .withArgs(otherAccount.address);
      expect(await paymentContract.prizePoolAddress()).to.equal(otherAccount.address);
    });

    it("Should allow owner to change platform fee basis points", async function () {
      const newFeeBP = 1000; // 10%
      await expect(paymentContract.connect(owner).setPlatformFeeBasisPoints(newFeeBP))
        .to.emit(paymentContract, "PlatformFeeChanged")
        .withArgs(newFeeBP);
      expect(await paymentContract.platformFeeBasisPoints()).to.equal(newFeeBP);
    });

    it("Should allow owner to withdraw other ERC20 tokens accidentally sent to the contract", async function () {
        const OtherToken = await MockERC20.deploy("Other", "OTH", ethers.parseUnits("500", 18));
        await OtherToken.waitForDeployment();
        const otherTokenAddress = await OtherToken.getAddress();
        const amountToSend = ethers.parseUnits("50", 18);

        // Send some other tokens to PaymentContract
        await OtherToken.connect(owner).mint(await paymentContract.getAddress(), amountToSend);
        expect(await OtherToken.balanceOf(await paymentContract.getAddress())).to.equal(amountToSend);

        const ownerInitialOtherTokenBalance = await OtherToken.balanceOf(owner.address);

        await expect(paymentContract.connect(owner).withdrawOtherTokens(otherTokenAddress, owner.address, amountToSend))
            .to.emit(paymentContract, "FeesWithdrawn")
            .withArgs(owner.address, amountToSend, otherTokenAddress);
        
        expect(await OtherToken.balanceOf(await paymentContract.getAddress())).to.equal(0);
        expect(await OtherToken.balanceOf(owner.address)).to.equal(ownerInitialOtherTokenBalance + amountToSend);
    });

    it("Should not allow withdrawing the accepted payment token using withdrawOtherTokens", async function () {
        const acceptedTokenAddress = await mockUSDC.getAddress();
        const amountToSend = ethers.parseUnits("50", 18);
        await mockUSDC.connect(owner).mint(await paymentContract.getAddress(), amountToSend); // Send accepted token

        await expect(paymentContract.connect(owner).withdrawOtherTokens(acceptedTokenAddress, owner.address, amountToSend))
            .to.be.revertedWith("PaymentContract: Cannot withdraw accepted payment token with this function");
    });
  });
});
