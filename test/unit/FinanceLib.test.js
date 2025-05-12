const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("FinanceLib Unit Tests", function () {
  async function deployFixture() {
    // Deploy FinanceLibTester contract ซึ่งใช้ฟังก์ชันจาก FinanceLib
    const FinanceLibTester = await ethers.getContractFactory("FinanceLibTester");
    const tester = await FinanceLibTester.deploy();
    
    return { tester };
  }
  
  describe("getPlanShares", function () {
    it("Should return correct user and company shares for plan 1-4", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบกับแผน 1-4
      for (let planId = 1; planId <= 4; planId++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(planId);
        expect(userShare).to.equal(50n);
        expect(companyShare).to.equal(50n);
        expect(userShare + companyShare).to.equal(100n); // ตรวจสอบว่าผลรวมเป็น 100%
      }
    });
    
    it("Should return correct user and company shares for plan 5-8", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบกับแผน 5-8
      for (let planId = 5; planId <= 8; planId++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(planId);
        expect(userShare).to.equal(55n);
        expect(companyShare).to.equal(45n);
        expect(userShare + companyShare).to.equal(100n); // ตรวจสอบว่าผลรวมเป็น 100%
      }
    });
    
    it("Should return correct user and company shares for plan 9-12", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบกับแผน 9-12
      for (let planId = 9; planId <= 12; planId++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(planId);
        expect(userShare).to.equal(58n);
        expect(companyShare).to.equal(42n);
        expect(userShare + companyShare).to.equal(100n); // ตรวจสอบว่าผลรวมเป็น 100%
      }
    });
    
    it("Should return correct user and company shares for plan 13-16", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบกับแผน 13-16
      for (let planId = 13; planId <= 16; planId++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(planId);
        expect(userShare).to.equal(60n);
        expect(companyShare).to.equal(40n);
        expect(userShare + companyShare).to.equal(100n); // ตรวจสอบว่าผลรวมเป็น 100%
      }
    });
  });
  
  describe("distributeFunds", function () {
    it("Should distribute funds correctly for plan 1", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      const planId = 1;
      
      const [ownerShare, feeShare, fundShare, uplineShare] = await tester.testDistributeFunds(amount, planId);
      
      // สำหรับแผน 1: userShare = 50%, companyShare = 50%
      // companyShare แบ่งเป็น: ownerShare = 80%, feeShare = 20%
      // userShare แบ่งเป็น: uplineShare = 60%, fundShare = 40%
      
      const companyShare = ownerShare + feeShare;
      const userShare = fundShare + uplineShare;
      
      // ตรวจสอบการแบ่งแบบกว้าง
      expect(userShare + companyShare).to.equal(amount); // รวมทั้งหมดต้องเท่ากับจำนวนเงินทั้งหมด
      expect(userShare).to.equal(amount * 50n / 100n); // userShare = 50%
      expect(companyShare).to.equal(amount * 50n / 100n); // companyShare = 50%
      
      // ตรวจสอบส่วนแบ่งบริษัท
      expect(ownerShare).to.equal(companyShare * 80n / 100n); // ownerShare = 80% ของ companyShare
      expect(feeShare).to.equal(companyShare * 20n / 100n); // feeShare = 20% ของ companyShare
      
      // ตรวจสอบส่วนแบ่งผู้ใช้
      expect(uplineShare).to.equal(userShare * 60n / 100n); // uplineShare = 60% ของ userShare
      expect(fundShare).to.equal(userShare * 40n / 100n); // fundShare = 40% ของ userShare
    });
    
    it("Should distribute funds correctly for plan 8", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      const planId = 8;
      
      const [ownerShare, feeShare, fundShare, uplineShare] = await tester.testDistributeFunds(amount, planId);
      
      // สำหรับแผน 8: userShare = 55%, companyShare = 45%
      const companyShare = ownerShare + feeShare;
      const userShare = fundShare + uplineShare;
      
      // ตรวจสอบการแบ่งแบบกว้าง
      expect(userShare + companyShare).to.equal(amount);
      expect(userShare).to.equal(amount * 55n / 100n);
      expect(companyShare).to.equal(amount * 45n / 100n);
      
      // ตรวจสอบส่วนแบ่งบริษัท
      expect(ownerShare).to.equal(companyShare * 80n / 100n);
      expect(feeShare).to.equal(companyShare * 20n / 100n);
      
      // ตรวจสอบส่วนแบ่งผู้ใช้
      expect(uplineShare).to.equal(userShare * 60n / 100n);
      expect(fundShare).to.equal(userShare * 40n / 100n);
    });
    
    it("Should distribute funds correctly for plan 12", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      const planId = 12;
      
      const [ownerShare, feeShare, fundShare, uplineShare] = await tester.testDistributeFunds(amount, planId);
      
      // สำหรับแผน 12: userShare = 58%, companyShare = 42%
      const companyShare = ownerShare + feeShare;
      const userShare = fundShare + uplineShare;
      
      // ตรวจสอบการแบ่งแบบกว้าง
      expect(userShare + companyShare).to.equal(amount);
      expect(userShare).to.equal(amount * 58n / 100n);
      expect(companyShare).to.equal(amount * 42n / 100n);
      
      // ตรวจสอบส่วนแบ่งบริษัท
      expect(ownerShare).to.equal(companyShare * 80n / 100n);
      expect(feeShare).to.equal(companyShare * 20n / 100n);
      
      // ตรวจสอบส่วนแบ่งผู้ใช้
      expect(uplineShare).to.equal(userShare * 60n / 100n);
      expect(fundShare).to.equal(userShare * 40n / 100n);
    });
    
    it("Should distribute funds correctly for plan 16", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      const planId = 16;
      
      const [ownerShare, feeShare, fundShare, uplineShare] = await tester.testDistributeFunds(amount, planId);
      
      // สำหรับแผน 16: userShare = 60%, companyShare = 40%
      const companyShare = ownerShare + feeShare;
      const userShare = fundShare + uplineShare;
      
      // ตรวจสอบการแบ่งแบบกว้าง
      expect(userShare + companyShare).to.equal(amount);
      expect(userShare).to.equal(amount * 60n / 100n);
      expect(companyShare).to.equal(amount * 40n / 100n);
      
      // ตรวจสอบส่วนแบ่งบริษัท
      expect(ownerShare).to.equal(companyShare * 80n / 100n);
      expect(feeShare).to.equal(companyShare * 20n / 100n);
      
      // ตรวจสอบส่วนแบ่งผู้ใช้
      expect(uplineShare).to.equal(userShare * 60n / 100n);
      expect(fundShare).to.equal(userShare * 40n / 100n);
    });
    
    it("Should handle exact rounding for odd amounts", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ใช้จำนวนเงินที่ไม่ใช่เลขกลม เพื่อทดสอบการปัดเศษ
      const amount = ethers.parseEther("123.456789");
      const planId = 1;
      
      const [ownerShare, feeShare, fundShare, uplineShare] = await tester.testDistributeFunds(amount, planId);
      
      // ตรวจสอบว่าผลรวมของทุกส่วนเท่ากับจำนวนเงินทั้งหมด
      expect(ownerShare + feeShare + fundShare + uplineShare).to.equal(amount);
    });
  });
});