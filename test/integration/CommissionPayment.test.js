// Add to test/integration/CommissionPayment.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Commission Payment Chain", function () {
  async function deployFixture() {
    const [owner, ...signers] = await ethers.getSigners();
    const users = signers.slice(0, 10); // Get 10 users for deep chain
    
    // Standard deployment code...
    // Initialize with large amounts...
    
    return { nft, usdt, owner, users };
  }
  
  it("Should handle deep referral commission chains", async function() {
    const { nft, usdt, owner, users } = await loadFixture(deployFixture);
    
    // Create a chain of 10 users, each referring the next
    let uplineAddress = owner.address;
    
    for (let i = 0; i < users.length; i++) {
      // Register member with previous as upline
      await nft.connect(users[i]).registerMember(1, uplineAddress);
      
      // Store user's earnings before next registration
      if (i > 0) {
        users[i-1].earningsBefore = await nft.members(users[i-1].address).then(m => m.totalEarnings);
      }
      
      // Update upline for next user
      uplineAddress = users[i].address;
      
      // Wait to avoid TooSoon error
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine");
    }
    
    // Check commission payments
    for (let i = 0; i < users.length - 1; i++) {
      const memberData = await nft.members(users[i].address);
      
      if (i > 0) {
        // Check if earnings increased from the previous value
        expect(memberData.totalEarnings).to.be.gt(users[i].earningsBefore || 0);
      }
      
      // Every member except the last should have exactly 1 referral
      expect(memberData.totalReferrals).to.equal(1);
    }
    
    // Check the last member has no referrals
    const lastMember = await nft.members(users[users.length - 1].address);
    expect(lastMember.totalReferrals).to.equal(0);
  });
});