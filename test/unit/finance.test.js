// test/unit/finance.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT - Finance Functions", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let user3;

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    fakeUSDT = await FakeUSDT.deploy();
    await fakeUSDT.waitForDeployment();

    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    cryptoMembershipNFT = await CryptoMembershipNFT.deploy(
      await fakeUSDT.getAddress(),
      owner.address
    );
    await cryptoMembershipNFT.waitForDeployment();

    // Transfer USDT to users for testing
    const usdtAmount = ethers.parseEther("1000");
    for (const user of [user1, user2, user3]) {
      await fakeUSDT.transfer(user.address, usdtAmount);
      await fakeUSDT.connect(user).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    }

    // Register users to generate funds
    await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
    await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
    await cryptoMembershipNFT.connect(user3).registerMember(1, user1.address);
  });

  describe("withdrawOwnerBalance", function () {
    it("should allow owner to withdraw owner balance", async function () {
      // Get contract state before withdrawal
      const stateBefore = await cryptoMembershipNFT.state();
      const ownerBalanceBefore = stateBefore.ownerBalance;

      // Get owner USDT balance before withdrawal
      const ownerUsdtBalanceBefore = await fakeUSDT.balanceOf(owner.address);

      // Withdraw owner balance
      await cryptoMembershipNFT.withdrawOwnerBalance(ownerBalanceBefore);

      // Get contract state after withdrawal
      const stateAfter = await cryptoMembershipNFT.state();

      // Get owner USDT balance after withdrawal
      const ownerUsdtBalanceAfter = await fakeUSDT.balanceOf(owner.address);

      // Check balances
      expect(stateAfter.ownerBalance).to.equal(0); // Owner balance should be 0 after complete withdrawal
      expect(ownerUsdtBalanceAfter).to.equal(ownerUsdtBalanceBefore + ownerBalanceBefore);
    });

    it("should allow partial withdrawal of owner balance", async function () {
      // Get contract state before withdrawal
      const stateBefore = await cryptoMembershipNFT.state();
      const ownerBalanceBefore = stateBefore.ownerBalance;

      // Calculate partial amount (50% of balance)
      const partialAmount = ownerBalanceBefore / 2n;

      // Get owner USDT balance before withdrawal
      const ownerUsdtBalanceBefore = await fakeUSDT.balanceOf(owner.address);

      // Withdraw partial owner balance
      await cryptoMembershipNFT.withdrawOwnerBalance(partialAmount);

      // Get contract state after withdrawal
      const stateAfter = await cryptoMembershipNFT.state();

      // Get owner USDT balance after withdrawal
      const ownerUsdtBalanceAfter = await fakeUSDT.balanceOf(owner.address);

      // Check balances
      expect(stateAfter.ownerBalance).to.equal(ownerBalanceBefore - partialAmount);
      expect(ownerUsdtBalanceAfter).to.equal(ownerUsdtBalanceBefore + partialAmount);
    });

    it("should revert when trying to withdraw more than available owner balance", async function () {
      // Get contract state
      const state = await cryptoMembershipNFT.state();
      const ownerBalance = state.ownerBalance;

      // Try to withdraw more than available
      await expect(
        cryptoMembershipNFT.withdrawOwnerBalance(ownerBalance + 1n)
      ).to.be.revertedWith("0x29"); // Error code for insufficient balance
    });

    it("should revert when non-owner tries to withdraw owner balance", async function () {
      // Get contract state
      const state = await cryptoMembershipNFT.state();
      const ownerBalance = state.ownerBalance;

      // Try to withdraw as non-owner
      await expect(
        cryptoMembershipNFT.connect(user1).withdrawOwnerBalance(ownerBalance)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("withdrawFeeSystemBalance", function () {
    it("should allow owner to withdraw fee system balance", async function () {
      // Get contract state before withdrawal
      const stateBefore = await cryptoMembershipNFT.state();
      const feeSystemBalanceBefore = stateBefore.feeSystemBalance;

      // Get owner USDT balance before withdrawal
      const ownerUsdtBalanceBefore = await fakeUSDT.balanceOf(owner.address);

      // Withdraw fee system balance
      await cryptoMembershipNFT.withdrawFeeSystemBalance(feeSystemBalanceBefore);

      // Get contract state after withdrawal
      const stateAfter = await cryptoMembershipNFT.state();

      // Get owner USDT balance after withdrawal
      const ownerUsdtBalanceAfter = await fakeUSDT.balanceOf(owner.address);

      // Check balances
      expect(stateAfter.feeSystemBalance).to.equal(0);
      expect(ownerUsdtBalanceAfter).to.equal(ownerUsdtBalanceBefore + feeSystemBalanceBefore);
    });

    it("should revert when trying to withdraw more than available fee system balance", async function () {
      // Get contract state
      const state = await cryptoMembershipNFT.state();
      const feeSystemBalance = state.feeSystemBalance;

      // Try to withdraw more than available
      await expect(
        cryptoMembershipNFT.withdrawFeeSystemBalance(feeSystemBalance + 1n)
      ).to.be.revertedWith("0x2A"); // Error code for insufficient balance
    });

    it("should revert when non-owner tries to withdraw fee system balance", async function () {
      // Get contract state
      const state = await cryptoMembershipNFT.state();
      const feeSystemBalance = state.feeSystemBalance;

      // Try to withdraw as non-owner
      await expect(
        cryptoMembershipNFT.connect(user1).withdrawFeeSystemBalance(feeSystemBalance)
      ).to.be.reverted; // Will be reverted due to Ownable
    });
  });

  describe("withdrawFundBalance", function () {
    it("should allow owner to withdraw fund balance", async function () {
      // Get contract state before withdrawal
      const stateBefore = await cryptoMembershipNFT.state();
      const fundBalanceBefore = stateBefore.fundBalance;

      // Reserve some funds for exitMembership tests (30% of plan price)
      const planPrice = (await cryptoMembershipNFT.plans(1)).price;
      const reserveAmount = (planPrice * 30n) / 100n * 3n; // For 3 users

      // Calculate amount to withdraw
      const withdrawAmount = fundBalanceBefore - reserveAmount;

      // Get owner USDT balance before withdrawal
      const ownerUsdtBalanceBefore = await fakeUSDT.balanceOf(owner.address);

      // Withdraw fund balance
      await cryptoMembershipNFT.withdrawFundBalance(withdrawAmount);

      // Get contract state after withdrawal
      const stateAfter = await cryptoMembershipNFT.state();

      // Get owner USDT balance after withdrawal
      const ownerUsdtBalanceAfter = await fakeUSDT.balanceOf(owner.address);

      // Check balances
      expect(stateAfter.fundBalance).to.equal(fundBalanceBefore - withdrawAmount);
      expect(ownerUsdtBalanceAfter).to.equal(ownerUsdtBalanceBefore + withdrawAmount);
    });



    describe("Validation Tests", function () {
      it("should correctly validate contract balance", async function () {
        // Check initial validation - should be valid
        const validation = await cryptoMembershipNFT.validateContractBalance();
        expect(validation[0]).to.equal(true); // isValid

        // Expected balance should match actual balance
        expect(validation[1]).to.equal(validation[2]);

        // Get state
        const state = await cryptoMembershipNFT.state();
        const totalStoredBalance = state.ownerBalance + state.feeSystemBalance + state.fundBalance;

        // Total stored balance should match expected balance
        expect(validation[1]).to.equal(totalStoredBalance);
      });
    });

    describe("Exit Membership", function () {
      it("should allow a member to exit and receive partial refund", async function () {
        // Register a new member for this test
        await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);

        // Fast forward 31 days (more than the required 30 days)
        await time.increase(31 * 24 * 60 * 60);

        // Get plan price
        const planPrice = (await cryptoMembershipNFT.plans(1)).price;
        const refundAmount = (planPrice * 30n) / 100n; // 30% refund

        // Get user USDT balance before exit
        const userBalanceBefore = await fakeUSDT.balanceOf(user1.address);

        // Get fund balance before exit
        const fundBalanceBefore = (await cryptoMembershipNFT.state()).fundBalance;

        // Exit membership
        await expect(cryptoMembershipNFT.connect(user1).exitMembership())
          .to.emit(cryptoMembershipNFT, "MemberExited")
          .withArgs(user1.address, refundAmount);

        // Get user USDT balance after exit
        const userBalanceAfter = await fakeUSDT.balanceOf(user1.address);

        // Get fund balance after exit
        const fundBalanceAfter = (await cryptoMembershipNFT.state()).fundBalance;

        // Check balances
        expect(userBalanceAfter).to.equal(userBalanceBefore + refundAmount);
        expect(fundBalanceAfter).to.equal(fundBalanceBefore - refundAmount);

        // Check NFT was burned
        expect(await cryptoMembershipNFT.balanceOf(user1.address)).to.equal(0);
      });

      it("should revert when trying to exit before the required period", async function () {
        // Register a new member for this test
        await cryptoMembershipNFT.connect(user2).registerMember(1, owner.address);

        // Fast forward only 29 days (less than the required 30 days)
        await time.increase(29 * 24 * 60 * 60);

        // Try to exit membership
        await expect(
          cryptoMembershipNFT.connect(user2).exitMembership()
        ).to.be.revertedWith("0x27"); // Error code for not enough time passed
      });

      it("should revert when fund balance is insufficient for refund", async function () {
        // Register a new member for this test
        await cryptoMembershipNFT.connect(user3).registerMember(1, owner.address);

        // Fast forward 31 days
        await time.increase(31 * 24 * 60 * 60);

        // Withdraw most of the fund balance to make it insufficient
        const state = await cryptoMembershipNFT.state();
        const withdrawAmount = state.fundBalance - 1n; // Leave just 1 wei
        await cryptoMembershipNFT.withdrawFundBalance(withdrawAmount);

        // Try to exit membership
        await expect(
          cryptoMembershipNFT.connect(user3).exitMembership()
        ).to.be.revertedWith("0x28"); // Error code for insufficient fund balance
      });

      it("should revert when non-member tries to exit", async function () {
        // Try to exit membership as non-member
        await expect(
          cryptoMembershipNFT.connect(user2).exitMembership()
        ).to.be.revertedWith("0x02"); // Error code for not a member
      });
    });
  });

  describe("batchWithdraw", function () {
    // ทำให้การทดสอบการถอนเงินแบบกลุ่มสมบูรณ์
    it("should allow owner to perform batch withdrawal", async function () {
      // รับสถานะคอนแทรกต์ก่อนการถอนเงิน
      const stateBefore = await cryptoMembershipNFT.state();

      // รับยอดคงเหลือก่อนการถอนเงิน
      const ownerBalanceBefore = await fakeUSDT.balanceOf(owner.address);
      const user1BalanceBefore = await fakeUSDT.balanceOf(user1.address);
      const user2BalanceBefore = await fakeUSDT.balanceOf(user2.address);

      // คำนวณจำนวนการถอนเงิน
      const ownerAmount = stateBefore.ownerBalance / 2n;
      const feeAmount = stateBefore.feeSystemBalance / 2n;
      const fundAmount = stateBefore.fundBalance / 4n;

      // เตรียมคำขอถอนเงิน
      const requests = [
        {
          recipient: owner.address,
          amount: ownerAmount,
          balanceType: 0 // ยอดคงเหลือของเจ้าของ
        },
        {
          recipient: user1.address,
          amount: feeAmount,
          balanceType: 1 // ยอดคงเหลือค่าธรรมเนียมระบบ
        },
        {
          recipient: user2.address,
          amount: fundAmount,
          balanceType: 2 // ยอดคงเหลือกองทุน
        }
      ];

      // ดำเนินการถอนเงินแบบกลุ่ม
      await expect(cryptoMembershipNFT.batchWithdraw(requests))
        .to.emit(cryptoMembershipNFT, "BatchWithdrawalProcessed")
        .withArgs(ownerAmount, feeAmount, fundAmount);

      // รับยอดคงเหลือหลังการถอนเงิน
      const ownerBalanceAfter = await fakeUSDT.balanceOf(owner.address);
      const user1BalanceAfter = await fakeUSDT.balanceOf(user1.address);
      const user2BalanceAfter = await fakeUSDT.balanceOf(user2.address);

      // ตรวจสอบยอดคงเหลือ
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + ownerAmount);
      expect(user1BalanceAfter).to.equal(user1BalanceBefore + feeAmount);
      expect(user2BalanceAfter).to.equal(user2BalanceBefore + fundAmount);

      // รับสถานะคอนแทรกต์หลังการถอนเงิน
      const stateAfter = await cryptoMembershipNFT.state();

      // ตรวจสอบยอดคงเหลือสถานะ
      expect(stateAfter.ownerBalance).to.equal(stateBefore.ownerBalance - ownerAmount);
      expect(stateAfter.feeSystemBalance).to.equal(stateBefore.feeSystemBalance - feeAmount);
      expect(stateAfter.fundBalance).to.equal(stateBefore.fundBalance - fundAmount);
    });

    it("should revert when batch has too many requests", async function () {
      // สร้างคำขอมากกว่า 20 รายการ (ขีดจำกัดของคอนแทรกต์)
      const requests = [];
      for (let i = 0; i < 21; i++) {
        requests.push({
          recipient: owner.address,
          amount: 1,
          balanceType: 0
        });
      }

      // พยายามประมวลผลคำขอมากเกินไป
      await expect(
        cryptoMembershipNFT.batchWithdraw(requests)
      ).to.be.revertedWith("0x2D"); // รหัสข้อผิดพลาดสำหรับคำขอมากเกินไป
    });

    it("should revert when batch has invalid recipient", async function () {
      const requests = [{
        recipient: ethers.ZeroAddress,
        amount: 1,
        balanceType: 0
      }];

      await expect(
        cryptoMembershipNFT.batchWithdraw(requests)
      ).to.be.revertedWith("0x2E"); // รหัสข้อผิดพลาดสำหรับผู้รับไม่ถูกต้อง
    });

    it("should revert when batch has invalid amount", async function () {
      const requests = [{
        recipient: owner.address,
        amount: 0,
        balanceType: 0
      }];

      await expect(
        cryptoMembershipNFT.batchWithdraw(requests)
      ).to.be.revertedWith("0x2F"); // รหัสข้อผิดพลาดสำหรับจำนวนไม่ถูกต้อง
    });

    it("should revert when batch has invalid balance type", async function () {
      const requests = [{
        recipient: owner.address,
        amount: 1,
        balanceType: 3 // ประเภทยอดคงเหลือไม่ถูกต้อง (0-2 ถูกต้อง)
      }];

      await expect(
        cryptoMembershipNFT.batchWithdraw(requests)
      ).to.be.revertedWith("0x30"); // รหัสข้อผิดพลาดสำหรับประเภทยอดคงเหลือไม่ถูกต้อง
    });

    it("should revert when batch has insufficient owner balance", async function () {
      const ownerBalance = (await cryptoMembershipNFT.state()).ownerBalance;

      const requests = [{
        recipient: owner.address,
        amount: ownerBalance + 1n,
        balanceType: 0
      }];

      await expect(
        cryptoMembershipNFT.batchWithdraw(requests)
      ).to.be.revertedWith("0x31"); // รหัสข้อผิดพลาดสำหรับยอดคงเหลือของเจ้าของไม่เพียงพอ
    });

    it("should revert when batch has insufficient fee balance", async function () {
      const feeSystemBalance = (await cryptoMembershipNFT.state()).feeSystemBalance;

      const requests = [{
        recipient: owner.address,
        amount: feeSystemBalance + 1n,
        balanceType: 1
      }];

      await expect(
        cryptoMembershipNFT.batchWithdraw(requests)
      ).to.be.revertedWith("0x32"); // รหัสข้อผิดพลาดสำหรับยอดคงเหลือค่าธรรมเนียมไม่เพียงพอ
    });

    it("should revert when batch has insufficient fund balance", async function () {
      const fundBalance = (await cryptoMembershipNFT.state()).fundBalance;

      const requests = [{
        recipient: owner.address,
        amount: fundBalance + 1n,
        balanceType: 2
      }];

      await expect(
        cryptoMembershipNFT.batchWithdraw(requests)
      ).to.be.revertedWith("0x33"); // รหัสข้อผิดพลาดสำหรับยอดคงเหลือกองทุนไม่เพียงพอ
    });

    it("should revert when non-owner tries to batch withdraw", async function () {
      const requests = [{
        recipient: user1.address,
        amount: 1,
        balanceType: 0
      }];

      await expect(
        cryptoMembershipNFT.connect(user1).batchWithdraw(requests)
      ).to.be.reverted; // จะถูกกลับคืนเนื่องจาก Ownable
    });
  })
})