// Create test/integration/StateConsistency.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("State Consistency Tests", function () {
  async function deployFixture() {
    // Standard deployment code...
  }
  
  it("Should maintain consistent state across all operations", async function() {
    const { nft, usdt, owner, user1, user2 } = await loadFixture(deployFixture);
    
    // Register members
    await nft.connect(user1).registerMember(1, owner.address);
    
    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine");
    
    await nft.connect(user2).registerMember(1, user1.address);
    
    // Check contract balance vs internal balances
    let validation = await nft.validateContractBalance();
    expect(validation[0]).to.equal(true); // balances should match
    
    // Perform withdrawals
    const systemStats = await nft.getSystemStats();
    
    if (systemStats[3] > 0) {
      await nft.connect(owner).withdrawOwnerBalance(systemStats[3]);
    }
    
    // Recheck state consistency
    validation = await nft.validateContractBalance();
    expect(validation[0]).to.equal(true); // balances should still match
    
    // Register another member
    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine");
    
    const user3 = (await ethers.getSigners())[3];
    await usdt.transfer(user3.address, ethers.parseEther("100"));
    await usdt.connect(user3).approve(nft.target, ethers.parseEther("100"));
    
    await nft.connect(user3).registerMember(1, user2.address);
    
    // Check consistency again
    validation = await nft.validateContractBalance();
    expect(validation[0]).to.equal(true); // balances should still match
  });
});