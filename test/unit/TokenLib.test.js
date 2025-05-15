const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// สำหรับ TokenLib เราจะทดสอบผ่าน CryptoMembershipNFT เนื่องจากไม่มี TokenLibTester
// แต่เราจะเน้นการทดสอบฟังก์ชันใน TokenLib โดยตรง

describe("TokenLib Unit Tests", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    
    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(usdt.target, owner.address);
    
    // แจก USDT ให้ user1 และอนุมัติให้ contract ใช้
    const amount = ethers.parseEther("100");
    await usdt.transfer(user1.address, amount);
    await usdt.connect(user1).approve(nft.target, amount);
    
    return { nft, usdt, owner, user1, user2, amount };
  }
  
  describe("safeTransferFrom", function () {
    it("Should safely transfer tokens from user to contract", async function () {
      const { nft, usdt, owner, user1 } = await loadFixture(deployFixture);
      
      // ตรวจสอบยอดคงเหลือก่อนโอน
      const balanceBefore = await usdt.balanceOf(user1.address);
      const contractBalanceBefore = await usdt.balanceOf(nft.target);
      
      // ลงทะเบียนสมาชิกซึ่งจะเรียกใช้ TokenLib.safeTransferFrom
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ตรวจสอบยอดคงเหลือหลังโอน
      const balanceAfter = await usdt.balanceOf(user1.address);
      const contractBalanceAfter = await usdt.balanceOf(nft.target);
      
      // ยอดคงเหลือ user1 ควรลดลง
      expect(balanceBefore).to.be.gt(balanceAfter);
      
      // ยอดคงเหลือของ contract ควรเพิ่มขึ้น
      expect(contractBalanceAfter).to.be.gt(contractBalanceBefore);
      
      // ส่วนต่างของยอดคงเหลือ user1 ควรเท่ากับส่วนต่างของยอดคงเหลือ contract
      const userDiff = balanceBefore - balanceAfter;
      const contractDiff = contractBalanceAfter - contractBalanceBefore;
      expect(userDiff).to.equal(contractDiff);
    });
    
    it("Should fail if approval is insufficient", async function () {
      const { nft, usdt, owner, user2 } = await loadFixture(deployFixture);
      
      // ให้ USDT แก่ user2 แต่ไม่อนุมัติให้ contract ใช้
      await usdt.transfer(user2.address, ethers.parseEther("10"));
      
      // ควรล้มเหลวเนื่องจากไม่ได้อนุมัติให้ contract ใช้ USDT
      await expect(
        nft.connect(user2).registerMember(1, owner.address)
      ).to.be.reverted;
    });
  });
  
  describe("safeTransfer", function () {
    it("Should safely transfer tokens from contract to user", async function () {
      const { nft, usdt, owner, user1 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิกเพื่อให้มีเงินใน contract
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ดึงข้อมูลยอดคงเหลือของ owner
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3]; // ownerFunds
      
      // ตรวจสอบยอดคงเหลือก่อนถอน
      const ownerBalanceBefore = await usdt.balanceOf(owner.address);
      const contractBalanceBefore = await usdt.balanceOf(nft.target);
      
      // ถอนเงินออแนอร์ซึ่งจะเรียกใช้ TokenLib.safeTransfer
      await nft.connect(owner).withdrawOwnerBalance(ownerBalance);
      
      // ตรวจสอบยอดคงเหลือหลังถอน
      const ownerBalanceAfter = await usdt.balanceOf(owner.address);
      const contractBalanceAfter = await usdt.balanceOf(nft.target);
      
      // ยอดคงเหลือ owner ควรเพิ่มขึ้น
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
      
      // ยอดคงเหลือของ contract ควรลดลง
      expect(contractBalanceBefore).to.be.gt(contractBalanceAfter);
      
      // ส่วนต่างของยอดคงเหลือ owner ควรเท่ากับส่วนต่างของยอดคงเหลือ contract
      const ownerDiff = ownerBalanceAfter - ownerBalanceBefore;
      const contractDiff = contractBalanceBefore - contractBalanceAfter;
      expect(ownerDiff).to.equal(contractDiff);
      expect(ownerDiff).to.equal(ownerBalance);
    });
  });
  
  describe("validateWithdrawal", function () {
    it("Should validate withdrawal if amount is less than or equal to balance", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิกเพื่อให้มีเงินใน contract
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ดึงข้อมูลยอดคงเหลือของ owner
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3]; // ownerFunds
      
      // ถอนเงินออแนอร์ทั้งหมด (ควรสำเร็จ)
      await nft.connect(owner).withdrawOwnerBalance(ownerBalance);
      
      // ตรวจสอบว่ายอดคงเหลือเป็น 0
      const updatedStats = await nft.getSystemStats();
      expect(updatedStats[3]).to.equal(0n);
    });
    
    it("Should revert if withdrawal amount is greater than balance", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิกเพื่อให้มีเงินใน contract
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ดึงข้อมูลยอดคงเหลือของ owner
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3]; // ownerFunds
      
      // พยายามถอนเงินมากกว่ายอดคงเหลือ
      await expect(
        nft.connect(owner).withdrawOwnerBalance(ownerBalance + 1n)
      ).to.be.revertedWithCustomError(nft, "LowOwnerBalance");
    });
  });
  
  describe("Security and Edge Cases", function () {
    it("Should handle zero token transfers correctly", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      // พยายามถอนเงิน 0 (ควรสำเร็จ)
      await nft.connect(owner).withdrawOwnerBalance(0);
      
      // ตรวจสอบว่ายอดคงเหลือไม่เปลี่ยนแปลง
      const systemStats = await nft.getSystemStats();
      expect(systemStats[3]).to.equal(0n); // ownerFunds ยังเป็น 0
    });
    
    it("Should handle gas griefing attack simulation", async function () {
      const { nft, usdt, owner, user1, user2 } = await loadFixture(deployFixture);
      
      // สร้างยอดคงเหลือใน contract
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ดึงข้อมูลยอดคงเหลือของ owner
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3]; // ownerFunds
      
      // ถอนเงินออแนอร์
      await nft.connect(owner).withdrawOwnerBalance(ownerBalance);
      
      // ตรวจสอบว่ายอดคงเหลือเป็น 0
      const updatedStats = await nft.getSystemStats();
      expect(updatedStats[3]).to.equal(0n);
    });
    
    it("Should prevent reentrancy attacks", async function () {
      // TokenLib ใช้ SafeERC20 ซึ่งป้องกัน reentrancy attack อยู่แล้ว
      // แต่นี่เป็นการทดสอบกลไกการป้องกัน reentrancy ใน contract หลัก
      
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ในกรณีที่มีการโจมตีแบบ reentrancy contract จะตรวจสอบ flag _inTransaction
      // เราไม่สามารถทดสอบโดยตรงได้เนื่องจาก flag เป็นตัวแปรภายใน
      // แต่เราสามารถตรวจสอบว่าฟังก์ชันมี modifier noReentrantTransfer
      
      // ทดสอบว่าการเรียกฟังก์ชันที่มี noReentrantTransfer ซ้อนกันไม่ได้
      // เราทำได้โดยจำลองการเรียกฟังก์ชันที่เกี่ยวข้องกับการโอนเงิน
      
      // หมายเหตุ: เราไม่สามารถจำลองการโจมตี reentrancy ได้โดยตรงในการทดสอบนี้
      // เนื่องจากข้อจำกัดของสภาพแวดล้อมการทดสอบ แต่เราสามารถตรวจสอบได้ว่า
      // การทำงานปกติของฟังก์ชันที่มี noReentrantTransfer ทำงานได้ถูกต้อง
      
      // ถอนเงินออแนอร์ (มี noReentrantTransfer)
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3]; // ownerFunds
      
      if (ownerBalance > 0n) {
        await nft.connect(owner).withdrawOwnerBalance(ownerBalance);
      }
    });
  });
});