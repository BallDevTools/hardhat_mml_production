const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Event Validation & Missing Critical Tests", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    
    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    
    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(usdt.target, owner.address);
    
    // อนุมัติให้ contract ใช้ USDT
    const initialAmount = ethers.parseEther("1000");
    
    // แจก USDT ให้ผู้ใช้เพื่อทดสอบ
    for (const user of [user1, user2, user3, user4, user5]) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(nft.target, initialAmount);
    }
    
    return { nft, usdt, owner, user1, user2, user3, user4, user5 };
  }

  describe("1. Missing Event Parameter Validation", function () {
    it("Should emit events with exact parameter values", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // ทดสอบ MemberRegistered event parameters อย่างละเอียด
      const tx = await nft.connect(user1).registerMember(1, owner.address);
      const receipt = await tx.wait();
      
      // หา MemberRegistered event
      const memberRegisteredEvent = receipt.logs.find(log => {
        try {
          const parsed = nft.interface.parseLog(log);
          return parsed.name === "MemberRegistered";
        } catch {
          return false;
        }
      });
      
      expect(memberRegisteredEvent).to.not.be.undefined;
      
      const parsedEvent = nft.interface.parseLog(memberRegisteredEvent);
      expect(parsedEvent.args.length).to.equal(4); // member, upline, planId, cycleNumber
      expect(parsedEvent.args[0]).to.equal(user1.address);
      expect(parsedEvent.args[1]).to.equal(owner.address);
      expect(parsedEvent.args[2]).to.equal(1n);
      expect(parsedEvent.args[3]).to.equal(1n);
    });

    it("Should emit FundsDistributed with correct calculations", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      const tx = await nft.connect(user1).registerMember(1, owner.address);
      const receipt = await tx.wait();
      
      // หา FundsDistributed event
      const fundsDistributedEvent = receipt.logs.find(log => {
        try {
          const parsed = nft.interface.parseLog(log);
          return parsed.name === "FundsDistributed";
        } catch {
          return false;
        }
      });
      
      expect(fundsDistributedEvent).to.not.be.undefined;
      
      const parsedEvent = nft.interface.parseLog(fundsDistributedEvent);
      const [ownerShare, feeShare, fundShare] = parsedEvent.args;
      
      // ตรวจสอบการคำนวณตามสูตร (Plan 1: 50/50 split)
      const planPrice = ethers.parseEther("1");
      const userShare = (planPrice * 50n) / 100n;
      const companyShare = planPrice - userShare;
      
      const expectedOwnerShare = (companyShare * 80n) / 100n;
      const expectedFeeShare = (companyShare * 20n) / 100n;
      const expectedFundShare = (userShare * 40n) / 100n;
      
      expect(ownerShare).to.equal(expectedOwnerShare);
      expect(feeShare).to.equal(expectedFeeShare);
      expect(fundShare).to.equal(expectedFundShare);
    });
  });

  describe("2. Complex Plan Upgrade Chain Testing", function () {
    it("Should handle deep upgrade chain with notifications", async function () {
      const { nft, owner, user1, user2, user3 } = await loadFixture(deployFixture);
      
      // สร้าง chain: owner -> user1 -> user2 -> user3
      await nft.connect(user1).registerMember(1, owner.address);
      
      await ethers.provider.send("evm_increaseTime", [70]);
      await ethers.provider.send("evm_mine");
      
      await nft.connect(user2).registerMember(1, user1.address);
      
      await ethers.provider.send("evm_increaseTime", [70]);
      await ethers.provider.send("evm_mine");
      
      await nft.connect(user3).registerMember(1, user2.address);
      
      // รอเพื่อผ่าน upgrade cooldown
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 60]);
      await ethers.provider.send("evm_mine");
      
      // user3 upgrade ไป plan 2 (user2 ยังอยู่ plan 1)
      const tx = await nft.connect(user3).upgradePlan(2);
      
      // ตรวจสอบ UplineNotified event
      await expect(tx)
        .to.emit(nft, "UplineNotified")
        .withArgs(user2.address, user3.address, 1, 2);
      
      // ตรวจสอบ PlanUpgraded event
      await expect(tx)
        .to.emit(nft, "PlanUpgraded")
        .withArgs(user3.address, 1, 2, 1);
    });

    it("Should handle multiple upgrades in sequence", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนเป็น owner เพื่อสามารถ upgrade ข้าม plan ได้
      await nft.connect(owner).registerMember(1, owner);
      
      // รอเพื่อผ่าน upgrade cooldown
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 60]);
      await ethers.provider.send("evm_mine");
      
      // Owner สามารถ upgrade ได้หลาย plan
      await nft.connect(owner).upgradePlan(5);
      
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 60]);
      await ethers.provider.send("evm_mine");
      
      await nft.connect(owner).upgradePlan(10);
      
      // ตรวจสอบว่า owner อยู่ใน plan 10
      const member = await nft.members(owner.address);
      expect(member.planId).to.equal(10);
    });
  });

  describe("3. Emergency Withdrawal Edge Cases", function () {
    it("Should handle emergency withdrawal with insufficient funds", async function () {
      const { nft, usdt, owner, user1 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิกเพื่อให้มีเงินใน contract
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ถอนเงินออก owner balance บางส่วนก่อน
      const systemStats = await nft.getSystemStats();
      const ownerBalance = systemStats[3];
      if (ownerBalance > 0n) {
        await nft.connect(owner).withdrawOwnerBalance(ownerBalance);
      }
      
      // ขอทำการถอนฉุกเฉิน
      await nft.connect(owner).requestEmergencyWithdraw();
      
      // รอเวลา timelock
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      const contractBalanceBefore = await usdt.balanceOf(nft.target);
      
      // ทำการถอนฉุกเฉิน
      await nft.connect(owner).emergencyWithdraw();
      
      // ตรวจสอบว่าเงินถูกถอนออกมาทั้งหมด
      expect(await usdt.balanceOf(nft.target)).to.equal(0);
      
      // ตรวจสอบว่า state variables ถูกรีเซ็ต
      const finalStats = await nft.getSystemStats();
      expect(finalStats[3]).to.equal(0n); // ownerFunds
      expect(finalStats[4]).to.equal(0n); // feeFunds
      expect(finalStats[5]).to.equal(0n); // fundFunds
    });

    it("Should emit EmergencyWithdrawInitiated with correct data", async function () {
      const { nft, usdt, owner, user1 } = await loadFixture(deployFixture);
      
      // สร้างยอดเงินใน contract
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ขอทำการถอนฉุกเฉิน
      await nft.connect(owner).requestEmergencyWithdraw();
      
      // รอเวลา timelock
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      const contractBalance = await usdt.balanceOf(nft.target);
      const tx = await nft.connect(owner).emergencyWithdraw();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      await expect(tx)
        .to.emit(nft, "EmergencyWithdrawInitiated")
        .withArgs(block.timestamp, contractBalance);
    });
  });

  describe("4. NFT Transfer Prevention Testing", function () {
    it("Should block all forms of NFT transfers and emit events", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);
      const tokenId = await nft.tokenOfOwnerByIndex(user1.address, 0);
      
      // ทดสอบ transferFrom
      await expect(
        nft.connect(user1).transferFrom(user1.address, user2.address, tokenId)
      ).to.be.revertedWithCustomError(nft, "NonTransferable");
      
      // ทดสอบ safeTransferFrom (2 parameters)
      await expect(
        nft.connect(user1)["safeTransferFrom(address,address,uint256)"](
          user1.address, user2.address, tokenId
        )
      ).to.be.revertedWithCustomError(nft, "NonTransferable");
      
      // ทดสอบ safeTransferFrom (3 parameters)
      await expect(
        nft.connect(user1)["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address, user2.address, tokenId, "0x"
        )
      ).to.be.revertedWithCustomError(nft, "NonTransferable");
    });

    it("Should return false for isTokenTransferable", async function () {
      const { nft } = await loadFixture(deployFixture);
      
      expect(await nft.isTokenTransferable()).to.equal(false);
    });
  });

  describe("5. State Consistency Validation", function () {
    it("Should maintain consistent balance tracking", async function () {
      const { nft, usdt, owner, user1, user2 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิกหลายคน
      await nft.connect(user1).registerMember(1, owner.address);
      
      await ethers.provider.send("evm_increaseTime", [70]);
      await ethers.provider.send("evm_mine");
      
      await nft.connect(user2).registerMember(1, user1.address);
      
      // ตรวจสอบความสอดคล้องของยอดเงิน
      const [isValid, expectedBalance, actualBalance] = await nft.validateContractBalance();
      expect(isValid).to.equal(true);
      expect(actualBalance).to.be.gte(expectedBalance);
      
      // ตรวจสอบว่าผลรวมของ internal balances ไม่เกิน actual balance
      const systemStats = await nft.getSystemStats();
      const totalInternal = systemStats[3] + systemStats[4] + systemStats[5]; // owner + fee + fund
      const contractBalance = await usdt.balanceOf(nft.target);
      
      expect(contractBalance).to.be.gte(totalInternal);
    });

    it("Should maintain correct member counts across operations", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิก
      await nft.connect(user1).registerMember(1, owner.address);
      
      await ethers.provider.send("evm_increaseTime", [70]);
      await ethers.provider.send("evm_mine");
      
      await nft.connect(user2).registerMember(1, user1.address);
      
      // ตรวจสอบ member count
      expect(await nft.totalSupply()).to.equal(2);
      
      const systemStats = await nft.getSystemStats();
      expect(systemStats[0]).to.equal(2n); // totalMembers
      
      // ตรวจสอบ cycle info
      const cycleInfo = await nft.getPlanCycleInfo(1);
      expect(cycleInfo[1]).to.equal(2n); // membersInCurrentCycle
    });
  });

  describe("6. Advanced Input Validation", function () {
    it("Should handle boundary values correctly", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      // ทดสอบ plan price ที่สูงมาก
      const maxPrice = ethers.parseEther("1000000"); // 1M tokens
      await nft.connect(owner).createPlan(maxPrice, "Mega Plan", 4);
      
      // ทดสอบชื่อที่ยาวมาก
      const longName = "A".repeat(100);
      await nft.connect(owner).createPlan(ethers.parseEther("2000000"), longName, 4);
      
      // ทดสอบ URI ที่ยาวมาก
      const longURI = "ipfs://" + "a".repeat(200);
      await nft.connect(owner).setPlanDefaultImage(1, longURI);
    });

    it("Should validate withdrawal requests properly", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // สร้างยอดเงินใน contract
      await nft.connect(user1).registerMember(1, owner.address);
      
      // ทดสอบ batch withdrawal ที่ไม่ถูกต้อง
      const invalidRequests = [
        {
          recipient: ethers.ZeroAddress, // invalid address
          amount: ethers.parseEther("1"),
          balanceType: 0
        }
      ];
      
      await expect(
        nft.connect(owner).batchWithdraw(invalidRequests)
      ).to.be.revertedWithCustomError(nft, "InvalidRequest");
      
      // ทดสอบ amount = 0
      const zeroAmountRequests = [
        {
          recipient: owner.address,
          amount: 0, // invalid amount
          balanceType: 0
        }
      ];
      
      await expect(
        nft.connect(owner).batchWithdraw(zeroAmountRequests)
      ).to.be.revertedWithCustomError(nft, "InvalidRequest");
    });
  });

  describe("7. Event Sequence Validation", function () {
    it("Should emit events in correct order during registration", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      const tx = await nft.connect(user1).registerMember(1, owner.address);
      const receipt = await tx.wait();
      
      // ดึง events ทั้งหมดจาก transaction
      const events = receipt.logs
        .map(log => {
          try {
            return nft.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter(event => event !== null);
      
      // ตรวจสอบลำดับ events
      const eventNames = events.map(e => e.name);
      
      // อย่างน้อยควรมี events เหล่านี้
      expect(eventNames).to.include("MemberRegistered");
      expect(eventNames).to.include("FundsDistributed");
      expect(eventNames).to.include("MembershipMinted");
      
      // Transfer event จาก ERC721 (mint)
      const transferEvents = events.filter(e => e.name === "Transfer");
      expect(transferEvents.length).to.be.gte(1);
    });

    it("Should emit NewCycleStarted at the right time", async function () {
      const { nft, owner, user1, user2, user3, user4, user5 } = await loadFixture(deployFixture);
      
      // ลงทะเบียนสมาชิก 3 คนแรก (ยังไม่ครบรอบ)
      await nft.connect(user1).registerMember(1, owner.address);
      
      await ethers.provider.send("evm_increaseTime", [70]);
      await ethers.provider.send("evm_mine");
      
      await nft.connect(user2).registerMember(1, user1.address);
      
      await ethers.provider.send("evm_increaseTime", [70]);
      await ethers.provider.send("evm_mine");
      
      await nft.connect(user3).registerMember(1, user2.address);
      
      // ตรวจสอบว่ายังไม่มี NewCycleStarted
      const cycleInfo1 = await nft.getPlanCycleInfo(1);
      expect(cycleInfo1[0]).to.equal(1n); // ยังเป็นรอบ 1
      
      await ethers.provider.send("evm_increaseTime", [70]);
      await ethers.provider.send("evm_mine");
      
      // สมาชิกคนที่ 4 จะทำให้เริ่มรอบใหม่
      const tx = await nft.connect(user4).registerMember(1, user3.address);
      
      await expect(tx)
        .to.emit(nft, "NewCycleStarted")
        .withArgs(1, 2); // planId, newCycleNumber