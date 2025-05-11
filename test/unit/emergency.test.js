// test/unit/emergency.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT - Emergency Functions", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let EMERGENCY_TIMELOCK;

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    fakeUSDT = await FakeUSDT.deploy();
    await fakeUSDT.waitForDeployment();
    
    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    cryptoMembershipNFT = await CryptoMembershipNFT.deploy(
      await fakeUSDT.getAddress(),
      owner.address
    );
    await cryptoMembershipNFT.waitForDeployment();
    
    // Get EMERGENCY_TIMELOCK constant
    EMERGENCY_TIMELOCK = await cryptoMembershipNFT.EMERGENCY_TIMELOCK();
    
    // Transfer USDT to users for testing
    const usdtAmount = ethers.parseEther("1000");
    await fakeUSDT.transfer(user1.address, usdtAmount);
    await fakeUSDT.transfer(user2.address, usdtAmount);
    
    // Approve USDT for the NFT contract
    await fakeUSDT.connect(user1).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    await fakeUSDT.connect(user2).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    
    // Register members to generate some funds in the contract
    await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
    await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
  });

  describe("setPaused", function () {
    it("should allow owner to pause and unpause the contract", async function () {
      // Check initial state
      const initialStatus = (await cryptoMembershipNFT.getContractStatus())[0];
      expect(initialStatus).to.equal(false); // Not paused initially
      
      // Pause the contract
      await expect(cryptoMembershipNFT.setPaused(true))
        .to.emit(cryptoMembershipNFT, "ContractPaused")
        .withArgs(true);
      
      // Check paused state
      const pausedStatus = (await cryptoMembershipNFT.getContractStatus())[0];
      expect(pausedStatus).to.equal(true);
      
      // Unpause the contract
      await expect(cryptoMembershipNFT.setPaused(false))
        .to.emit(cryptoMembershipNFT, "ContractPaused")
        .withArgs(false);
      
      // Check unpaused state
      const unpausedStatus = (await cryptoMembershipNFT.getContractStatus())[0];
      expect(unpausedStatus).to.equal(false);
    });
    
    it("should prevent member registration when paused", async function () {
      // Pause the contract
      await cryptoMembershipNFT.setPaused(true);
      
      // Try to register a new member
      await expect(
        cryptoMembershipNFT.connect(user1).registerMember(1, owner.address)
      ).to.be.revertedWith("0x01"); // Error code for paused contract
    });
    
    it("should revert when non-owner tries to pause", async function () {
      await expect(
        cryptoMembershipNFT.connect(user1).setPaused(true)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("requestEmergencyWithdraw", function () {
    it("should allow owner to request emergency withdrawal", async function () {
      // Request emergency withdrawal
      await expect(cryptoMembershipNFT.requestEmergencyWithdraw())
        .to.emit(cryptoMembershipNFT, "EmergencyWithdrawRequested")
        .withArgs(await time.latest());
      
      // Check emergency request is recorded
      const contractStatus = await cryptoMembershipNFT.getContractStatus();
      expect(contractStatus[4]).to.equal(true); // hasEmergencyRequest
    });
    
    it("should revert when non-owner tries to request emergency withdrawal", async function () {
      await expect(
        cryptoMembershipNFT.connect(user1).requestEmergencyWithdraw()
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("emergencyWithdraw", function () {
    it("should allow owner to perform emergency withdrawal after timelock", async function () {
      // Request emergency withdrawal
      await cryptoMembershipNFT.requestEmergencyWithdraw();
      
      // Fast forward past the emergency timelock
      await time.increase(EMERGENCY_TIMELOCK);
      
      // Get contract balance before withdrawal
      const contractBalanceBefore = await fakeUSDT.balanceOf(await cryptoMembershipNFT.getAddress());
      
      // Get owner balance before withdrawal
      const ownerBalanceBefore = await fakeUSDT.balanceOf(owner.address);
      
      // Perform emergency withdrawal
      await expect(cryptoMembershipNFT.emergencyWithdraw())
        .to.emit(cryptoMembershipNFT, "EmergencyWithdraw")
        .withArgs(owner.address, contractBalanceBefore);
      
      // Get owner balance after withdrawal
      const ownerBalanceAfter = await fakeUSDT.balanceOf(owner.address);
      
      // Get contract balance after withdrawal
      const contractBalanceAfter = await fakeUSDT.balanceOf(await cryptoMembershipNFT.getAddress());
      
      // Check balances
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalanceBefore);
      expect(contractBalanceAfter).to.equal(0);
      
      // Check all balances are reset
      const state = await cryptoMembershipNFT.state();
      expect(state.ownerBalance).to.equal(0);
      expect(state.feeSystemBalance).to.equal(0);
      expect(state.fundBalance).to.equal(0);
      
      // Check emergency request is reset
      const contractStatus = await cryptoMembershipNFT.getContractStatus();
      expect(contractStatus[4]).to.equal(false); // hasEmergencyRequest
    });
    
    it("should revert when trying to perform emergency withdrawal without request", async function () {
      await expect(
        cryptoMembershipNFT.emergencyWithdraw()
      ).to.be.revertedWith("0x3A"); // Error code for no emergency request
    });
    
    it("should revert when trying to perform emergency withdrawal before timelock expires", async function () {
      // Request emergency withdrawal
      await cryptoMembershipNFT.requestEmergencyWithdraw();
      
      // Fast forward to just before timelock expires
      await time.increase(EMERGENCY_TIMELOCK - 2n);
      
      // Try to perform emergency withdrawal
      await expect(
        cryptoMembershipNFT.emergencyWithdraw()
      ).to.be.revertedWith("0x3B"); // Error code for timelock not expired
    });
    
    it("should revert when non-owner tries to perform emergency withdrawal", async function () {
      // Request emergency withdrawal as owner
      await cryptoMembershipNFT.requestEmergencyWithdraw();
      
      // Fast forward past the emergency timelock
      await time.increase(EMERGENCY_TIMELOCK);
      
      // Try to perform emergency withdrawal as non-owner
      await expect(
        cryptoMembershipNFT.connect(user1).emergencyWithdraw()
      ).to.be.reverted; // Will be reverted due to Ownable
    });
    
    it("should revert when contract has no balance", async function () {
      // First withdraw all funds normally
      const state = await cryptoMembershipNFT.state();
      await cryptoMembershipNFT.withdrawOwnerBalance(state.ownerBalance);
      await cryptoMembershipNFT.withdrawFeeSystemBalance(state.feeSystemBalance);
      await cryptoMembershipNFT.withdrawFundBalance(state.fundBalance);
      
      // Request emergency withdrawal
      await cryptoMembershipNFT.requestEmergencyWithdraw();
      
      // Fast forward past the emergency timelock
      await time.increase(EMERGENCY_TIMELOCK);
      
      // Try to perform emergency withdrawal
      await expect(
        cryptoMembershipNFT.emergencyWithdraw()
      ).to.be.revertedWith("0x3C"); // Error code for zero balance
    });
  });

  describe("restartAfterPause", function () {
    it("should allow owner to restart after pause", async function () {
      // Pause the contract
      await cryptoMembershipNFT.setPaused(true);
      
      // Check paused state
      const pausedStatus = (await cryptoMembershipNFT.getContractStatus())[0];
      expect(pausedStatus).to.equal(true);
      
      // Restart after pause
      await expect(cryptoMembershipNFT.restartAfterPause())
        .to.emit(cryptoMembershipNFT, "ContractPaused")
        .withArgs(false);
      
      // Check unpaused state
      const unpausedStatus = (await cryptoMembershipNFT.getContractStatus())[0];
      expect(unpausedStatus).to.equal(false);
    });
    
    it("should revert when trying to restart a non-paused contract", async function () {
      // Try to restart a non-paused contract
      await expect(
        cryptoMembershipNFT.restartAfterPause()
      ).to.be.revertedWith("0x3D"); // Error code for contract not paused
    });
    
    it("should revert when non-owner tries to restart", async function () {
      // Pause the contract
      await cryptoMembershipNFT.setPaused(true);
      
      // Try to restart as non-owner
      await expect(
        cryptoMembershipNFT.connect(user1).restartAfterPause()
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("setPriceFeed", function () {
    it("should allow owner to set price feed", async function () {
      const newPriceFeed = user2.address; // Using user2 address as a mock price feed
      
      // Set price feed
      await expect(cryptoMembershipNFT.setPriceFeed(newPriceFeed))
        .to.emit(cryptoMembershipNFT, "PriceFeedUpdated")
        .withArgs(newPriceFeed);
      
      // Check price feed is updated
      expect(await cryptoMembershipNFT.priceFeed()).to.equal(newPriceFeed);
    });
    
    it("should revert when trying to set zero address as price feed", async function () {
      await expect(
        cryptoMembershipNFT.setPriceFeed(ethers.ZeroAddress)
      ).to.be.revertedWith("0x39"); // Error code for zero address
    });
    
    it("should revert when non-owner tries to set price feed", async function () {
      await expect(
        cryptoMembershipNFT.connect(user1).setPriceFeed(user2.address)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("setBaseURI", function () {
    it("should allow owner to set base URI", async function () {
      const newBaseURI = "https://api.example.com/nfts/";
      
      // Set base URI
      await cryptoMembershipNFT.setBaseURI(newBaseURI);
      
      // Cannot directly check _baseURI as it's private, but we can check indirectly
      // by minting a token and checking its URI
      await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
      const tokenId = await cryptoMembershipNFT.tokenOfOwnerByIndex(user1.address, 0);
      
      // The token URI should be in a data URL format, which is built using the base URI
      // So we can just check it's not empty
      const tokenURI = await cryptoMembershipNFT.tokenURI(tokenId);
      expect(tokenURI).to.not.equal("");
    });
    
    it("should revert when trying to set empty base URI", async function () {
      await expect(
        cryptoMembershipNFT.setBaseURI("")
      ).to.be.revertedWith("0x37"); // Error code for empty URI
    });
    
    it("should revert when non-owner tries to set base URI", async function () {
      await expect(
        cryptoMembershipNFT.connect(user1).setBaseURI("https://example.com/")
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });
});