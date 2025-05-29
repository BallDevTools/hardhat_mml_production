// แก้ไขใน test/integration/PlanUpgradeChain.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Plan Upgrade Chain Tests", function () {
  async function deployFixture() {
    const [owner, ...users] = await ethers.getSigners();
    
    // Deploy FakeUSDT token
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    await usdt.waitForDeployment();

    // Deploy NFT contract
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(await usdt.getAddress(), owner.address);
    await nft.waitForDeployment();

    // *** วิธีที่ 1: ใช้ transfer แทน mint ***
    const usdtAmount = ethers.parseUnits("1000", 6); // 1000 USDT (6 decimals)
    for (const user of users) {
      // ใช้ transfer แทน mint
      await usdt.transfer(user.address, usdtAmount);
      await usdt.connect(user).approve(await nft.getAddress(), usdtAmount);
    }

    // *** วิธีที่ 2: ถ้าใช้ FakeUSDT ใหม่ที่มี mint function ***
    // const usdtAmount = ethers.parseUnits("1000", 6);
    // for (const user of users) {
    //   await usdt.mint(user.address, usdtAmount);
    //   await usdt.connect(user).approve(await nft.getAddress(), usdtAmount);
    // }

    return { nft, usdt, owner, users };
  }
  
  it("Should handle complex upgrade scenarios with multiple users", async function () {
    const { nft, usdt, owner, users } = await loadFixture(deployFixture);
    
    // สร้าง chain: User A (Plan 1) -> User B (Plan 1) -> User C (Plan 1)
    await nft.connect(users[0]).registerMember(1, owner.address); // User A
    
    await ethers.provider.send("evm_increaseTime", [70]);
    await ethers.provider.send("evm_mine");
    
    await nft.connect(users[1]).registerMember(1, users[0].address); // User B
    
    await ethers.provider.send("evm_increaseTime", [70]);
    await ethers.provider.send("evm_mine");
    
    await nft.connect(users[2]).registerMember(1, users[1].address); // User C
    
    // User C upgrades to Plan 2 -> should notify User B
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 60]); // 1 day + 1 minute
    await ethers.provider.send("evm_mine");
    
    const txC = await nft.connect(users[2]).upgradePlan(2);
    await expect(txC)
      .to.emit(nft, "UplineNotified")
      .withArgs(users[1].address, users[2].address, 1, 2);
    
    // User B upgrades to Plan 3 -> should notify User A
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 60]); // 1 day + 1 minute
    await ethers.provider.send("evm_mine");
    
    // เมื่อ User B อัพเกรดไปยัง Plan 3 จะต้องอัพเกรดผ่าน Plan 2 ก่อน
    const txB1 = await nft.connect(users[1]).upgradePlan(2);
    
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 60]); // 1 day + 1 minute
    await ethers.provider.send("evm_mine");
    
    const txB2 = await nft.connect(users[1]).upgradePlan(3);
    await expect(txB2)
      .to.emit(nft, "UplineNotified")
      .withArgs(users[0].address, users[1].address, 2, 3);
  });
});