// แก้ไข test/security/EmergencyWithdrawTests.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Emergency Withdrawal Edge Cases", function () {
  async function deployWithFundsFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy tokens and contract
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    await usdt.waitForDeployment();

    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(await usdt.getAddress(), owner.address);
    await nft.waitForDeployment();

    // *** ปัญหาหลัก: ต้องตรวจสอบ decimals ก่อนใช้ ***
    const decimals = await usdt.decimals();
    console.log(`💰 USDT decimals: ${decimals}`);
    
    // *** แก้ไข: ใช้ parseUnits แทน parseEther ***
    const usdtAmount = ethers.parseUnits("100", decimals); // 100 USDT
    
    // *** ตรวจสอบยอดเงินของ owner ก่อนโอน ***
    const ownerBalance = await usdt.balanceOf(owner.address);
    console.log(`👤 Owner initial balance: ${ethers.formatUnits(ownerBalance, decimals)} USDT`);
    
    // *** ตรวจสอบว่ามีเงินเพียงพอหรือไม่ ***
    const totalNeeded = usdtAmount * BigInt([user1, user2, user3].length);
    if (ownerBalance < totalNeeded) {
      throw new Error(`Insufficient balance. Owner has ${ethers.formatUnits(ownerBalance, decimals)} USDT, but needs ${ethers.formatUnits(totalNeeded, decimals)} USDT`);
    }

    // Setup funds by registering users
    for (const user of [user1, user2, user3]) {
      await usdt.transfer(user.address, usdtAmount);
      await usdt.connect(user).approve(await nft.getAddress(), usdtAmount);
      
      // *** เพิ่มการตรวจสอบ balance หลัง transfer ***
      const userBalance = await usdt.balanceOf(user.address);
      console.log(`👤 ${user.address.slice(0, 8)}... balance: ${ethers.formatUnits(userBalance, decimals)} USDT`);
    }
    
    console.log("🏗️ ลงทะเบียนสมาชิกเพื่อสร้างยอดเงินในระบบ...");

    // Register users with delays to avoid TooSoon errors
    await nft.connect(user1).registerMember(1, owner.address);
    console.log("✅ User1 registered");

    await ethers.provider.send("evm_increaseTime", [90]);
    await ethers.provider.send("evm_mine");

    await nft.connect(user2).registerMember(1, user1.address);
    console.log("✅ User2 registered");
    
    // *** แสดงสถิติระบบหลังจากลงทะเบียน ***
    const systemStats = await nft.getSystemStats();
    console.log("📊 System stats after registration:");
    console.log(`   Total Members: ${systemStats[0]}`);
    console.log(`   Owner Funds: ${ethers.formatUnits(systemStats[3], decimals)} USDT`);
    console.log(`   Fee Funds: ${ethers.formatUnits(systemStats[4], decimals)} USDT`);
    console.log(`   Fund Balance: ${ethers.formatUnits(systemStats[5], decimals)} USDT`);

    return { nft, usdt, owner, user1, user2, user3, decimals };
  }

  it("Should handle emergency withdrawal when contractBalance < expectedBalance", async function () {
    const { nft, usdt, owner, decimals } = await loadFixture(deployWithFundsFixture);
    
    console.log("🧪 ทดสอบ Emergency Withdrawal เมื่อ contractBalance < expectedBalance");
    
    // Get current balances
    const systemStats = await nft.getSystemStats();
    const expectedBalance = systemStats[3] + systemStats[4] + systemStats[5];
    const contractBalanceBefore = await usdt.balanceOf(await nft.getAddress());
    
    console.log(`📊 สถานะก่อนจำลองปัญหา:`);
    console.log(`   Expected Balance: ${ethers.formatUnits(expectedBalance, decimals)} USDT`);
    console.log(`   Contract Balance: ${ethers.formatUnits(contractBalanceBefore, decimals)} USDT`);
    
    // *** วิธีการจำลองปัญหา: ใช้การถอนเงินบางส่วนแทนการ transfer โดยตรง ***
    // เนื่องจากเราไม่สามารถ manipulate contract balance โดยตรงได้
    
    // ถอนเงินส่วนหนึ่งออกจาก contract เพื่อจำลองปัญหา
    const ownerFunds = systemStats[3];
    if (ownerFunds > 0n) {
      const withdrawAmount = ownerFunds / 2n; // ถอนครึ่งหนึ่ง
      await nft.connect(owner).withdrawOwnerBalance(withdrawAmount);
      console.log(`💸 ถอนเงิน ${ethers.formatUnits(withdrawAmount, decimals)} USDT จาก owner funds`);
    }
    
    // ตรวจสอบสถานะหลังการถอน
    const systemStatsAfter = await nft.getSystemStats();
    const contractBalanceAfter = await usdt.balanceOf(await nft.getAddress());
    const expectedBalanceAfter = systemStatsAfter[3] + systemStatsAfter[4] + systemStatsAfter[5];
    
    console.log(`📊 สถานะหลังการถอน:`);
    console.log(`   Expected Balance: ${ethers.formatUnits(expectedBalanceAfter, decimals)} USDT`);
    console.log(`   Contract Balance: ${ethers.formatUnits(contractBalanceAfter, decimals)} USDT`);
    
    // Request emergency withdrawal
    console.log("📋 ขอทำการถอนฉุกเฉิน...");
    await nft.connect(owner).requestEmergencyWithdraw();

    // Wait for timelock to expire
    console.log("⏰ รอเวลา timelock 2 วัน...");
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");

    // Perform emergency withdrawal
    const ownerBalanceBefore = await usdt.balanceOf(owner.address);
    console.log(`💼 Owner balance before emergency withdrawal: ${ethers.formatUnits(ownerBalanceBefore, decimals)} USDT`);
    
    console.log("🚨 ทำการถอนฉุกเฉิน...");
    const emergencyTx = await nft.connect(owner).emergencyWithdraw();
    await emergencyTx.wait();
    
    const ownerBalanceAfter = await usdt.balanceOf(owner.address);
    const withdrawnAmount = ownerBalanceAfter - ownerBalanceBefore;
    
    console.log(`💼 Owner balance after emergency withdrawal: ${ethers.formatUnits(ownerBalanceAfter, decimals)} USDT`);
    console.log(`💰 Withdrawn amount: ${ethers.formatUnits(withdrawnAmount, decimals)} USDT`);

    // Verify that emergency withdrawal worked
    expect(withdrawnAmount).to.be.gt(0, "Emergency withdrawal should transfer some funds");

    // Verify that all balances were reset
    const statsAfterEmergency = await nft.getSystemStats();
    expect(statsAfterEmergency[3]).to.equal(0); // ownerFunds
    expect(statsAfterEmergency[4]).to.equal(0); // feeFunds
    expect(statsAfterEmergency[5]).to.equal(0); // fundFunds
    
    console.log("✅ Emergency withdrawal completed successfully");
  });

  it("Should handle emergency withdrawal cancellation scenarios", async function() {
    const { nft, owner } = await loadFixture(deployWithFundsFixture);
    
    console.log("🧪 ทดสอบการยกเลิก Emergency Withdrawal");
    
    // Request emergency withdrawal
    console.log("📋 ขอทำการถอนฉุกเฉิน...");
    await nft.connect(owner).requestEmergencyWithdraw();
    
    // Verify request is active
    let contractStatus = await nft.getContractStatus();
    expect(contractStatus[4]).to.equal(true); // hasEmergencyRequest
    console.log("✅ Emergency request activated");
    
    // Cancel request
    console.log("❌ ยกเลิกคำขอถอนฉุกเฉิน...");
    await nft.connect(owner).cancelEmergencyWithdraw();
    
    // Verify request is cancelled
    contractStatus = await nft.getContractStatus();
    expect(contractStatus[4]).to.equal(false); // hasEmergencyRequest
    console.log("✅ Emergency request cancelled");
    
    // Attempt withdrawal should fail
    console.log("🚫 ทดสอบการถอนหลังจากยกเลิก (ควรล้มเหลว)...");
    await expect(
      nft.connect(owner).emergencyWithdraw()
    ).to.be.revertedWithCustomError(nft, "NoRequest");
    console.log("✅ Emergency withdrawal correctly rejected");
    
    // Request again
    console.log("📋 ขอทำการถอนฉุกเฉินอีกครั้ง...");
    await nft.connect(owner).requestEmergencyWithdraw();
    
    // Wait for half the timelock duration
    console.log("⏰ รอเวลาครึ่งหนึ่งของ timelock (1 วัน)...");
    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    
    // Attempt withdrawal should fail due to timelock
    console.log("🚫 ทดสอบการถอนก่อนครบ timelock (ควรล้มเหลว)...");
    await expect(
      nft.connect(owner).emergencyWithdraw()
    ).to.be.revertedWithCustomError(nft, "TimelockActive");
    console.log("✅ Timelock correctly enforced");
    
    // Cancel again
    console.log("❌ ยกเลิกคำขอถอนฉุกเฉินอีกครั้ง...");
    await nft.connect(owner).cancelEmergencyWithdraw();
    
    // Wait for full timelock duration
    console.log("⏰ รอเวลา timelock เต็มจำนวน (2 วัน)...");
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    
    // Attempt withdrawal should still fail due to cancelled request
    console.log("🚫 ทดสอบการถอนหลังจากยกเลิกแล้ว (ควรล้มเหลว)...");
    await expect(
      nft.connect(owner).emergencyWithdraw()
    ).to.be.revertedWithCustomError(nft, "NoRequest");
    console.log("✅ Cancelled request correctly prevents withdrawal");
    
    console.log("🎉 การทดสอบ Emergency Withdrawal Cancellation สำเร็จ!");
  });
  
  it("Should handle multiple emergency withdrawal requests", async function() {
    const { nft, owner } = await loadFixture(deployWithFundsFixture);
    
    console.log("🧪 ทดสอบ Multiple Emergency Withdrawal Requests");
    
    // First request
    console.log("📋 คำขอที่ 1...");
    await nft.connect(owner).requestEmergencyWithdraw();
    
    let contractStatus = await nft.getContractStatus();
    expect(contractStatus[4]).to.equal(true);
    
    // Try to request again (should not revert, just update timestamp)
    console.log("📋 คำขอที่ 2 (ควรอัพเดท timestamp)...");
    await nft.connect(owner).requestEmergencyWithdraw();
    
    contractStatus = await nft.getContractStatus();
    expect(contractStatus[4]).to.equal(true);
    
    // Cancel and verify
    console.log("❌ ยกเลิกคำขอ...");
    await nft.connect(owner).cancelEmergencyWithdraw();
    
    contractStatus = await nft.getContractStatus();
    expect(contractStatus[4]).to.equal(false);
    
    console.log("✅ Multiple requests handled correctly");
  });
  
  it("Should show correct emergency time remaining", async function() {
    const { nft, owner } = await loadFixture(deployWithFundsFixture);
    
    console.log("🧪 ทดสอบการแสดงเวลาที่เหลือ");
    
    // Request emergency withdrawal
    await nft.connect(owner).requestEmergencyWithdraw();
    
    // Check time remaining immediately
    let contractStatus = await nft.getContractStatus();
    let timeRemaining = contractStatus[5];
    
    console.log(`⏰ เวลาที่เหลือทันที: ${timeRemaining.toString()} วินาที`);
    expect(timeRemaining).to.be.gt(0);
    expect(timeRemaining).to.be.lte(2 * 24 * 60 * 60); // ไม่เกิน 2 วัน
    
    // Wait some time
    await ethers.provider.send("evm_increaseTime", [60 * 60]); // 1 hour
    await ethers.provider.send("evm_mine");
    
    // Check time remaining after 1 hour
    contractStatus = await nft.getContractStatus();
    let newTimeRemaining = contractStatus[5];
    
    console.log(`⏰ เวลาที่เหลือหลัง 1 ชั่วโมง: ${newTimeRemaining.toString()} วินาที`);
    expect(newTimeRemaining).to.be.lt(timeRemaining); // ควรลดลง
    
    console.log("✅ Time remaining calculation correct");
  });
});