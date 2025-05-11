// test/unit/FinanceLib.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FinanceLib", function () {
  let tester;

  before(async function () {
    // Deploy tester contract without specifying libraries - HardHat will handle linking automatically
    const FinanceLibTester = await ethers.getContractFactory("FinanceLibTester");
    tester = await FinanceLibTester.deploy();
    await tester.waitForDeployment();
    console.log("FinanceLibTester deployed at:", await tester.getAddress());
  });

  describe("getPlanShares", function() {
    it("should return 50/50 split for plans 1-4", async function() {
      for (let i = 1; i <= 4; i++) {
        const result = await tester.testGetPlanShares(i);
        expect(result[0]).to.equal(50); // userShare
        expect(result[1]).to.equal(50); // companyShare
      }
    });

    it("should return 55/45 split for plans 5-8", async function() {
      for (let i = 5; i <= 8; i++) {
        const result = await tester.testGetPlanShares(i);
        expect(result[0]).to.equal(55);
        expect(result[1]).to.equal(45);
      }
    });

    it("should return 58/42 split for plans 9-12", async function() {
      for (let i = 9; i <= 12; i++) {
        const result = await tester.testGetPlanShares(i);
        expect(result[0]).to.equal(58);
        expect(result[1]).to.equal(42);
      }
    });

    it("should return 60/40 split for plans 13+", async function() {
      for (let i = 13; i <= 16; i++) {
        const result = await tester.testGetPlanShares(i);
        expect(result[0]).to.equal(60);
        expect(result[1]).to.equal(40);
      }
    });
  });

  describe("distributeFunds", function() {
    it("should distribute funds correctly for plan 1", async function() {
      const amount = ethers.parseEther("100");
      const planId = 1;
      
      const result = await tester.testDistributeFunds(amount, planId);
      
      // นำข้อมูลออกจาก result แทนการใช้ destructuring
      const ownerShare = result[0];
      const feeShare = result[1];
      const fundShare = result[2];
      const uplineShare = result[3];
      
      // คำนวณค่าที่คาดหวัง
      const expectedOwnerShare = amount * 50n * 80n / 10000n;
      const expectedFeeShare = amount * 50n * 20n / 10000n;
      const expectedUplineShare = amount * 50n * 60n / 10000n;
      const expectedFundShare = amount * 50n * 40n / 10000n;
      
      expect(ownerShare).to.equal(expectedOwnerShare);
      expect(feeShare).to.equal(expectedFeeShare);
      expect(fundShare).to.equal(expectedFundShare);
      expect(uplineShare).to.equal(expectedUplineShare);
      
      // ตรวจสอบผลรวม
      const totalDistributed = ownerShare + feeShare + fundShare + uplineShare;
      expect(totalDistributed).to.equal(amount);
    });
  });
});