// Create a new test file: test/security/EmergencyWithdrawTests.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Emergency Withdrawal Edge Cases", function () {
  async function deployWithFundsFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy tokens and contract
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(usdt.target, owner.address);
    
    // Setup funds by registering users
    const amount = ethers.parseEther("100");
    for (const user of [user1, user2, user3]) {
      await usdt.transfer(user.address, amount);
      await usdt.connect(user).approve(nft.target, amount);
    }
    
    // Register users with delays to avoid TooSoon errors
    await nft.connect(user1).registerMember(1, owner.address);
    
    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine");
    
    await nft.connect(user2).registerMember(1, user1.address);
    
    return { nft, usdt, owner, user1, user2, user3 };
  }

  it("Should handle emergency withdrawal when contractBalance < expectedBalance", async function () {
    const { nft, usdt, owner } = await loadFixture(deployWithFundsFixture);
    
    // Get current balances
    const systemStats = await nft.getSystemStats();
    const expectedBalance = systemStats[3] + systemStats[4] + systemStats[5];
    const contractBalance = await usdt.balanceOf(nft.target);
    
    // Remove some tokens directly (simulating an issue)
    // This could be done by transferring tokens using a backdoor in a test token
    // or by manipulating the state in a test environment
    const amountToRemove = contractBalance / 2n;
    await usdt.connect(owner).transfer(owner.address, amountToRemove);
    
    // Request emergency withdrawal
    await nft.connect(owner).requestEmergencyWithdraw();
    
    // Wait for timelock to expire
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");
    
    // Perform emergency withdrawal
    const ownerBalanceBefore = await usdt.balanceOf(owner.address);
    await nft.connect(owner).emergencyWithdraw();
    const ownerBalanceAfter = await usdt.balanceOf(owner.address);
    
    // Verify that proportional distribution worked correctly
    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(contractBalance - amountToRemove);
    
    // Verify that all balances were reset
    const statsAfter = await nft.getSystemStats();
    expect(statsAfter[3]).to.equal(0); // ownerFunds
    expect(statsAfter[4]).to.equal(0); // feeFunds
    expect(statsAfter[5]).to.equal(0); // fundFunds
  });

  it("Should handle emergency withdrawal cancellation scenarios", async function() {
    const { nft, owner } = await loadFixture(deployWithFundsFixture);
    
    // Request emergency withdrawal
    await nft.connect(owner).requestEmergencyWithdraw();
    
    // Verify request is active
    let contractStatus = await nft.getContractStatus();
    expect(contractStatus[4]).to.equal(true); // hasEmergencyRequest
    
    // Cancel request
    await nft.connect(owner).cancelEmergencyWithdraw();
    
    // Verify request is cancelled
    contractStatus = await nft.getContractStatus();
    expect(contractStatus[4]).to.equal(false); // hasEmergencyRequest
    
    // Attempt withdrawal should fail
    await expect(
      nft.connect(owner).emergencyWithdraw()
    ).to.be.revertedWithCustomError(nft, "NoRequest");
    
    // Request again
    await nft.connect(owner).requestEmergencyWithdraw();
    
    // Wait for half the timelock duration
    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    
    // Attempt withdrawal should fail due to timelock
    await expect(
      nft.connect(owner).emergencyWithdraw()
    ).to.be.revertedWithCustomError(nft, "TimelockActive");
    
    // Cancel again
    await nft.connect(owner).cancelEmergencyWithdraw();
    
    // Wait for full timelock duration
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    
    // Attempt withdrawal should still fail due to cancelled request
    await expect(
      nft.connect(owner).emergencyWithdraw()
    ).to.be.revertedWithCustomError(nft, "NoRequest");
  });
});