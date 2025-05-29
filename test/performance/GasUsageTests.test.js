// Create test/performance/GasUsageTests.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Gas Usage Optimization", function () {
  async function deployWithMembersFixture() {
    // Setup code with multiple members...
  }
  
  it("Should optimize gas usage for batch operations", async function() {
    const { nft, usdt, owner, users } = await loadFixture(deployWithMembersFixture);
    
    // Create withdrawal requests
    const withdrawalRequests = [
      {
        recipient: owner.address,
        amount: ethers.parseEther("0.1"),
        balanceType: 0 // owner
      },
      {
        recipient: users[0].address,
        amount: ethers.parseEther("0.1"),
        balanceType: 1 // fee
      },
      {
        recipient: users[1].address,
        amount: ethers.parseEther("0.1"),
        balanceType: 2 // fund
      }
    ];
    
    // Measure gas for batch withdrawal
    const batchTx = await nft.connect(owner).batchWithdraw(withdrawalRequests);
    const batchReceipt = await batchTx.wait();
    const batchGasUsed = batchReceipt.gasUsed;
    
    // Reset the contract state
    // This would require redeploying or a special test setup
    
    // Measure gas for individual withdrawals
    let individualGasUsed = 0n;
    
    // Owner balance withdrawal
    const tx1 = await nft.connect(owner).withdrawOwnerBalance(ethers.parseEther("0.1"));
    const receipt1 = await tx1.wait();
    individualGasUsed += receipt1.gasUsed;
    
    // Fee balance withdrawal
    const tx2 = await nft.connect(owner).withdrawFeeSystemBalance(ethers.parseEther("0.1"));
    const receipt2 = await tx2.wait();
    individualGasUsed += receipt2.gasUsed;
    
    // Fund balance withdrawal
    const tx3 = await nft.connect(owner).withdrawFundBalance(ethers.parseEther("0.1"));
    const receipt3 = await tx3.wait();
    individualGasUsed += receipt3.gasUsed;
    
    // Compare gas usage
    console.log(`Batch gas: ${batchGasUsed}`);
    console.log(`Individual gas: ${individualGasUsed}`);
    expect(batchGasUsed).to.be.lt(individualGasUsed);
  });
});