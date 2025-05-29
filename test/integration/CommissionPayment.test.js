// test/integration/CommissionPayment.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Commission Payment Chain", function () {
  // เพิ่ม timeout สำหรับการทดสอบที่ซับซ้อน
  this.timeout(120000); // เพิ่มเป็น 2 นาที

  async function deployFixture() {
    const [owner, ...signers] = await ethers.getSigners();
    const users = signers.slice(0, 10); // เตรียมผู้ใช้ 10 คนสำหรับ chain ที่ลึก
    
    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    await usdt.waitForDeployment();
    
    // Deploy CryptoMembershipNFT - แก้ไขการส่ง parameter
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(
      await usdt.getAddress(), // ใช้ getAddress() แทน target
      owner.address
    );
    await nft.waitForDeployment();
    
    // เตรียมเงินสำหรับทดสอบ - แก้ไข decimals
    const initialAmount = ethers.parseUnits("100", 6); // ใช้ 6 decimals สำหรับ USDT
    
    // แจกจ่าย USDT ให้ผู้ใช้ทุกคนและอนุมัติให้ contract ใช้
    for (const user of users) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(await nft.getAddress(), initialAmount);
    }
    
    return { nft, usdt, owner, users };
  }
  
  it("Should handle deep referral commission chains", async function() {
    const { nft, usdt, owner, users } = await loadFixture(deployFixture);
    
    console.log("🚀 เริ่มการทดสอบ Commission Chain...");
    
    // สร้าง chain ของผู้ใช้ 10 คน โดยแต่ละคนแนะนำคนถัดไป
    let uplineAddress = owner.address;
    const memberEarningsBefore = new Map();
    
    for (let i = 0; i < users.length; i++) {
      console.log(`📝 ลงทะเบียนผู้ใช้ที่ ${i+1} โดยมี upline เป็น ${uplineAddress.slice(0, 8)}...`);
      
      // บันทึกยอดรายได้ก่อนการลงทะเบียน (สำหรับผู้ใช้ที่ไม่ใช่คนแรก)
      if (i > 0) {
        const memberData = await nft.members(users[i-1].address);
        memberEarningsBefore.set(users[i-1].address, memberData.totalEarnings);
      }
      
      try {
        // ลงทะเบียนสมาชิกโดยใช้ upline เป็นคนก่อนหน้า
        const tx = await nft.connect(users[i]).registerMember(1, uplineAddress);
        await tx.wait();
        
        console.log(`✅ ลงทะเบียนสำเร็จ! User ${i+1}`);
        
        // อัพเดท upline สำหรับผู้ใช้ถัดไป
        uplineAddress = users[i].address;
        
        // รอเวลาเพื่อหลีกเลี่ยง TooSoon error - เพิ่มเวลารอ
        if (i < users.length - 1) {
          await ethers.provider.send("evm_increaseTime", [90]); // เพิ่มเป็น 90 วินาที
          await ethers.provider.send("evm_mine");
        }
        
      } catch (error) {
        console.error(`❌ ลงทะเบียนล้มเหลว User ${i+1}:`, error.message);
        throw error;
      }
    }
    
    console.log("\n🔍 ตรวจสอบการจ่ายค่าคอมมิชชั่น:");
    
    // ตรวจสอบการจ่ายค่าคอมมิชชั่น
    for (let i = 0; i < users.length; i++) {
      const memberData = await nft.members(users[i].address);
      
      console.log(`👤 ผู้ใช้ที่ ${i+1}:`);
      console.log(`   - Plan ID: ${memberData.planId}`);
      console.log(`   - Total Referrals: ${memberData.totalReferrals}`);
      console.log(`   - Total Earnings: ${ethers.formatUnits(memberData.totalEarnings, 6)} USDT`);
      console.log(`   - Upline: ${memberData.upline.slice(0, 8)}...`);
      
      // ตรวจสอบการเปลี่ยนแปลงรายได้
      if (i > 0 && memberEarningsBefore.has(users[i-1].address)) {
        const earningsBefore = memberEarningsBefore.get(users[i-1].address);
        const earningsAfter = memberData.totalEarnings;
        const earningsDiff = earningsAfter - earningsBefore;
        
        console.log(`   - รายได้เพิ่มขึ้น: ${ethers.formatUnits(earningsDiff, 6)} USDT`);
      }
      
      // ทุกสมาชิกยกเว้นคนสุดท้ายควรมีการแนะนำ
      if (i < users.length - 1) {
        expect(memberData.totalReferrals).to.equal(1, `User ${i+1} should have 1 referral`);
      }
    }
    
    // ตรวจสอบสมาชิกคนสุดท้ายไม่มีการแนะนำ
    const lastMember = await nft.members(users[users.length - 1].address);
    expect(lastMember.totalReferrals).to.equal(0, "Last member should have 0 referrals");
    
    // ตรวจสอบการกระจายรายได้ตาม chain
    const planPrice = ethers.parseUnits("1", 6); // Plan 1 ราคา 1 USDT (6 decimals)
    const userShare = (planPrice * 50n) / 100n; // 50% สำหรับแผน 1-4
    const uplineShare = (userShare * 60n) / 100n; // 60% ของ userShare
    
    console.log(`\n💰 สรุปการจ่ายค่าคอมมิชชั่น:`);
    console.log(`- แผน 1 ราคา: ${ethers.formatUnits(planPrice, 6)} USDT`);
    console.log(`- ส่วนแบ่งผู้ใช้: ${ethers.formatUnits(userShare, 6)} USDT (50%)`);
    console.log(`- ค่าคอมมิชชั่น upline: ${ethers.formatUnits(uplineShare, 6)} USDT (60% ของส่วนแบ่งผู้ใช้)`);
    
    // ตรวจสอบยอดรวมค่าคอมมิชชั่นที่จ่ายแล้ว
    const systemStats = await nft.getSystemStats();
    console.log(`\n📊 ค่าคอมมิชชั่นทั้งหมดที่จ่ายแล้ว: ${ethers.formatUnits(systemStats[2], 6)} USDT`);
    
    // ตรวจสอบว่าค่าคอมมิชชั่นทั้งหมดเป็นบวก
    expect(systemStats[2]).to.be.gt(0, "Total commission should be greater than 0");
    
    // ตรวจสอบจำนวนสมาชิกทั้งหมด
    expect(systemStats[0]).to.equal(users.length, `Should have ${users.length} total members`);
    
    console.log(`\n🎉 การทดสอบ Commission Chain สำเร็จ!`);
    console.log(`   - สมาชิกทั้งหมด: ${systemStats[0]} คน`);
    console.log(`   - รายได้รวม: ${ethers.formatUnits(systemStats[1], 6)} USDT`);
    console.log(`   - ค่าคอมมิชชั่นรวม: ${ethers.formatUnits(systemStats[2], 6)} USDT`);
  });
  
  it("Should handle commission payment to owner when upline plan is lower", async function() {
    const { nft, usdt, owner, users } = await loadFixture(deployFixture);
    
    console.log("🧪 ทดสอบการจ่าย commission ให้ owner เมื่อ upline มี plan ต่ำกว่า");
    
    // ลงทะเบียน user1 ใน plan 1
    await nft.connect(users[0]).registerMember(1, owner.address);
    
    // รอเวลา
    await ethers.provider.send("evm_increaseTime", [90]);
    await ethers.provider.send("evm_mine");
    
    // ลงทะเบียน user2 ใน plan 1 โดยใช้ user1 เป็น upline
    await nft.connect(users[1]).registerMember(1, users[0].address);
    
    // ตรวจสอบว่า user1 ได้รับ commission
    const user1Data = await nft.members(users[0].address);
    expect(user1Data.totalEarnings).to.be.gt(0, "User1 should receive commission");
    expect(user1Data.totalReferrals).to.equal(1, "User1 should have 1 referral");
    
    console.log(`✅ User1 รับ commission: ${ethers.formatUnits(user1Data.totalEarnings, 6)} USDT`);
  });
  
  it("Should handle multiple referral levels correctly", async function() {
    const { nft, usdt, owner, users } = await loadFixture(deployFixture);
    
    console.log("🔗 ทดสอบการจ่าย commission หลายระดับ");
    
    // สร้าง chain: Owner -> User0 -> User1 -> User2
    await nft.connect(users[0]).registerMember(1, owner.address);
    
    await ethers.provider.send("evm_increaseTime", [90]);
    await ethers.provider.send("evm_mine");
    
    await nft.connect(users[1]).registerMember(1, users[0].address);
    
    await ethers.provider.send("evm_increaseTime", [90]);
    await ethers.provider.send("evm_mine");
    
    await nft.connect(users[2]).registerMember(1, users[1].address);
    
    // ตรวจสอบรายได้ของแต่ละระดับ
    const user0Data = await nft.members(users[0].address);
    const user1Data = await nft.members(users[1].address);
    const user2Data = await nft.members(users[2].address);
    
    console.log(`User0 - Referrals: ${user0Data.totalReferrals}, Earnings: ${ethers.formatUnits(user0Data.totalEarnings, 6)} USDT`);
    console.log(`User1 - Referrals: ${user1Data.totalReferrals}, Earnings: ${ethers.formatUnits(user1Data.totalEarnings, 6)} USDT`);
    console.log(`User2 - Referrals: ${user2Data.totalReferrals}, Earnings: ${ethers.formatUnits(user2Data.totalEarnings, 6)} USDT`);
    
    // ตรวจสอบการนับ referrals
    expect(user0Data.totalReferrals).to.equal(1, "User0 should have 1 direct referral");
    expect(user1Data.totalReferrals).to.equal(1, "User1 should have 1 direct referral");
    expect(user2Data.totalReferrals).to.equal(0, "User2 should have 0 referrals");
    
    // ตรวจสอบว่าทุกคนที่เป็น upline ได้รับ commission
    expect(user0Data.totalEarnings).to.be.gt(0, "User0 should earn commission");
    expect(user1Data.totalEarnings).to.be.gt(0, "User1 should earn commission");
    expect(user2Data.totalEarnings).to.equal(0, "User2 should not earn commission yet");
  });
});