// test/unit/plans-management.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT - Plan Management", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let MAX_MEMBERS_PER_CYCLE;

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
    
    // Get contract constants
    MAX_MEMBERS_PER_CYCLE = await cryptoMembershipNFT.MAX_MEMBERS_PER_CYCLE();

    // Transfer USDT to users for testing
    const usdtAmount = ethers.parseEther("1000");
    await fakeUSDT.transfer(user1.address, usdtAmount);
    await fakeUSDT.connect(user1).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    await fakeUSDT.transfer(user2.address, usdtAmount);
    await fakeUSDT.connect(user2).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
  });

  describe("createPlan", function () {
    it("should create a new plan with valid parameters", async function () {
      const planPrice = ethers.parseEther("20");
      const planName = "Platinum Plan";
      const membersPerCycle = MAX_MEMBERS_PER_CYCLE;
      
      // Get current plan count
      const planCountBefore = await cryptoMembershipNFT.state().planCount;
      
      // Create plan
      await cryptoMembershipNFT.createPlan(planPrice, planName, membersPerCycle);
      
      // Get new plan count
      const planCountAfter = await cryptoMembershipNFT.state().planCount;
      
      // Expect plan count to increase by 1
      expect(planCountAfter).to.equal(planCountBefore + 1n);
      
      // Check the new plan
      const newPlan = await cryptoMembershipNFT.plans(planCountAfter);
      expect(newPlan.price).to.equal(planPrice);
      expect(newPlan.name).to.equal(planName);
      expect(newPlan.membersPerCycle).to.equal(membersPerCycle);
      expect(newPlan.isActive).to.equal(true);
      
      // Check cycle info for the new plan
      const cycleInfo = await cryptoMembershipNFT.planCycles(planCountAfter);
      expect(cycleInfo.currentCycle).to.equal(1);
      expect(cycleInfo.membersInCurrentCycle).to.equal(0);
    });

    it("should revert when creating a plan with price lower than the last plan", async function () {
      const lastPlanId = await cryptoMembershipNFT.state().planCount;
      const lastPlan = await cryptoMembershipNFT.plans(lastPlanId);
      
      // Try to create a plan with lower price
      const lowerPrice = lastPlan.price - 1n;
      await expect(
        cryptoMembershipNFT.createPlan(lowerPrice, "Cheaper Plan", MAX_MEMBERS_PER_CYCLE)
      ).to.be.revertedWith("New plan price must be higher than previous plan");
    });

    it("should revert when creating a plan with empty name", async function () {
      const planPrice = ethers.parseEther("20");
      const emptyName = "";
      
      await expect(
        cryptoMembershipNFT.createPlan(planPrice, emptyName, MAX_MEMBERS_PER_CYCLE)
      ).to.be.revertedWith("0x0C"); // Error code for empty name
    });

    it("should revert when creating a plan with zero price", async function () {
      const zeroPrice = 0;
      const planName = "Free Plan";
      
      await expect(
        cryptoMembershipNFT.createPlan(zeroPrice, planName, MAX_MEMBERS_PER_CYCLE)
      ).to.be.revertedWith("0x0D"); // Error code for zero price
    });

    it("should revert when creating a plan with different members per cycle", async function () {
      const planPrice = ethers.parseEther("20");
      const planName = "Special Plan";
      const diffMembersPerCycle = MAX_MEMBERS_PER_CYCLE.valueOf() + 1;
      
      await expect(
        cryptoMembershipNFT.createPlan(planPrice, planName, diffMembersPerCycle)
      ).to.be.revertedWith("0x0B"); // Error code for invalid members per cycle
    });

    it("should revert when non-owner tries to create a plan", async function () {
      const planPrice = ethers.parseEther("20");
      const planName = "Unauthorized Plan";
      
      await expect(
        cryptoMembershipNFT.connect(user1).createPlan(planPrice, planName, MAX_MEMBERS_PER_CYCLE)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("setPlanStatus", function () {
    it("should allow owner to enable/disable a plan", async function () {
      const planId = 2; // Use plan ID 2 for testing
      
      // Check initial status
      const initialStatus = (await cryptoMembershipNFT.plans(planId)).isActive;
      
      // Disable plan
      await cryptoMembershipNFT.setPlanStatus(planId, false);
      
      // Check plan is disabled
      expect((await cryptoMembershipNFT.plans(planId)).isActive).to.equal(false);
      
      // Enable plan again
      await cryptoMembershipNFT.setPlanStatus(planId, true);
      
      // Check plan is enabled
      expect((await cryptoMembershipNFT.plans(planId)).isActive).to.equal(true);
    });

    it("should revert when trying to set status for non-existent plan", async function () {
      const nonExistentPlanId = (await cryptoMembershipNFT.state().planCount) + 1n;
      
      await expect(
        cryptoMembershipNFT.setPlanStatus(nonExistentPlanId, true)
      ).to.be.revertedWith("0x38"); // Error code for invalid plan ID
    });

    it("should revert when non-owner tries to set plan status", async function () {
      await expect(
        cryptoMembershipNFT.connect(user1).setPlanStatus(1, false)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("updateMembersPerCycle", function () {
    it("should allow owner to update members per cycle", async function () {
      const planId = 3; // Use plan ID 3 for testing
      
      // Check initial members per cycle
      const initialMembersPerCycle = (await cryptoMembershipNFT.plans(planId)).membersPerCycle;
      
      // Update members per cycle (to the same value as MAX_MEMBERS_PER_CYCLE since it's enforced)
      await cryptoMembershipNFT.updateMembersPerCycle(planId, MAX_MEMBERS_PER_CYCLE);
      
      // Check members per cycle is updated
      expect((await cryptoMembershipNFT.plans(planId)).membersPerCycle).to.equal(MAX_MEMBERS_PER_CYCLE);
    });

    it("should revert when trying to set different value than MAX_MEMBERS_PER_CYCLE", async function () {
      const planId = 3;
      const differentValue = MAX_MEMBERS_PER_CYCLE.valueOf() + 1;
      
      await expect(
        cryptoMembershipNFT.updateMembersPerCycle(planId, differentValue)
      ).to.be.revertedWith("0x36"); // Error code for invalid members per cycle
    });

    it("should revert when trying to update non-existent plan", async function () {
      const nonExistentPlanId = (await cryptoMembershipNFT.state().planCount) + 1n;
      
      await expect(
        cryptoMembershipNFT.updateMembersPerCycle(nonExistentPlanId, MAX_MEMBERS_PER_CYCLE)
      ).to.be.revertedWith("0x35"); // Error code for invalid plan ID
    });

    it("should revert when non-owner tries to update members per cycle", async function () {
      await expect(
        cryptoMembershipNFT.connect(user1).updateMembersPerCycle(1, MAX_MEMBERS_PER_CYCLE)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("setPlanDefaultImage", function () {
    it("should allow owner to set plan default image", async function () {
      const planId = 4; // Use plan ID 4 for testing
      const imageURI = "ipfs://QmNewDefaultImage";
      
      // Set default image
      await cryptoMembershipNFT.setPlanDefaultImage(planId, imageURI);
      
      // Check default image is set
      expect(await cryptoMembershipNFT.planDefaultImages(planId)).to.equal(imageURI);
    });

    it("should emit PlanDefaultImageSet event", async function () {
      const planId = 5;
      const imageURI = "ipfs://QmNewDefaultImage2";
      
      await expect(cryptoMembershipNFT.setPlanDefaultImage(planId, imageURI))
        .to.emit(cryptoMembershipNFT, "PlanDefaultImageSet")
        .withArgs(planId, imageURI);
    });

    it("should revert when trying to set image for non-existent plan", async function () {
      const nonExistentPlanId = (await cryptoMembershipNFT.state().planCount) + 1n;
      const imageURI = "ipfs://QmInvalidPlan";
      
      await expect(
        cryptoMembershipNFT.setPlanDefaultImage(nonExistentPlanId, imageURI)
      ).to.be.revertedWith("0x0E"); // Error code for invalid plan ID
    });

    it("should revert when trying to set empty imageURI", async function () {
      const planId = 4;
      const emptyURI = "";
      
      await expect(
        cryptoMembershipNFT.setPlanDefaultImage(planId, emptyURI)
      ).to.be.revertedWith("0x0F"); // Error code for empty imageURI
    });

    it("should revert when non-owner tries to set plan default image", async function () {
      const planId = 4;
      const imageURI = "ipfs://QmUnauthorized";
      
      await expect(
        cryptoMembershipNFT.connect(user1).setPlanDefaultImage(planId, imageURI)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("User registration after plan management", function () {
    it("should not allow registration for disabled plan", async function () {
      // Disable plan 1
      await cryptoMembershipNFT.setPlanStatus(1, false);
      
      // Try to register with disabled plan
      await expect(
        cryptoMembershipNFT.connect(user1).registerMember(1, owner.address)
      ).to.be.revertedWith("0x14"); // Error code for inactive plan
      
      // Re-enable plan for other tests
      await cryptoMembershipNFT.setPlanStatus(1, true);
    });

    it("should use updated default image for registration", async function () {
      // Set new default image for plan 1
      const newImageURI = "ipfs://QmUpdatedImage";
      await cryptoMembershipNFT.setPlanDefaultImage(1, newImageURI);
      
      // Register member
      await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
      
      // Get token ID
      const tokenId = await cryptoMembershipNFT.tokenOfOwnerByIndex(user1.address, 0);
      
      // Get NFT image
      const nftImage = await cryptoMembershipNFT.getNFTImage(tokenId);
      
      // Check image URI
      expect(nftImage.imageURI).to.equal(newImageURI);
    });
  });
});