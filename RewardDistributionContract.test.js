const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RewardDistributionContract", function () {
  let RewardDistributionContract, PaymentContract, MockERC20;
  let rewardDistributionContract, paymentContract, mockRewardToken, mockPaymentToken;
  let owner, resultSubmitter, winner1, winner2, funder, otherAccount;

  beforeEach(async function () {
    [owner, resultSubmitter, winner1, winner2, funder, otherAccount] = await ethers.getSigners();

    // Deploy MockERC20 for rewards
    MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
    mockRewardToken = await MockERC20.deploy("MockReward", "mRWD", ethers.parseUnits("1000000", 18));
    await mockRewardToken.waitForDeployment();
    const mockRewardTokenAddress = await mockRewardToken.getAddress();

    // Deploy another MockERC20 for payment contract (can be same as reward for simplicity in some tests)
    mockPaymentToken = await MockERC20.deploy("MockPayment", "mPAY", ethers.parseUnits("1000000", 18));
    await mockPaymentToken.waitForDeployment();
    const mockPaymentTokenAddress = await mockPaymentToken.getAddress();

    // Deploy PaymentContract (dependency)
    PaymentContract = await ethers.getContractFactory("PaymentContract");
    paymentContract = await PaymentContract.deploy(
      owner.address,
      mockPaymentTokenAddress, // PaymentContract accepts mPAY
      otherAccount.address, // Treasury
      otherAccount.address, // Prize Pool (can be this contract later, or a dedicated address)
      500 // 5% platform fee
    );
    await paymentContract.waitForDeployment();
    const paymentContractAddress = await paymentContract.getAddress();

    // Deploy RewardDistributionContract
    RewardDistributionContract = await ethers.getContractFactory("RewardDistributionContract");
    rewardDistributionContract = await RewardDistributionContract.deploy(
      owner.address,
      mockRewardTokenAddress, // Rewards are in mRWD
      paymentContractAddress
    );
    await rewardDistributionContract.waitForDeployment();

    // Add resultSubmitter as an authorized submitter
    await rewardDistributionContract.connect(owner).addResultSubmitter(resultSubmitter.address);

    // Fund the RewardDistributionContract with some reward tokens for testing claims
    // Typically, the PaymentContract would transfer funds here, or an admin.
    // For direct funding test, mint to funder and funder transfers to contract.
    await mockRewardToken.connect(owner).mint(funder.address, ethers.parseUnits("1000", 18));
    await mockRewardToken.connect(funder).approve(await rewardDistributionContract.getAddress(), ethers.parseUnits("1000", 18));
  });

  describe("Deployment & Configuration", function () {
    it("Should set the right owner", async function () {
      expect(await rewardDistributionContract.owner()).to.equal(owner.address);
    });

    it("Should set the correct initial reward token address", async function () {
      expect(await rewardDistributionContract.rewardToken()).to.equal(await mockRewardToken.getAddress());
    });

    it("Should set the correct initial payment contract address", async function () {
      expect(await rewardDistributionContract.paymentContractAddress()).to.equal(await paymentContract.getAddress());
    });

    it("Should add owner as an initial result submitter", async function () {
      expect(await rewardDistributionContract.resultSubmitters(owner.address)).to.be.true;
    });

    it("Should allow owner to add and remove result submitters", async function () {
      await expect(rewardDistributionContract.connect(owner).addResultSubmitter(otherAccount.address))
        .to.emit(rewardDistributionContract, "ResultSubmitterAdded").withArgs(otherAccount.address);
      expect(await rewardDistributionContract.resultSubmitters(otherAccount.address)).to.be.true;

      await expect(rewardDistributionContract.connect(owner).removeResultSubmitter(otherAccount.address))
        .to.emit(rewardDistributionContract, "ResultSubmitterRemoved").withArgs(otherAccount.address);
      expect(await rewardDistributionContract.resultSubmitters(otherAccount.address)).to.be.false;
    });
  });

  describe("Prize Pool Funding", function () {
    it("Should allow funding the prize pool for a tournament", async function () {
      const tournamentId = 1;
      const fundAmount = ethers.parseUnits("100", 18);
      // Funder needs to approve the contract to spend its tokens
      await mockRewardToken.connect(funder).approve(await rewardDistributionContract.getAddress(), fundAmount);
      
      await expect(rewardDistributionContract.connect(funder).fundPrizePool(tournamentId, fundAmount))
        .to.emit(rewardDistributionContract, "PrizePoolFunded")
        .withArgs(tournamentId, funder.address, fundAmount);
      
      const tournamentInfo = await rewardDistributionContract.tournamentRewards(tournamentId);
      expect(tournamentInfo.totalPrizePool).to.equal(fundAmount);
      expect(await mockRewardToken.balanceOf(await rewardDistributionContract.getAddress())).to.equal(fundAmount);
    });
  });

  describe("Declaring Winners", function () {
    const tournamentId = 1;
    const prizePoolAmount = ethers.parseUnits("500", 18);

    beforeEach(async function () {
      // Fund the prize pool
      await mockRewardToken.connect(funder).approve(await rewardDistributionContract.getAddress(), prizePoolAmount);
      await rewardDistributionContract.connect(funder).fundPrizePool(tournamentId, prizePoolAmount);
    });

    it("Should allow authorized submitter to declare winners", async function () {
      const winners = [winner1.address, winner2.address];
      const shares = [ethers.parseUnits("300", 18), ethers.parseUnits("200", 18)];
      const totalShares = ethers.parseUnits("500", 18);

      await expect(rewardDistributionContract.connect(resultSubmitter).declareWinners(tournamentId, winners, shares))
        .to.emit(rewardDistributionContract, "WinnersDeclared")
        .withArgs(tournamentId, totalShares);

      const results = await rewardDistributionContract.tournamentRewards(tournamentId);
      expect(results.resultsDeclared).to.be.true;
      expect(await rewardDistributionContract.getWinnerShare(tournamentId, winner1.address)).to.equal(shares[0]);
      expect(await rewardDistributionContract.getWinnerShare(tournamentId, winner2.address)).to.equal(shares[1]);
    });

    it("Should not allow non-authorized person to declare winners", async function () {
      const winners = [winner1.address];
      const shares = [ethers.parseUnits("100", 18)];
      await expect(rewardDistributionContract.connect(otherAccount).declareWinners(tournamentId, winners, shares))
        .to.be.revertedWith("RewardDist: Caller not authorized to submit results");
    });

    it("Should fail if results are already declared", async function () {
      const winners = [winner1.address];
      const shares = [ethers.parseUnits("100", 18)];
      await rewardDistributionContract.connect(resultSubmitter).declareWinners(tournamentId, winners, shares);
      await expect(rewardDistributionContract.connect(resultSubmitter).declareWinners(tournamentId, winners, shares))
        .to.be.revertedWith("RewardDist: Results already declared for this tournament");
    });

    it("Should fail if total shares exceed prize pool", async function () {
      const winners = [winner1.address];
      const shares = [ethers.parseUnits("600", 18)]; // Exceeds 500 prize pool
      await expect(rewardDistributionContract.connect(resultSubmitter).declareWinners(tournamentId, winners, shares))
        .to.be.revertedWith("RewardDist: Total shares exceed prize pool");
    });
  });

  describe("Claiming Rewards", function () {
    const tournamentId = 1;
    const prizePoolAmount = ethers.parseUnits("500", 18);
    const winner1Share = ethers.parseUnits("300", 18);
    const winner2Share = ethers.parseUnits("200", 18);

    beforeEach(async function () {
      // Fund and declare winners
      await mockRewardToken.connect(funder).approve(await rewardDistributionContract.getAddress(), prizePoolAmount);
      await rewardDistributionContract.connect(funder).fundPrizePool(tournamentId, prizePoolAmount);
      await rewardDistributionContract.connect(resultSubmitter).declareWinners(tournamentId, [winner1.address, winner2.address], [winner1Share, winner2Share]);
    });

    it("Should allow a winner to claim their reward", async function () {
      const initialWinnerBalance = await mockRewardToken.balanceOf(winner1.address);
      const initialContractBalance = await mockRewardToken.balanceOf(await rewardDistributionContract.getAddress());

      await expect(rewardDistributionContract.connect(winner1).claimReward(tournamentId))
        .to.emit(rewardDistributionContract, "RewardClaimed")
        .withArgs(tournamentId, winner1.address, winner1Share);

      expect(await mockRewardToken.balanceOf(winner1.address)).to.equal(initialWinnerBalance + winner1Share);
      expect(await mockRewardToken.balanceOf(await rewardDistributionContract.getAddress())).to.equal(initialContractBalance - winner1Share);
      const results = await rewardDistributionContract.tournamentRewards(tournamentId);
      expect(await rewardDistributionContract.getHasClaimed(tournamentId, winner1.address)).to.be.true;
    });

    it("Should not allow claiming if results not declared", async function () {
      const newTournamentId = 2;
      await expect(rewardDistributionContract.connect(winner1).claimReward(newTournamentId))
        .to.be.revertedWith("RewardDist: Results not yet declared for this tournament");
    });

    it("Should not allow double claiming", async function () {
      await rewardDistributionContract.connect(winner1).claimReward(tournamentId); // First claim
      await expect(rewardDistributionContract.connect(winner1).claimReward(tournamentId))
        .to.be.revertedWith("RewardDist: Reward already claimed");
    });

    it("Should not allow non-winner to claim", async function () {
      await expect(rewardDistributionContract.connect(otherAccount).claimReward(tournamentId))
        .to.be.revertedWith("RewardDist: No reward allocated for this address or amount is zero");
    });
  });

  describe("Pausable Functionality", function () {
    it("Should allow owner to pause and unpause", async function () {
      await expect(rewardDistributionContract.connect(owner).pause())
        .to.emit(rewardDistributionContract, "Paused").withArgs(owner.address);
      expect(await rewardDistributionContract.paused()).to.be.true;

      await expect(rewardDistributionContract.connect(owner).unpause())
        .to.emit(rewardDistributionContract, "Unpaused").withArgs(owner.address);
      expect(await rewardDistributionContract.paused()).to.be.false;
    });

    it("Should prevent actions when paused", async function () {
      await rewardDistributionContract.connect(owner).pause();
      const tournamentId = 1;
      const winners = [winner1.address];
      const shares = [ethers.parseUnits("100", 18)];
      await expect(rewardDistributionContract.connect(resultSubmitter).declareWinners(tournamentId, winners, shares))
        .to.be.revertedWithCustomError(rewardDistributionContract, "EnforcedPause");
      await expect(rewardDistributionContract.connect(winner1).claimReward(tournamentId))
        .to.be.revertedWithCustomError(rewardDistributionContract, "EnforcedPause");
    });
  });

   describe("Admin Token/Address Management", function () {
        it("Should allow owner to change reward token", async function () {
            const newRewardToken = await MockERC20.deploy("NewReward", "NRT", ethers.parseUnits("1000000", 18));
            await newRewardToken.waitForDeployment();
            const newRewardTokenAddress = await newRewardToken.getAddress();
            await expect(rewardDistributionContract.connect(owner).setRewardToken(newRewardTokenAddress))
                .to.emit(rewardDistributionContract, "RewardTokenSet").withArgs(newRewardTokenAddress);
            expect(await rewardDistributionContract.rewardToken()).to.equal(newRewardTokenAddress);
        });

        it("Should allow owner to change payment contract address", async function () {
            const newPaymentContractAddress = otherAccount.address; // Just an address for testing
            await expect(rewardDistributionContract.connect(owner).setPaymentContractAddress(newPaymentContractAddress))
                .to.emit(rewardDistributionContract, "PaymentContractAddressSet").withArgs(newPaymentContractAddress);
            expect(await rewardDistributionContract.paymentContractAddress()).to.equal(newPaymentContractAddress);
        });
    });

    describe("Withdraw Other Tokens", function () {
        it("Should allow owner to withdraw other ERC20 tokens accidentally sent", async function () {
            const OtherToken = await MockERC20.deploy("Other", "OTH", ethers.parseUnits("500", 18));
            await OtherToken.waitForDeployment();
            const otherTokenAddress = await OtherToken.getAddress();
            const amountToSend = ethers.parseUnits("50", 18);

            await OtherToken.connect(owner).mint(await rewardDistributionContract.getAddress(), amountToSend);
            expect(await OtherToken.balanceOf(await rewardDistributionContract.getAddress())).to.equal(amountToSend);

            const ownerInitialOtherTokenBalance = await OtherToken.balanceOf(owner.address);
            await rewardDistributionContract.connect(owner).withdrawOtherTokens(otherTokenAddress, owner.address, amountToSend);
            
            expect(await OtherToken.balanceOf(await rewardDistributionContract.getAddress())).to.equal(0);
            expect(await OtherToken.balanceOf(owner.address)).to.equal(ownerInitialOtherTokenBalance + amountToSend);
        });

        it("Should not allow withdrawing the main reward token using withdrawOtherTokens", async function () {
            const rewardTokenAddress = await mockRewardToken.getAddress();
            const amountToSend = ethers.parseUnits("50", 18);
            await mockRewardToken.connect(owner).mint(await rewardDistributionContract.getAddress(), amountToSend);

            await expect(rewardDistributionContract.connect(owner).withdrawOtherTokens(rewardTokenAddress, owner.address, amountToSend))
                .to.be.revertedWith("RewardDist: Cannot withdraw reward token with this function");
        });
    });
});
