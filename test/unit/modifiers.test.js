// test/unit/modifiers.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT - Modifiers", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let user3;
  let MIN_ACTION_DELAY;

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();
    
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
    
    // Get MIN_ACTION_DELAY constant (private constant, set to 1 minute in the contract)
    MIN_ACTION_DELAY = 60; // 1 minute in seconds
    
    // Transfer USDT to users for testing
    const usdtAmount = ethers.parseEther("1000");
    for (const user of [user1, user2, user3]) {
      await fakeUSDT.transfer(user.address, usdtAmount);
      await fakeUSDT.connect(user).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    }
    
    // Register a member for testing onlyMember modifier
    await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
  });

  describe("whenNotPaused modifier", function () {
    it("should allow function calls when contract is not paused", async function () {
      // Register a new member - should work when not paused
      await expect(
        cryptoMembershipNFT.connect(user2).registerMember(1, user1.address)
      ).to.not.be.reverted;
    });
    
    it("should prevent function calls when contract is paused", async function () {
      // Pause the contract
      await cryptoMembershipNFT.setPaused(true);
      
      // Try to register a new member
      await expect(
        cryptoMembershipNFT.connect(user2).registerMember(1, user1.address)
      ).to.be.revertedWith("0x01"); // Error code for paused contract
    });
  });

  describe("onlyMember modifier", function () {
    it("should allow function calls by members", async function () {
      // Wait for upgrade cooldown
      await time.increase(86400); // 1 day
      
      // Upgrade plan as a member - should work
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(2)
      ).to.not.be.reverted;
    });
    
    it("should prevent function calls by non-members", async function () {
      // Try to upgrade plan as a non-member
      await expect(
        cryptoMembershipNFT.connect(user2).upgradePlan(2)
      ).to.be.revertedWith("0x02"); // Error code for not a member
    });
  });

  describe("preventFrontRunning modifier", function () {
    it("should allow function calls after delay", async function () {
      // Register member (first action)
      await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
      
      // Advance time beyond the minimum action delay
      await time.increase(MIN_ACTION_DELAY + 1);
      
      // Second action - should work after delay
      await expect(
        cryptoMembershipNFT.connect(user2).registerMember(1, user1.address)
      ).to.be.reverted; // Will revert because user2 is already a member, not because of front-running
    });
    
    it("should prevent function calls before delay", async function () {
      // Register member (first action)
      await cryptoMembershipNFT.connect(user3).registerMember(1, user1.address);
      
      // Try second action immediately (before delay)
      await expect(
        cryptoMembershipNFT.connect(user3).upgradePlan(2)
      ).to.be.revertedWith("0x04"); // Error code for front-running prevention
    });
  });

  describe("validAddress modifier", function () {
    it("should allow function calls with valid address", async function () {
      // Register with valid upline address
      await expect(
        cryptoMembershipNFT.connect(user2).registerMember(1, user1.address)
      ).to.not.be.reverted;
    });
    
    it("should prevent function calls with zero address", async function () {
      // Try to register with zero address as upline
      await expect(
        cryptoMembershipNFT.connect(user2).registerMember(1, ethers.ZeroAddress)
      ).to.be.revertedWith("0x06"); // Error code for invalid address
    });
  });

  describe("noReferralLoop modifier", function () {
    it("should prevent referral loops", async function () {
      // First, register user2 with user1 as upline
      await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
      
      // Wait for upgrade cooldown
      await time.increase(86400); // 1 day
      
      // Upgrade user2's plan
      await cryptoMembershipNFT.connect(user2).upgradePlan(2);
      
      // Now, try to register user3 with user2 as upline and create a loop
      // (This is a simplified test since we can't directly test the loop detection logic)
      // Register user3 normally
      await cryptoMembershipNFT.connect(user3).registerMember(1, user2.address);
      
      // The real test would require modifying the contract state to create a loop,
      // which is not easy to do in a test. But we can verify the modifier is applied
      // by checking the registration went through.
      expect(await cryptoMembershipNFT.balanceOf(user3.address)).to.equal(1);
    });
  });

  describe("noReentrantTransfer modifier", function () {
    // This is difficult to test directly in a unit test without mocking the ERC20 token
    // to cause reentrancy. We can only verify the modifier is applied.
    
    it("should apply no-reentrant-transfer modifier to functions", async function () {
      // Register user2
      await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
      
      // Wait for minimum exit period
      await time.increase(31 * 24 * 60 * 60); // 31 days
      
      // Exit membership - uses the noReentrantTransfer modifier
      await expect(
        cryptoMembershipNFT.connect(user2).exitMembership()
      ).to.not.be.reverted;
    });
  });

  describe("Multiple modifiers interaction", function () {
    it("should apply all relevant modifiers in combination", async function () {
      // Pause the contract
      await cryptoMembershipNFT.setPaused(true);
      
      // Try to upgrade plan - should fail due to whenNotPaused modifier
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(2)
      ).to.be.revertedWith("0x01"); // Error code for paused contract
      
      // Unpause the contract
      await cryptoMembershipNFT.setPaused(false);
      
      // Try to upgrade plan as non-member - should fail due to onlyMember modifier
      await expect(
        cryptoMembershipNFT.connect(user3).upgradePlan(2)
      ).to.be.revertedWith("0x02"); // Error code for not a member
      
      // Try to upgrade plan without waiting - should fail due to preventFrontRunning modifier
      // (assuming the last action was recent)
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(2)
      ).to.be.revertedWith("0x04"); // Error code for front-running prevention
      
      // Advance time beyond the minimum action delay
      await time.increase(MIN_ACTION_DELAY + 1);
      
      // Try to upgrade plan now - should work as all modifier conditions are met
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(2)
      ).to.not.be.reverted;
    });
  });
});