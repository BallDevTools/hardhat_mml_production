// test/integration/membership-flow.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Membership Full Flow", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;
  let user5;

  before(async function () {
    // Get signers
    [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    
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
    for (const user of [user1, user2, user3, user4, user5]) {
      await fakeUSDT.transfer(user.address, usdtAmount);
      await fakeUSDT.connect(user).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    }
  });

  it("should execute a full membership cycle with registrations, upgrades, and exit", async function () {
    // Step 1: Register first user (user1)
    await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
    expect(await cryptoMembershipNFT.balanceOf(user1.address)).to.equal(1);
    
    // Step 2: Register user2 with user1 as upline
    await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
    expect(await cryptoMembershipNFT.balanceOf(user2.address)).to.equal(1);
    
    // Step 3: Register users 3 and 4 to complete a cycle
    await cryptoMembershipNFT.connect(user3).registerMember(1, user1.address);
    await cryptoMembershipNFT.connect(user4).registerMember(1, user2.address);
    
    // Step 4: Check cycle is complete and new cycle started
    const cycleInfo = await cryptoMembershipNFT.getPlanCycleInfo(1);
    expect(cycleInfo[0]).to.be.gt(1); // currentCycle > 1
    
    // Step 5: Upgrade user1 to plan 2
    await time.increase(86400); // Wait 1 day for upgrade cooldown
    await cryptoMembershipNFT.connect(user1).upgradePlan(2);
    
    // Verify upgrade
    const user1Member = await cryptoMembershipNFT.members(user1.address);
    expect(user1Member.planId).to.equal(2);
    
    // Step 6: Register user5 in the new cycle
    await cryptoMembershipNFT.connect(user5).registerMember(1, user2.address);
    
    // Step 7: Let user5 exit membership after 30 days
    await time.increase(30 * 86400);
    
    const balanceBefore = await fakeUSDT.balanceOf(user5.address);
    await cryptoMembershipNFT.connect(user5).exitMembership();
    const balanceAfter = await fakeUSDT.balanceOf(user5.address);
    
    // Verify user5 received refund
    expect(balanceAfter).to.be.gt(balanceBefore);
    
    // Verify user5 is no longer a member
    expect(await cryptoMembershipNFT.balanceOf(user5.address)).to.equal(0);
    
    // Step 8: Check contract stats
    const stats = await cryptoMembershipNFT.getSystemStats();
    expect(stats[0]).to.equal(4); // totalMembers = 4 (user5 exited)
  });
});