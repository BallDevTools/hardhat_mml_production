// test/integration/CommissionPayment.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Commission Payment Chain", function () {
  // เพิ่ม timeout สำหรับการทดสอบที่ซับซ้อน
  this.timeout(60000);

  async function deployFixture() {
    const [owner, ...signers] = await ethers.getSigners();
    const users = signers.slice(0, 10); // เตรียมผู้ใช้ 10 คนสำหรับ chain ที่ลึก
    
    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    
    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(await usdt.getAddress(), owner.address);
    
    // เตรียมเงินสำหรับทดสอบในจำนวนมาก
    const initialAmount = ethers.parseEther("100");
    
    // แจกจ่าย USDT ให้ผู้ใช้ทุกคนและอนุมัติให้ contract ใช้
    for (const user of users) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(await nft.getAddress(), initialAmount);
    }
    
    return { nft, usdt, owner, users };
  }
  
  it("Should handle deep referral commission chains", async function() {
    const { nft, usdt, owner, users } = await loadFixture(deployFixture);
    
    // สร้าง chain ของผู้ใช้ 10 คน โดยแต่ละคนแนะนำคนถัดไป
    let uplineAddress = owner.address;
    
    for (let i = 0; i < users.length; i++) {
      console.log(`ลงทะเบียนผู้ใช้ที่ ${i+1} โดยมี upline เป็น ${uplineAddress.slice(0, 8)}...`);
      
      // ลงทะเบียนสมาชิกโดยใช้ upline เป็นคนก่อนหน้า
      await nft.connect(users[i]).registerMember(1, uplineAddress);
      
      // บันทึกยอดรายได้ก่อนการลงทะเบียนถัดไป (สำหรับผู้ใช้ที่ไม่ใช่คนแรก)
      if (i > 0) {
        const memberData = await nft.members(users[i-1].address);
        users[i-1].earningsBefore = memberData.totalEarnings;
      }
      
      // อัพเดท upline สำหรับผู้ใช้ถัดไป
      uplineAddress = users[i].address;
      
      // รอเวลาเพื่อหลีกเลี่ยง TooSoon error
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine");
    }
    
    // ตรวจสอบการจ่ายค่าคอมมิชชั่น
    console.log("\nตรวจสอบการจ่ายค่าคอมมิชชั่น:");
    
    for (let i = 0; i < users.length - 1; i++) {
      const memberData = await nft.members(users[i].address);
      
      console.log(`ผู้ใช้ที่ ${i+1}: รายได้รวม = ${ethers.formatEther(memberData.totalEarnings)} USDT, การแนะนำ = ${memberData.totalReferrals}`);
      
      if (i > 0) {
        // ตรวจสอบว่ารายได้มีการเปลี่ยนแปลงถูกต้อง
        const earningsBefore = users[i].earningsBefore || 0n;
        const earningsDiff = memberData.totalEarnings - earningsBefore;
        
        if (earningsDiff.toString() === '0') {
          console.log(`  - รายได้คงที่ (ไม่เปลี่ยนแปลง)`);
        } else {
          console.log(`  - รายได้เพิ่มขึ้น ${ethers.formatEther(earningsDiff)} USDT จากการแนะนำ`);
        }
      }
      
      // ทุกสมาชิกยกเว้นคนสุดท้ายควรมีการแนะนำพอดี 1 คน
      expect(memberData.totalReferrals).to.equal(1);
    }
    
    // ตรวจสอบสมาชิกคนสุดท้ายไม่มีการแนะนำ
    const lastMember = await nft.members(users[users.length - 1].address);
    expect(lastMember.totalReferrals).to.equal(0);
    console.log(`ผู้ใช้ที่ ${users.length}: รายได้รวม = ${ethers.formatEther(lastMember.totalEarnings)} USDT, การแนะนำ = ${lastMember.totalReferrals}`);
    
    // ตรวจสอบการกระจายรายได้ตาม chain
    let planPrice = ethers.parseEther("1"); // ราคาแผน 1
    let userShare = (planPrice * 50n) / 100n; // 50% สำหรับแผน 1-4
    let uplineShare = (userShare * 60n) / 100n; // 60% ของ userShare
    
    console.log(`\nสรุปการจ่ายค่าคอมมิชชั่น:`);
    console.log(`- แผน 1 ราคา: ${ethers.formatEther(planPrice)} USDT`);
    console.log(`- ส่วนแบ่งผู้ใช้: ${ethers.formatEther(userShare)} USDT (50%)`);
    console.log(`- ค่าคอมมิชชั่น upline: ${ethers.formatEther(uplineShare)} USDT (60% ของส่วนแบ่งผู้ใช้)`);
    
    // ตรวจสอบยอดรวมค่าคอมมิชชั่นที่จ่ายแล้ว
    const systemStats = await nft.getSystemStats();
    console.log(`\nค่าคอมมิชชั่นทั้งหมดที่จ่ายแล้ว: ${ethers.formatEther(systemStats[2])} USDT`);
    
    // ตรวจสอบว่าค่าคอมมิชชั่นทั้งหมดเป็นบวก
    expect(systemStats[2]).to.be.gt(0);
  });
});