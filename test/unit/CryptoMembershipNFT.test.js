const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT Unit Tests", function () {
  // *** แก้ไข deployFixture ให้ใช้ decimals ที่ถูกต้อง ***
  async function deployFixture() {
    const [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();

    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    await usdt.waitForDeployment();

    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(await usdt.getAddress(), owner.address);
    await nft.waitForDeployment();

    // *** สำคัญ: ตรวจสอบ decimals ก่อนใช้ ***
    const decimals = await usdt.decimals();
    console.log(`💰 USDT decimals: ${decimals}`);

    // *** แก้ไข: ใช้ parseUnits แทน parseEther ***
    const initialAmount = ethers.parseUnits("100", decimals); // 100 USDT

    // *** ตรวจสอบยอดเงิน owner ก่อนโอน ***
    const ownerBalance = await usdt.balanceOf(owner.address);
    console.log(`👤 Owner balance: ${ethers.formatUnits(ownerBalance, decimals)} USDT`);

    // *** คำนวณจำนวนเงินที่ต้องการ ***
    const totalNeeded = initialAmount * BigInt([user1, user2, user3, user4, user5].length);
    console.log(`💵 Total needed: ${ethers.formatUnits(totalNeeded, decimals)} USDT`);

    if (ownerBalance < totalNeeded) {
      throw new Error(`Insufficient balance. Owner has ${ethers.formatUnits(ownerBalance, decimals)} USDT, but needs ${ethers.formatUnits(totalNeeded, decimals)} USDT`);
    }

    // แจก USDT ให้ผู้ใช้เพื่อทดสอบ
    for (const user of [user1, user2, user3, user4, user5]) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(await nft.getAddress(), initialAmount);
    }

    // ดึงราคาของ plan แต่ละระดับ - *** แก้ไขให้ใช้ decimals ที่ถูกต้อง ***
    const planPrices = [];
    for (let i = 1; i <= 16; i++) {
      const plan = await nft.plans(i);
      planPrices.push(plan.price);
    }

    return { nft, usdt, owner, user1, user2, user3, user4, user5, planPrices, decimals };
  }

  describe("Deployment", function () {
    it("Should deploy correctly with default plans", async function () {
      const { nft, usdt, owner, decimals } = await loadFixture(deployFixture);

      // ตรวจสอบว่า contract ถูก deploy และตั้งค่าถูกต้อง
      expect(await nft.usdtToken()).to.equal(await usdt.getAddress());
      expect(await nft.owner()).to.equal(owner.address);

      // ตรวจสอบราคาของแผนแรก (แผน 1)
      const plan1 = await nft.plans(1);
      expect(plan1.price).to.equal(ethers.parseUnits("1", decimals)); // *** แก้ไข ***
      expect(plan1.isActive).to.equal(true);
    });

    it("Should set default images for all plans", async function () {
      const { nft } = await loadFixture(deployFixture);

      // ตรวจสอบว่ามีการตั้งค่ารูปภาพตั้งต้นสำหรับแผนทั้งหมด
      for (let i = 1; i <= 16; i++) {
        const image = await nft.planDefaultImages(i);
        expect(image).to.not.equal(""); // มีการตั้งค่ารูปภาพ
      }
    });
  });

  describe("Plan Management", function () {
    it("Should create a new plan", async function () {
      const { nft, owner, decimals } = await loadFixture(deployFixture);

      const planPrice = ethers.parseUnits("20", decimals); // *** แก้ไข ***
      const planName = "Premium Plan";
      const membersPerCycle = 4;

      // สร้างแผนใหม่
      await nft.connect(owner).createPlan(planPrice, planName, membersPerCycle);

      // ตรวจสอบว่าแผนถูกสร้างอย่างถูกต้อง
      const newPlan = await nft.plans(17);
      expect(newPlan.price).to.equal(planPrice);
      expect(newPlan.name).to.equal(planName);
      expect(newPlan.membersPerCycle).to.equal(membersPerCycle);
      expect(newPlan.isActive).to.equal(true);
    });

    it("Should fail if plan price is lower than previous plan", async function () {
      const { nft, owner, decimals } = await loadFixture(deployFixture);

      const lowPrice = ethers.parseUnits("0.5", decimals); // *** แก้ไข ***
      const planName = "Low Price Plan";
      const membersPerCycle = 4;

      // ควรไม่สามารถสร้างแผนที่มีราคาต่ำกว่าแผนก่อนหน้าได้
      await expect(
        nft.connect(owner).createPlan(lowPrice, planName, membersPerCycle)
      ).to.be.revertedWithCustomError(nft, "PriceTooLow");
    });

    it("Should fail if membersPerCycle is not 4", async function () {
      const { nft, owner, decimals } = await loadFixture(deployFixture);

      const planPrice = ethers.parseUnits("20", decimals); // *** แก้ไข ***
      const planName = "Invalid Cycle";
      const invalidCycleMembers = 5;

      // ควรไม่สามารถสร้างแผนที่มี membersPerCycle ไม่เท่ากับ 4 ได้
      await expect(
        nft.connect(owner).createPlan(planPrice, planName, invalidCycleMembers)
      ).to.be.revertedWithCustomError(nft, "InvalidCycleMembers");
    });

    it("Should set plan default image", async function () {
      const { nft, owner } = await loadFixture(deployFixture);

      const planId = 1;
      const newImageURI = "ipfs://new-image-hash";

      // ตั้งค่ารูปภาพตั้งต้นใหม่
      await nft.connect(owner).setPlanDefaultImage(planId, newImageURI);

      // ตรวจสอบว่ารูปภาพถูกเปลี่ยนอย่างถูกต้อง
      const image = await nft.planDefaultImages(planId);
      expect(image).to.equal(newImageURI);
    });

    it("Should set plan status", async function () {
      const { nft, owner } = await loadFixture(deployFixture);

      const planId = 1;

      // เปลี่ยนสถานะแผนเป็นไม่ทำงาน
      await nft.connect(owner).setPlanStatus(planId, false);
      const plan = await nft.plans(planId);
      expect(plan.isActive).to.equal(false);

      // เปลี่ยนสถานะแผนกลับมาทำงาน
      await nft.connect(owner).setPlanStatus(planId, true);
      const updatedPlan = await nft.plans(planId);
      expect(updatedPlan.isActive).to.equal(true);
    });

    it("Should update members per cycle", async function () {
      const { nft, owner } = await loadFixture(deployFixture);

      const planId = 1;
      const membersPerCycle = 4;

      // อัพเดทจำนวนสมาชิกต่อรอบ
      await nft.connect(owner).updateMembersPerCycle(planId, membersPerCycle);

      // ตรวจสอบว่าจำนวนสมาชิกต่อรอบถูกอัพเดทอย่างถูกต้อง
      const plan = await nft.plans(planId);
      expect(plan.membersPerCycle).to.equal(membersPerCycle);
    });
  });

  describe("Member Registration", function () {
    it("Should register a new member with plan 1", async function () {
      const { nft, usdt, owner, user1, planPrices, decimals } = await loadFixture(deployFixture);

      // บันทึกยอดคงเหลือก่อนลงทะเบียน
      const balanceBefore = await usdt.balanceOf(user1.address);

      // ลงทะเบียนสมาชิกใหม่ด้วยแผน 1
      await nft.connect(user1).registerMember(1, owner.address);

      // ตรวจสอบว่าสมาชิกได้รับ NFT
      expect(await nft.balanceOf(user1.address)).to.equal(1);

      // ตรวจสอบว่า USDT ถูกหักอย่างถูกต้อง
      const balanceAfter = await usdt.balanceOf(user1.address);
      expect(balanceBefore - balanceAfter).to.equal(planPrices[0]);

      // ตรวจสอบข้อมูลสมาชิก
      const member = await nft.members(user1.address);
      expect(member.planId).to.equal(1);
      expect(member.upline).to.equal(owner.address);
    });

    it("Should register a member with upline", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);

      // ลงทะเบียนผู้ใช้แรก
      await nft.connect(user1).registerMember(1, owner.address);

      // รอ 90 วินาทีเพื่อป้องกัน TooSoon error
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      // ลงทะเบียนผู้ใช้ที่สองโดยมี upline เป็นผู้ใช้แรก
      await nft.connect(user2).registerMember(1, user1.address);

      // ตรวจสอบว่า upline ถูกตั้งค่าอย่างถูกต้อง
      const member = await nft.members(user2.address);
      expect(member.upline).to.equal(user1.address);

      // ตรวจสอบว่า upline ได้รับการบันทึกจำนวนการแนะนำ
      const uplineMember = await nft.members(user1.address);
      expect(uplineMember.totalReferrals).to.equal(1);
    });

    it("Should fail if plan is not active", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ปิดการใช้งานแผน 1
      await nft.connect(owner).setPlanStatus(1, false);

      // ไม่สามารถลงทะเบียนด้วยแผนที่ไม่ทำงาน
      await expect(
        nft.connect(user1).registerMember(1, owner.address)
      ).to.be.revertedWithCustomError(nft, "InactivePlan");
    });

    it("Should fail if already a member", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนผู้ใช้
      await nft.connect(user1).registerMember(1, owner.address);

      // เพิ่มการรอเพื่อป้องกัน TooSoon error
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      // ไม่สามารถลงทะเบียนซ้ำได้
      await expect(
        nft.connect(user1).registerMember(1, owner.address)
      ).to.be.revertedWithCustomError(nft, "AlreadyMember");
    });

    it("Should start a new cycle when current cycle is full", async function () {
      const { nft, owner, user1, user2, user3, user4, user5 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก 4 คนแรกเพื่อให้รอบแรกเต็ม และรอระหว่างการลงทะเบียนแต่ละครั้ง
      await nft.connect(user1).registerMember(1, owner.address);

      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      await nft.connect(user2).registerMember(1, user1.address);

      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      await nft.connect(user3).registerMember(1, user2.address);

      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      await nft.connect(user4).registerMember(1, user3.address);

      // ตรวจสอบว่ารอบของแผน 1 เพิ่มขึ้น
      const cycleInfo = await nft.getPlanCycleInfo(1);
      expect(cycleInfo[0]).to.equal(2n); // currentCycle
      expect(cycleInfo[1]).to.equal(0n); // membersInCurrentCycle

      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      // ลงทะเบียนสมาชิกที่ 5
      await nft.connect(user5).registerMember(1, user4.address);

      // ตรวจสอบว่าสมาชิกที่ 5 อยู่ในรอบที่ 2
      const member = await nft.members(user5.address);
      expect(member.cycleNumber).to.equal(2);
    });

    it("Should only allow registration in plan 1", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ไม่สามารถลงทะเบียนด้วยแผนที่ไม่ใช่แผน 1 ได้
      await expect(
        nft.connect(user1).registerMember(2, owner.address)
      ).to.be.revertedWithCustomError(nft, "Plan1Only");
    });
  });

  describe("Plan Upgrade - Basic Tests", function () {
    it("Should fail if trying to upgrade to invalid plan", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // รอเพื่อป้องกัน TooSoon error
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      // ไม่สามารถอัพเกรดไปแผนที่ไม่มีอยู่ได้ (แผน 0 หรือแผนที่เกินกว่า 16)
      await expect(
        nft.connect(user1).upgradePlan(0)
      ).to.be.revertedWithCustomError(nft, "InvalidPlanID");

      await expect(
        nft.connect(user1).upgradePlan(20)
      ).to.be.revertedWithCustomError(nft, "InvalidPlanID");
    });
  });

  describe("Member Exit", function () {
    it("Should fail if try to exit before 30 days", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // ไม่สามารถออกได้ก่อน 30 วัน
      await expect(
        nft.connect(user1).exitMembership()
      ).to.be.revertedWithCustomError(nft, "ThirtyDayLock");
    });
  });

  describe("Funds Withdrawal", function () {
    it("Should withdraw owner balance", async function () {
      const { nft, usdt, owner, user1, decimals } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิกเพื่อให้มีเงินในระบบ
      await nft.connect(user1).registerMember(1, owner.address);

      // ดึงข้อมูลยอดคงเหลือของ owner
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3]; // ownerFunds

      // บันทึกยอดคงเหลือก่อนถอน
      const balanceBefore = await usdt.balanceOf(owner.address);

      // ถอนเงินออแนอร์
      await nft.connect(owner).withdrawOwnerBalance(ownerBalance);

      // ตรวจสอบว่าได้รับเงินถูกต้อง
      const balanceAfter = await usdt.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(ownerBalance);

      // ตรวจสอบว่ายอดเงินใน contract ลดลง
      const updatedSystemStats = await nft.getSystemStats();
      expect(updatedSystemStats[3]).to.equal(0); // ownerFunds
    });

    it("Should withdraw fee system balance", async function () {
      const { nft, usdt, owner, user1, decimals } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิกเพื่อให้มีเงินในระบบ
      await nft.connect(user1).registerMember(1, owner.address);

      // ดึงข้อมูลยอดคงเหลือของค่าธรรมเนียม
      const systemStats = await nft.getSystemStats();
      const feeBalance = systemStats[4]; // feeFunds

      // บันทึกยอดคงเหลือก่อนถอน
      const balanceBefore = await usdt.balanceOf(owner.address);

      // ถอนเงินค่าธรรมเนียม
      await nft.connect(owner).withdrawFeeSystemBalance(feeBalance);

      // ตรวจสอบว่าได้รับเงินถูกต้อง
      const balanceAfter = await usdt.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(feeBalance);

      // ตรวจสอบว่ายอดเงินใน contract ลดลง
      const updatedSystemStats = await nft.getSystemStats();
      expect(updatedSystemStats[4]).to.equal(0); // feeFunds
    });

    it("Should withdraw fund balance", async function () {
      const { nft, usdt, owner, user1, decimals } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิกเพื่อให้มีเงินในระบบ
      await nft.connect(user1).registerMember(1, owner.address);

      // ดึงข้อมูลยอดคงเหลือของกองทุน
      const systemStats = await nft.getSystemStats();
      const fundBalance = systemStats[5]; // fundFunds

      // บันทึกยอดคงเหลือก่อนถอน
      const balanceBefore = await usdt.balanceOf(owner.address);

      // ถอนเงินกองทุน
      await nft.connect(owner).withdrawFundBalance(fundBalance);

      // ตรวจสอบว่าได้รับเงินถูกต้อง
      const balanceAfter = await usdt.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(fundBalance);

      // ตรวจสอบว่ายอดเงินใน contract ลดลง
      const updatedSystemStats = await nft.getSystemStats();
      expect(updatedSystemStats[5]).to.equal(0); // fundFunds
    });

    it("Should perform batch withdrawal", async function () {
      const { nft, usdt, owner, user1, user2, decimals } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิกเพื่อให้มีเงินในระบบ
      await nft.connect(user1).registerMember(1, owner.address);

      // รอเพื่อป้องกัน TooSoon error
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      await nft.connect(user2).registerMember(1, user1.address);

      // ดึงข้อมูลยอดคงเหลือต่างๆ
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3]; // ownerFunds
      const feeBalance = systemStats[4]; // feeFunds
      const fundBalance = systemStats[5]; // fundFunds

      // บันทึกยอดคงเหลือก่อนถอน
      const ownerBalanceBefore = await usdt.balanceOf(owner.address);
      const user1BalanceBefore = await usdt.balanceOf(user1.address);

      // สร้าง withdrawal requests
      const withdrawalRequests = [
        {
          recipient: owner.address,
          amount: ownerBalance / 2n,
          balanceType: 0 // owner
        },
        {
          recipient: user1.address,
          amount: feeBalance / 2n,
          balanceType: 1 // fee
        }
      ];

      // ทำการถอนแบบกลุ่ม
      await nft.connect(owner).batchWithdraw(withdrawalRequests);

      // ตรวจสอบว่าได้รับเงินถูกต้อง
      const ownerBalanceAfter = await usdt.balanceOf(owner.address);
      const user1BalanceAfter = await usdt.balanceOf(user1.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(ownerBalance / 2n);
      expect(user1BalanceAfter - user1BalanceBefore).to.equal(feeBalance / 2n);

      // ตรวจสอบว่ายอดเงินใน contract ลดลง
      const updatedSystemStats = await nft.getSystemStats();
      expect(updatedSystemStats[3]).to.equal(ownerBalance / 2n); // ownerFunds
      expect(updatedSystemStats[4]).to.equal(feeBalance / 2n); // feeFunds
    });
  });

  describe("Emergency Functions", function () {
    it("Should request and perform emergency withdrawal", async function () {
      const { nft, usdt, owner, user1, user2, decimals } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิกเพื่อให้มีเงินในระบบ
      await nft.connect(user1).registerMember(1, owner.address);

      // รอเพื่อป้องกัน TooSoon error
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      await nft.connect(user2).registerMember(1, user1.address);

      // บันทึกยอดคงเหลือก่อนถอน
      const balanceBefore = await usdt.balanceOf(owner.address);
      const contractBalance = await usdt.balanceOf(await nft.getAddress());

      // ขอทำการถอนฉุกเฉิน
      await nft.connect(owner).requestEmergencyWithdraw();

      // ตรวจสอบว่ามีคำขอถอนฉุกเฉิน
      const contractStatus = await nft.getContractStatus();
      expect(contractStatus[4]).to.equal(true); // hasEmergencyRequest

      // จำลองการเวลาผ่านไป 2 วัน (TIMELOCK_DURATION)
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      // ทำการถอนฉุกเฉิน
      await nft.connect(owner).emergencyWithdraw();

      // ตรวจสอบว่าเงินถูกถอนออกมาทั้งหมด
      const balanceAfter = await usdt.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(contractBalance);
      expect(await usdt.balanceOf(await nft.getAddress())).to.equal(0);

      // ตรวจสอบว่ายอดคงเหลือต่างๆ ถูกรีเซ็ตเป็น 0
      const systemStats = await nft.getSystemStats();
      expect(systemStats[3]).to.equal(0); // ownerFunds
      expect(systemStats[4]).to.equal(0); // feeFunds
      expect(systemStats[5]).to.equal(0); // fundFunds
    });

    it("Should fail emergency withdrawal if timelock is active", async function () {
      const { nft, owner } = await loadFixture(deployFixture);

      // ขอทำการถอนฉุกเฉิน
      await nft.connect(owner).requestEmergencyWithdraw();

      // ถ้าเรียกการถอนฉุกเฉินทันที ควรจะล้มเหลว
      await expect(
        nft.connect(owner).emergencyWithdraw()
      ).to.be.revertedWithCustomError(nft, "TimelockActive");
    });

    it("Should allow to cancel emergency withdrawal request", async function () {
      const { nft, owner } = await loadFixture(deployFixture);

      // ขอทำการถอนฉุกเฉิน
      await nft.connect(owner).requestEmergencyWithdraw();

      // ตรวจสอบว่ามีคำขอถอนฉุกเฉิน
      let contractStatus = await nft.getContractStatus();
      expect(contractStatus[4]).to.equal(true); // hasEmergencyRequest

      // ยกเลิกคำขอถอนฉุกเฉิน
      await nft.connect(owner).cancelEmergencyWithdraw();

      // ตรวจสอบว่าคำขอถูกยกเลิก
      contractStatus = await nft.getContractStatus();
      expect(contractStatus[4]).to.equal(false); // hasEmergencyRequest
    });

    it("Should pause and restart the contract", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // หยุดการทำงานของสัญญา
      await nft.connect(owner).setPaused(true);

      // ตรวจสอบว่าสัญญาถูกหยุด
      let contractStatus = await nft.getContractStatus();
      expect(contractStatus[0]).to.equal(true); // isPaused

      // ไม่สามารถลงทะเบียนเมื่อสัญญาถูกหยุด
      await expect(
        nft.connect(user1).registerMember(1, owner.address)
      ).to.be.revertedWithCustomError(nft, "Paused");

      // เริ่มการทำงานของสัญญาใหม่
      await nft.connect(owner).restartAfterPause();

      // ตรวจสอบว่าสัญญากลับมาทำงาน
      contractStatus = await nft.getContractStatus();
      expect(contractStatus[0]).to.equal(false); // isPaused

      // ลงทะเบียนได้ตามปกติ
      await nft.connect(user1).registerMember(1, owner.address);
      expect(await nft.balanceOf(user1.address)).to.equal(1);
    });

    it("Should fail restarting if contract is not paused", async function () {
      const { nft, owner } = await loadFixture(deployFixture);

      // ไม่สามารถเริ่มต้นใหม่เมื่อสัญญายังไม่ถูกหยุด
      await expect(
        nft.connect(owner).restartAfterPause()
      ).to.be.revertedWithCustomError(nft, "NotPaused");
    });
  });

  describe("NFT Functionality", function () {
    it("Should prevent token transfers", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // ไม่สามารถโอน NFT ได้
      const tokenId = await nft.tokenOfOwnerByIndex(user1.address, 0);
      await expect(
        nft.connect(user1).transferFrom(user1.address, user2.address, tokenId)
      ).to.be.revertedWithCustomError(nft, "NonTransferable");
    });

    it("Should return token URI with correct format", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // ดึง tokenId
      const tokenId = await nft.tokenOfOwnerByIndex(user1.address, 0);

      // ดึง token URI
      const uri = await nft.tokenURI(tokenId);

      // ตรวจสอบว่า token URI เป็น data URL ที่ถูกต้อง
      expect(uri).to.include("data:application/json;base64,");
    });

    it("Should set base URI successfully", async function () {
      const { nft, owner } = await loadFixture(deployFixture);

      const newBaseURI = "https://example.com/nft/";

      // ตั้งค่า base URI
      await nft.connect(owner).setBaseURI(newBaseURI);

      // ตรวจสอบว่าฟังก์ชันทำงานได้โดยไม่มี error
      // (เนื่องจาก _baseURI เป็น internal function ไม่สามารถตรวจสอบได้โดยตรง)
    });
  });

  describe("View Functions", function () {
    it("Should return correct plan cycle info", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // รอเวลาเพื่อป้องกัน TooSoon error
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      await nft.connect(user2).registerMember(1, user1.address);

      // ดึงข้อมูลรอบของแผน 1
      const cycleInfo = await nft.getPlanCycleInfo(1);
      expect(cycleInfo[0]).to.equal(1n); // currentCycle
      expect(cycleInfo[1]).to.equal(2n); // membersInCurrentCycle
      expect(cycleInfo[2]).to.equal(4n); // membersPerCycle
    });

    it("Should return correct system stats", async function () {
      const { nft, owner, user1, user2, decimals } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // รอเวลา
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      await nft.connect(user2).registerMember(1, user1.address);

      // ดึงข้อมูลสถิติของระบบ
      const stats = await nft.getSystemStats();
      expect(stats[0]).to.equal(2n); // totalMembers
      expect(stats[1]).to.be.gt(0n); // totalRevenue
      expect(stats[2]).to.be.gt(0n); // totalCommission
      expect(stats[3]).to.be.gt(0n); // ownerFunds
      expect(stats[4]).to.be.gt(0n); // feeFunds
      expect(stats[5]).to.be.gt(0n); // fundFunds
    });

    it("Should return correct contract status", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // ดึงสถานะของสัญญา
      const status = await nft.getContractStatus();
      expect(status[0]).to.equal(false); // isPaused
      expect(status[1]).to.be.gt(0n); // totalBalance
      expect(status[2]).to.equal(1n); // memberCount
      expect(status[3]).to.equal(16n); // currentPlanCount
      expect(status[4]).to.equal(false); // hasEmergencyRequest
      expect(status[5]).to.equal(0n); // emergencyTimeRemaining
    });

    it("Should return correct NFT image data", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // ดึง tokenId
      const tokenId = await nft.tokenOfOwnerByIndex(user1.address, 0);

      // ดึงข้อมูลรูปภาพ NFT
      const imageData = await nft.getNFTImage(tokenId);
      expect(imageData.name).to.equal("1");
      expect(imageData.description).to.include("Crypto Membership NFT");
      expect(imageData.planId).to.equal(1n);
      expect(imageData.createdAt).to.be.gt(0n);
    });

    it("Should validate contract balance correctly", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // ตรวจสอบความถูกต้องของยอดเงิน
      const validation = await nft.validateContractBalance();
      expect(validation[0]).to.equal(true); // เงินใน contract มากกว่าหรือเท่ากับผลรวมของยอดเงินภายใน
      expect(validation[1]).to.be.gt(0n); // expectedBalance
      expect(validation[2]).to.be.gt(0n); // actualBalance
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle edge case with zero address checks", async function () {
      const { nft, user1 } = await loadFixture(deployFixture);

      // ไม่สามารถลงทะเบียนด้วย upline เป็น address 0 ได้โดยตรง
      await expect(
        nft.connect(user1).registerMember(1, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(nft, "ZeroAddress");
    });

    it("Should prevent front-running attacks with cooldown", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);

      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);

      // รอเวลาเพื่อให้ผ่าน cooldown
      await ethers.provider.send("evm_increaseTime", [90]);
      await ethers.provider.send("evm_mine");

      // ควรสามารถเรียกอีกฟังก์ชันได้หลังจากรอเวลาพอสมควร
    });

    it("Should prevent setting invalid values", async function () {
      const { nft, owner, decimals } = await loadFixture(deployFixture);

      // ไม่สามารถตั้งค่า plan ID ที่ไม่มีอยู่ได้
      await expect(
        nft.connect(owner).setPlanStatus(0, true)
      ).to.be.revertedWithCustomError(nft, "InvalidPlanID");

      await expect(
        nft.connect(owner).setPlanStatus(17, true)
      ).to.be.revertedWithCustomError(nft, "InvalidPlanID");

      // ไม่สามารถตั้งค่า image URI เป็นค่าว่างได้
      await expect(
        nft.connect(owner).setPlanDefaultImage(1, "")
      ).to.be.revertedWithCustomError(nft, "EmptyURI");

      // ไม่สามารถตั้งค่า base URI เป็นค่าว่างได้
      await expect(
        nft.connect(owner).setBaseURI("")
      ).to.be.revertedWithCustomError(nft, "EmptyURI");
    });

    it("Should prevent unauthorized access to owner-only functions", async function () {
      const { nft, user1, decimals } = await loadFixture(deployFixture);

      // ไม่สามารถเรียกฟังก์ชันที่จำกัดเฉพาะเจ้าของได้
      await expect(
        nft.connect(user1).setPaused(true)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");

      await expect(
        nft.connect(user1).createPlan(ethers.parseUnits("20", decimals), "Test", 4)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");

      await expect(
        nft.connect(user1).withdrawOwnerBalance(1)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("Should validate balance before withdrawal", async function () {
      const { nft, owner, decimals } = await loadFixture(deployFixture);

      // ไม่สามารถถอนเงินเกินกว่ายอดคงเหลือได้
      await expect(
        nft.connect(owner).withdrawOwnerBalance(ethers.parseUnits("100", decimals))
      ).to.be.revertedWithCustomError(nft, "LowOwnerBalance");

      await expect(
        nft.connect(owner).withdrawFeeSystemBalance(ethers.parseUnits("100", decimals))
      ).to.be.revertedWithCustomError(nft, "LowFeeBalance");

      await expect(
        nft.connect(owner).withdrawFundBalance(ethers.parseUnits("100", decimals))
      ).to.be.revertedWithCustomError(nft, "LowFundBalance");
    });

    // Event Tests
    describe("Missing Event Tests", function () {
      it("Should emit PriceFeedUpdated event", async function () {
        const { nft, owner } = await loadFixture(deployFixture);
        const newPriceFeed = "0x1234567890123456789012345678901234567890";

        await expect(nft.connect(owner).setPriceFeed(newPriceFeed))
          .to.emit(nft, "PriceFeedUpdated")
          .withArgs(newPriceFeed);
      });

      it("Should emit MembershipMinted event with correct data", async function () {
        const { nft, owner, user1 } = await loadFixture(deployFixture);

        await expect(nft.connect(user1).registerMember(1, owner.address))
          .to.emit(nft, "MembershipMinted")
          .withArgs(user1.address, 0, "Non-transferable");
      });
    });
  });
});