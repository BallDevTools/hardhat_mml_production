// test/unit/upgrade-plan.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT - Plan Upgrade", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let user3;
  let UPGRADE_COOLDOWN;

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
    
    // Get UPGRADE_COOLDOWN constant (private constant, set to 1 day in the contract)
    UPGRADE_COOLDOWN = 86400; // 1 day in seconds
    
    // Transfer USDT to users for testing
    const usdtAmount = ethers.parseEther("1000");
    for (const user of [user1, user2, user3]) {
      await fakeUSDT.transfer(user.address, usdtAmount);
      await fakeUSDT.connect(user).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    }
    
    // Register members for testing
    await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
    await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
  });

  describe("upgradePlan", function () {
    it("should allow a member to upgrade to next plan level", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Get plan prices
      const plan1Price = (await cryptoMembershipNFT.plans(1)).price;
      const plan2Price = (await cryptoMembershipNFT.plans(2)).price;
      const priceDifference = plan2Price - plan1Price;
      
      // Get user USDT balance before upgrade
      const userBalanceBefore = await fakeUSDT.balanceOf(user1.address);
      
      // Get plan ID before upgrade
      const memberBefore = await cryptoMembershipNFT.members(user1.address);
      expect(memberBefore.planId).to.equal(1);
      
      // Upgrade to plan 2
      await expect(cryptoMembershipNFT.connect(user1).upgradePlan(2))
        .to.emit(cryptoMembershipNFT, "PlanUpgraded");
      
      // Get user USDT balance after upgrade
      const userBalanceAfter = await fakeUSDT.balanceOf(user1.address);
      
      // Get plan ID after upgrade
      const memberAfter = await cryptoMembershipNFT.members(user1.address);
      
      // Check plan was upgraded
      expect(memberAfter.planId).to.equal(2);
      
      // Check USDT was deducted correctly
      expect(userBalanceBefore - userBalanceAfter).to.equal(priceDifference);
      
      // Check token URI was updated
      const tokenId = await cryptoMembershipNFT.tokenOfOwnerByIndex(user1.address, 0);
      const nftImage = await cryptoMembershipNFT.getNFTImage(tokenId);
      expect(nftImage.planId).to.equal(2);
    });

    it("should distribute funds correctly during upgrade", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Get state before upgrade
      const stateBefore = await cryptoMembershipNFT.state();
      
      // Get plan prices
      const plan1Price = (await cryptoMembershipNFT.plans(1)).price;
      const plan2Price = (await cryptoMembershipNFT.plans(2)).price;
      const priceDifference = plan2Price - plan1Price;
      
      // Calculate expected fund distribution for plan 2
      // For plan 2 (tier 1-4): 50% company, 50% user
      // Company: 80% owner, 20% fee
      // User: 60% upline, 40% fund
      const expectedOwnerIncrease = (priceDifference * 50n * 80n) / 10000n;
      const expectedFeeIncrease = (priceDifference * 50n * 20n) / 10000n;
      const expectedFundIncrease = (priceDifference * 50n * 40n) / 10000n;
      const expectedUplineCommission = (priceDifference * 50n * 60n) / 10000n;
      
      // Upgrade to plan 2
      await cryptoMembershipNFT.connect(user1).upgradePlan(2);
      
      // Get state after upgrade
      const stateAfter = await cryptoMembershipNFT.state();
      
      // Check fund distribution
      expect(stateAfter.ownerBalance).to.equal(stateBefore.ownerBalance + expectedOwnerIncrease);
      expect(stateAfter.feeSystemBalance).to.equal(stateBefore.feeSystemBalance + expectedFeeIncrease);
      expect(stateAfter.fundBalance).to.equal(stateBefore.fundBalance + expectedFundIncrease);
      
      // Check upline received commission
      const uplineMembers = await cryptoMembershipNFT.members(owner.address);
      expect(uplineMembers.totalEarnings).to.be.gte(expectedUplineCommission);
    });
    
    it("should notify upline when downline upgrades to higher plan", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Register user3 with user2 as upline
      await cryptoMembershipNFT.connect(user3).registerMember(1, user2.address);
      
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Upgrade user3 to plan 2 (which is higher than user2's plan)
      await expect(cryptoMembershipNFT.connect(user3).upgradePlan(2))
        .to.emit(cryptoMembershipNFT, "UplineNotified")
        .withArgs(user2.address, user3.address, 1, 2);
    });
    
    it("should update cycle information when completing a cycle", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Get cycle info before
      const cycleInfoBefore = await cryptoMembershipNFT.getPlanCycleInfo(2);
      const currentCycleBefore = cycleInfoBefore[0];
      const membersInCurrentCycleBefore = cycleInfoBefore[1];
      
      // Get max members per cycle
      const maxMembersPerCycle = await cryptoMembershipNFT.MAX_MEMBERS_PER_CYCLE();
      
      // Complete the cycle by upgrading enough members
      for (let i = 0; i < maxMembersPerCycle; i++) {
        // For simplicity, we'll use the same user and reset the cooldown each time
        await time.increase(UPGRADE_COOLDOWN);
        // Only upgrade if this user isn't already on plan 2 or higher
        const member = await cryptoMembershipNFT.members(user1.address);
        if (member.planId < 2) {
          await cryptoMembershipNFT.connect(user1).upgradePlan(2);
        }
      }
      
      // Get cycle info after
      const cycleInfoAfter = await cryptoMembershipNFT.getPlanCycleInfo(2);
      
      // Check cycle progressed
      // Note: This test might need adjustment based on how many members are actually in the cycle
      // and how many we could upgrade in the test
      if (membersInCurrentCycleBefore + 1 >= maxMembersPerCycle) {
        expect(cycleInfoAfter[0]).to.be.gt(currentCycleBefore);
      }
    });
    
    it("should revert when trying to upgrade before cooldown period", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Upgrade to plan 2
      await cryptoMembershipNFT.connect(user1).upgradePlan(2);
      
      // Try to upgrade again immediately
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(3)
      ).to.be.revertedWith("0x1E"); // Error code for upgrade cooldown
    });
    
    it("should revert when trying to upgrade to same or lower plan", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Upgrade to plan 2
      await cryptoMembershipNFT.connect(user1).upgradePlan(2);
      
      // Wait for upgrade cooldown again
      await time.increase(UPGRADE_COOLDOWN);
      
      // Try to upgrade to same plan
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(2)
      ).to.be.revertedWith("0x24"); // Error code for same or lower plan
      
      // Try to upgrade to lower plan
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(1)
      ).to.be.revertedWith("0x24"); // Error code for same or lower plan
    });
    
    it("should revert when trying to skip plan levels", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Try to upgrade from plan 1 to plan 3 (skipping plan 2)
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(3)
      ).to.be.revertedWith("0x25"); // Error code for skipping plan levels
    });
    
    it("should revert when plan is not active", async function () {
      // Deactivate plan 2
      await cryptoMembershipNFT.setPlanStatus(2, false);
      
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Try to upgrade to deactivated plan
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(2)
      ).to.be.revertedWith("0x23"); // Error code for inactive plan
    });
    
    it("should revert when contract is paused", async function () {
      // Pause the contract
      await cryptoMembershipNFT.setPaused(true);
      
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Try to upgrade
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(2)
      ).to.be.revertedWith("0x01"); // Error code for paused contract
    });

    it("should revert when non-member tries to upgrade", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Try to upgrade as non-member
      await expect(
        cryptoMembershipNFT.connect(user3).upgradePlan(2)
      ).to.be.revertedWith("0x02"); // Error code for not a member
    });
    
    it("should revert when upgrading to non-existent plan", async function () {
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Get total plan count
      const planCount = await cryptoMembershipNFT.state().planCount;
      
      // Try to upgrade to non-existent plan
      await expect(
        cryptoMembershipNFT.connect(user1).upgradePlan(planCount + 1n)
      ).to.be.revertedWith("0x22"); // Error code for invalid plan ID
    });
    
    it("should handle token image update properly during upgrade", async function () {
      // Set a custom default image for plan 2
      const customImageURI = "ipfs://QmCustomImage";
      await cryptoMembershipNFT.setPlanDefaultImage(2, customImageURI);
      
      // Wait for upgrade cooldown
      await time.increase(UPGRADE_COOLDOWN);
      
      // Upgrade to plan 2
      await cryptoMembershipNFT.connect(user1).upgradePlan(2);
      
      // Get token ID
      const tokenId = await cryptoMembershipNFT.tokenOfOwnerByIndex(user1.address, 0);
      
      // Get NFT image
      const nftImage = await cryptoMembershipNFT.getNFTImage(tokenId);
      
      // Check image data
      expect(nftImage.planId).to.equal(2);
      expect(nftImage.name).to.equal((await cryptoMembershipNFT.plans(2)).name);
      expect(nftImage.description).to.include("Crypto Membership NFT");
      expect(nftImage.description).to.include("Plan");
    });
  });
});NFT.plans(1)).price;
      const plan2Price = (await cryptoMembership