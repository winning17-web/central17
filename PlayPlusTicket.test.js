const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlayPlusTicket", function () {
  let PlayPlusTicket;
  let playPlusTicket;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    PlayPlusTicket = await ethers.getContractFactory("PlayPlusTicket");
    playPlusTicket = await PlayPlusTicket.deploy(owner.address);
    await playPlusTicket.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await playPlusTicket.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await playPlusTicket.name()).to.equal("PlayPlusTicket");
      expect(await playPlusTicket.symbol()).to.equal("PPT");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint a new ticket", async function () {
      const tokenURI = "ipfs://examplemetadata/1";
      await expect(playPlusTicket.connect(owner).safeMint(addr1.address, tokenURI))
        .to.emit(playPlusTicket, "TicketMinted")
        .withArgs(addr1.address, 1, tokenURI);
      expect(await playPlusTicket.ownerOf(1)).to.equal(addr1.address);
      expect(await playPlusTicket.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should increment tokenId after each mint", async function () {
      const tokenURI1 = "ipfs://examplemetadata/1";
      const tokenURI2 = "ipfs://examplemetadata/2";
      await playPlusTicket.connect(owner).safeMint(addr1.address, tokenURI1);
      await playPlusTicket.connect(owner).safeMint(addr2.address, tokenURI2);
      expect(await playPlusTicket.ownerOf(1)).to.equal(addr1.address);
      expect(await playPlusTicket.ownerOf(2)).to.equal(addr2.address);
    });

    it("Should not allow non-owner to mint a new ticket", async function () {
      const tokenURI = "ipfs://examplemetadata/1";
      await expect(playPlusTicket.connect(addr1).safeMint(addr2.address, tokenURI))
        .to.be.revertedWithCustomError(playPlusTicket, "OwnableUnauthorizedAccount").withArgs(addr1.address);
    });
  });

  describe("Token URI", function () {
    it("Should return correct token URI after minting", async function () {
      const tokenURI = "ipfs://examplemetadata/specific";
      await playPlusTicket.connect(owner).safeMint(addr1.address, tokenURI);
      expect(await playPlusTicket.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should revert for non-existent token URI", async function () {
        await expect(playPlusTicket.tokenURI(999))
            .to.be.revertedWithCustomError(playPlusTicket, "ERC721NonexistentToken").withArgs(999);
    });
  });
});
