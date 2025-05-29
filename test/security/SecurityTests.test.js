// Add to test/security/SecurityTests.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Security Tests", function () {
  async function deployFixture() {
    // Standard deployment code...
  }
  
  it("Should prevent front-running with different time intervals", async function() {
    const { nft, owner, user1 } = await loadFixture(deployFixture);
    
    // Register first to become a member
    await nft.connect(user1).registerMember(1, owner.address);
    
    // Attempt to call another protected function immediately (should fail)
    await expect(
      nft.connect(user1).upgradePlan(2)
    ).to.be.revertedWithCustomError(nft, "TooSoon");
    
    // Wait just under the MIN_ACTION_DELAY
    await ethers.provider.send("evm_increaseTime", [55]); // 55 seconds (less than 1 minute)
    await ethers.provider.send("evm_mine");
    
    // Should still fail
    await expect(
      nft.connect(user1).upgradePlan(2)
    ).to.be.revertedWithCustomError(nft, "TooSoon");
    
    // Wait just over the MIN_ACTION_DELAY
    await ethers.provider.send("evm_increaseTime", [10]); // Total 65 seconds (more than 1 minute)
    await ethers.provider.send("evm_mine");
    
    // Should now fail due to UPGRADE_COOLDOWN (1 day), not TooSoon
    await expect(
      nft.connect(user1).upgradePlan(2)
    ).to.be.revertedWithCustomError(nft, "CooldownActive");
  });
  // Add to test/security/SecurityTests.test.js
it("Should block all forms of NFT transfers", async function() {
  const { nft, owner, user1, user2 } = await loadFixture(deployFixture);
  
  // Register a member to get an NFT
  await nft.connect(user1).registerMember(1, owner.address);
  const tokenId = await nft.tokenOfOwnerByIndex(user1.address, 0);
  
  // Test transferFrom
  await expect(
    nft.connect(user1).transferFrom(user1.address, user2.address, tokenId)
  ).to.be.revertedWithCustomError(nft, "NonTransferable");
  
  // Test safeTransferFrom
  await expect(
    nft.connect(user1)["safeTransferFrom(address,address,uint256)"](user1.address, user2.address, tokenId)
  ).to.be.revertedWithCustomError(nft, "NonTransferable");
  
  // Test approve
  await expect(
    nft.connect(user1).approve(user2.address, tokenId)
  ).to.emit(nft, "TransferAttemptBlocked");
  
  // Test setApprovalForAll
  await expect(
    nft.connect(user1).setApprovalForAll(user2.address, true)
  ).to.emit(nft, "TransferAttemptBlocked");
});
});