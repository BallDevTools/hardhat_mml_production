// test/unit/query-functions.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT - Query Functions", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let user3;
  let additionalUsers = [];

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3, ...additionalUsers] = await ethers.getSigners();
    
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
    
    // Transfer USDT to users for testing
    const usdtAmount = ethers.parseEther("1000");
    for (const user of [user1, user2, user3, ...additionalUsers]) {
      await fakeUSDT.transfer(user.address, usdtAmount);
      await fakeUSDT.connect(user).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    }
    
    // Register members for testing
    await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
    await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
  });

  describe("getPlanCycleInfo", function () {
    it("should return correct plan cycle information", async function () {
      // Get cycle info for plan 1
      const cycleInfo = await cryptoMembershipNFT.getPlanCycleInfo(1);
      
      // Extract values
      const currentCycle = cycleInfo[0];
      const membersInCurrentCycle = cycleInfo[1];
      const membersPerCycle = cycleInfo[2];
      
      // Check values
      expect(currentCycle).to.be.gt(0); // Should be at least cycle 1
      expect(membersInCurrentCycle).to.equal(2); // Two members registered
      expect(membersPerCycle).to.equal(await cryptoMembershipNFT.MAX_MEMBERS_PER_CYCLE());
    });
    
    it("should update cycle info after registering max members per cycle", async function () {
      // Get max members per cycle
      const maxMembersPerCycle = await cryptoMembershipNFT.MAX_MEMBERS_PER_CYCLE();
      
      // Get cycle info before
      const cycleInfoBefore = await cryptoMembershipNFT.getPlanCycleInfo(1);
      const currentCycleBefore = cycleInfoBefore[0];
      const membersInCurrentCycleBefore = cycleInfoBefore[1];
      
      // Register enough additional members to complete the cycle
      const remainingMembers = maxMembersPerCycle - membersInCurrentCycleBefore;
      
      for (let i = 0; i < remainingMembers; i++) {
        await cryptoMembershipNFT.connect(additionalUsers[i]).registerMember(1, user1.address);
      }
      
      // Get cycle info after
      const cycleInfoAfter = await cryptoMembershipNFT.getPlanCycleInfo(1);
      const currentCycleAfter = cycleInfoAfter[0];
      const membersInCurrentCycleAfter = cycleInfoAfter[1];
      
      // Check values
      expect(currentCycleAfter).to.equal(currentCycleBefore + 1n); // Cycle should increment
      expect(membersInCurrentCycleAfter).to.equal(0); // Members in new cycle should be 0
    });
    
    it("should revert when querying non-existent plan", async function () {
      // Get total plan count
      const planCount = await cryptoMembershipNFT.state().planCount;
      
      // Try to get cycle info for non-existent plan
      await expect(
        cryptoMembershipNFT.getPlanCycleInfo(planCount + 1n)
      ).to.be.revertedWith("0x34"); // Error code for invalid plan ID
    });
  });

  describe("getSystemStats", function () {
    it("should return correct system statistics", async function () {
      // Get system stats
      const stats = await cryptoMembershipNFT.getSystemStats();
      
      // Extract values
      const totalMembers = stats[0];
      const totalRevenue = stats[1];
      const totalCommission = stats[2];
      const ownerFunds = stats[3];
      const feeFunds = stats[4];
      const fundFunds = stats[5];
      
      // Check values
      expect(totalMembers).to.equal(2); // Two members registered
      expect(totalRevenue).to.be.gt(0); // Should have positive revenue
      
      // Check that individual funds add up to total revenue
      const totalFunds = ownerFunds + feeFunds + fundFunds + totalCommission;
      expect(totalFunds).to.equal(totalRevenue);
    });
    
    it("should update stats after new member registration", async function () {
      // Get stats before
      const statsBefore = await cryptoMembershipNFT.getSystemStats();
      
      // Register a new member
      await cryptoMembershipNFT.connect(user3).registerMember(1, user1.address);
      
      // Get stats after
      const statsAfter = await cryptoMembershipNFT.getSystemStats();
      
      // Check values
      expect(statsAfter[0]).to.equal(statsBefore[0] + 1n); // totalMembers should increase by 1
      expect(statsAfter[1]).to.be.gt(statsBefore[1]); // totalRevenue should increase
    });
  });

  describe("getContractStatus", function () {
    it("should return correct contract status", async function () {
      // Get contract status
      const status = await cryptoMembershipNFT.getContractStatus();
      
      // Extract values
      const isPaused = status[0];
      const totalBalance = status[1];
      const memberCount = status[2];
      const currentPlanCount = status[3];
      const hasEmergencyRequest = status[4];
      const emergencyTimeRemaining = status[5];
      
      // Check values
      expect(isPaused).to.equal(false); // Not paused initially
      expect(totalBalance).to.be.gt(0); // Should have positive balance
      expect(memberCount).to.equal(2); // Two members registered
      expect(currentPlanCount).to.equal(16); // Default 16 plans
      expect(hasEmergencyRequest).to.equal(false); // No emergency request initially
      expect(emergencyTimeRemaining).to.equal(0); // No emergency time remaining
    });
    
    it("should update status after contract is paused", async function () {
      // Pause the contract
      await cryptoMembershipNFT.setPaused(true);
      
      // Get status after
      const statusAfter = await cryptoMembershipNFT.getContractStatus();
      
      // Check isPaused is true
      expect(statusAfter[0]).to.equal(true);
    });
    
    it("should update status after emergency request", async function () {
      // Request emergency withdrawal
      await cryptoMembershipNFT.requestEmergencyWithdraw();
      
      // Get status after
      const statusAfter = await cryptoMembershipNFT.getContractStatus();
      
      // Check values
      expect(statusAfter[4]).to.equal(true); // hasEmergencyRequest should be true
      expect(statusAfter[5]).to.be.gt(0); // emergencyTimeRemaining should be positive
    });
  });

  describe("validateContractBalance", function () {
    it("should validate contract balance correctly", async function () {
      // Get validation result
      const result = await cryptoMembershipNFT.validateContractBalance();
      
      // Extract values
      const isValid = result[0];
      const expectedBalance = result[1];
      const actualBalance = result[2];
      
      // Check values
      expect(isValid).to.equal(true); // Balance should be valid
      expect(actualBalance).to.equal(expectedBalance); // Actual and expected balance should match
      
      // Get state balances
      const state = await cryptoMembershipNFT.state();
      const sumOfBalances = state.ownerBalance + state.feeSystemBalance + state.fundBalance;
      
      // Check that expected balance matches sum of balances
      expect(expectedBalance).to.equal(sumOfBalances);
    });
    
    it("should remain valid after withdrawals", async function () {
      // Get state balances
      const state = await cryptoMembershipNFT.state();
      
      // Withdraw half of owner balance
      if (state.ownerBalance > 0) {
        await cryptoMembershipNFT.withdrawOwnerBalance(state.ownerBalance / 2n);
      }
      
      // Get validation result after withdrawal
      const result = await cryptoMembershipNFT.validateContractBalance();
      
      // Check balance is still valid
      expect(result[0]).to.equal(true);
    });
  });

  describe("getNFTImage", function () {
    it("should return correct NFT image data", async function () {
      // Get token ID
      const tokenId = await cryptoMembershipNFT.tokenOfOwnerByIndex(user1.address, 0);
      
      // Get NFT image
      const image = await cryptoMembershipNFT.getNFTImage(tokenId);
      
      // Extract values
      const imageURI = image.imageURI;
      const name = image.name;
      const description = image.description;
      const planId = image.planId;
      const createdAt = image.createdAt;
      
      // Check values
      expect(imageURI).to.not.equal(""); // Should have non-empty URI
      expect(name).to.not.equal(""); // Should have non-empty name
      expect(description).to.include("Crypto Membership NFT"); // Description should contain expected text
      expect(planId).to.equal(1); // Should be plan 1
      expect(createdAt).to.be.gt(0); // Should have valid creation timestamp
    });
    
    it("should revert when querying non-existent token", async function () {
      // Try to get image for non-existent token
      const nonExistentTokenId = 999;
      
      await expect(
        cryptoMembershipNFT.getNFTImage(nonExistentTokenId)
      ).to.be.revertedWith("0x10"); // Error code for non-existent token
    });
  });

  describe("tokenURI", function () {
    it("should return valid token URI in data URL format", async function () {
      // Get token ID
      const tokenId = await cryptoMembershipNFT.tokenOfOwnerByIndex(user1.address, 0);
      
      // Get token URI
      const tokenURI = await cryptoMembershipNFT.tokenURI(tokenId);
      
      // Check format
      expect(tokenURI).to.include("data:application/json;base64,"); // Should be data URL
      
      // Decode base64 content
      const base64Content = tokenURI.replace("data:application/json;base64,", "");
      const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
      
      // Parse JSON content
      const jsonContent = JSON.parse(decodedContent);
      
      // Check JSON structure
      expect(jsonContent).to.have.property("name");
      expect(jsonContent).to.have.property("description");
      expect(jsonContent).to.have.property("image");
      expect(jsonContent).to.have.property("attributes");
      
      // Check attributes
      expect(jsonContent.attributes[0].trait_type).to.equal("Plan Level");
      expect(jsonContent.attributes[0].value).to.equal("1");
    });
    
    it("should revert when querying non-existent token", async function () {
      // Try to get URI for non-existent token
      const nonExistentTokenId = 999;
      
      await expect(
        cryptoMembershipNFT.tokenURI(nonExistentTokenId)
      ).to.be.revertedWith("0x11"); // Error code for non-existent token
    });
  });
});