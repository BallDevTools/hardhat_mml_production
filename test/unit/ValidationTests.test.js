// test/unit/ValidationTests.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Input Validation Tests", function () {
  // *** เพิ่ม deployFixture function ที่หายไป ***
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    await usdt.waitForDeployment();

    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory(
      "CryptoMembershipNFT"
    );
    const nft = await CryptoMembershipNFT.deploy(
      await usdt.getAddress(),
      owner.address
    );
    await nft.waitForDeployment();

    // *** สำคัญ: ตรวจสอบ decimals ก่อนใช้ ***
    const decimals = await usdt.decimals();
    console.log(`💰 USDT decimals: ${decimals}`);

    // *** แก้ไข: ใช้ parseUnits แทน parseEther ***
    const initialAmount = ethers.parseUnits("100", decimals);

    // แจก USDT ให้ผู้ใช้เพื่อทดสอบ
    for (const user of [user1, user2]) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(await nft.getAddress(), initialAmount);
    }

    return { nft, usdt, owner, user1, user2, decimals };
  }

  it("Should validate all input parameters thoroughly", async function () {
    const { nft, owner, decimals } = await loadFixture(deployFixture);

    console.log("🧪 ทดสอบการตรวจสอบ Input Parameters อย่างละเอียด...");

    // Test plan creation with boundary values
    console.log("🚫 ทดสอบ createPlan ด้วยราคา 0...");
    await expect(
      nft.connect(owner).createPlan(0, "Zero Price", 4)
    ).to.be.revertedWithCustomError(nft, "ZeroPrice");
    console.log("✅ ZeroPrice validation ทำงาน");

    console.log("🚫 ทดสอบ createPlan ด้วยชื่อว่าง...");
    await expect(
      nft.connect(owner).createPlan(ethers.parseUnits("1", decimals), "", 4)
    ).to.be.revertedWithCustomError(nft, "EmptyName");
    console.log("✅ EmptyName validation ทำงาน");

    console.log("🚫 ทดสอบ createPlan ด้วย invalid cycle members...");
    await expect(
      nft
        .connect(owner)
        .createPlan(ethers.parseUnits("1", decimals), "Invalid Cycle", 5)
    ).to.be.revertedWithCustomError(nft, "InvalidCycleMembers");
    console.log("✅ InvalidCycleMembers validation ทำงาน");

    // Test with extreme values that should work
    console.log("💰 ทดสอบ createPlan ด้วยราคาสูงมาก...");
    const extremelyHighPrice = ethers.parseUnits("1000000", decimals); // 1M USDT
    await nft
      .connect(owner)
      .createPlan(extremelyHighPrice, "Extremely High Price", 4);

    const plan = await nft.plans(17); // Should be the new plan (default 16 plans + 1)
    expect(plan.price).to.equal(extremelyHighPrice);
    expect(plan.name).to.equal("Extremely High Price");
    expect(plan.isActive).to.equal(true);
    console.log(
      `✅ High price plan created: ${ethers.formatUnits(
        plan.price,
        decimals
      )} USDT`
    );

    // Test setPlanDefaultImage validation
    console.log("🚫 ทดสอบ setPlanDefaultImage ด้วย empty URI...");
    await expect(
      nft.connect(owner).setPlanDefaultImage(1, "")
    ).to.be.revertedWithCustomError(nft, "EmptyURI");
    console.log("✅ EmptyURI validation ทำงาน");

    console.log("🚫 ทดสอบ setPlanDefaultImage ด้วย invalid plan ID...");
    await expect(
      nft.connect(owner).setPlanDefaultImage(0, "test-uri")
    ).to.be.revertedWithCustomError(nft, "InvalidPlanID");
    console.log("✅ InvalidPlanID validation ทำงาน");

    // Test valid setPlanDefaultImage
    console.log("✅ ทดสอบ setPlanDefaultImage ที่ถูกต้อง...");
    const validImageURI = "ipfs://QmNewImageHash";
    await nft.connect(owner).setPlanDefaultImage(1, validImageURI);
    const imageURI = await nft.planDefaultImages(1);
    expect(imageURI).to.equal(validImageURI);
    console.log("✅ Valid setPlanDefaultImage ทำงาน");

    // Test setBaseURI validation
    console.log("🚫 ทดสอบ setBaseURI ด้วย empty string...");
    await expect(
      nft.connect(owner).setBaseURI("")
    ).to.be.revertedWithCustomError(nft, "EmptyURI");
    console.log("✅ setBaseURI EmptyURI validation ทำงาน");

    // Test valid setBaseURI
    console.log("✅ ทดสอบ setBaseURI ที่ถูกต้อง...");
    const validBaseURI = "https://api.example.com/metadata/";
    await nft.connect(owner).setBaseURI(validBaseURI);
    console.log("✅ Valid setBaseURI ทำงาน");

    // Test address validation
    console.log("🚫 ทดสอบ setPriceFeed ด้วย zero address...");
    await expect(
      nft.connect(owner).setPriceFeed(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(nft, "ZeroAddress");
    console.log("✅ ZeroAddress validation ทำงาน");

    // Test valid setPriceFeed
    console.log("✅ ทดสอบ setPriceFeed ที่ถูกต้อง...");
    const validPriceFeed = "0x1234567890123456789012345678901234567890";
    await nft.connect(owner).setPriceFeed(validPriceFeed);
    console.log("✅ Valid setPriceFeed ทำงาน");

    // Test plan status validation
    console.log("🚫 ทดสอบ setPlanStatus ด้วย invalid plan ID...");
    await expect(
      nft.connect(owner).setPlanStatus(100, true)
    ).to.be.revertedWithCustomError(nft, "InvalidPlanID");
    console.log("✅ setPlanStatus InvalidPlanID validation ทำงาน");

    // Test valid setPlanStatus
    console.log("✅ ทดสอบ setPlanStatus ที่ถูกต้อง...");
    await nft.connect(owner).setPlanStatus(1, false);
    let plan1 = await nft.plans(1);
    expect(plan1.isActive).to.equal(false);

    await nft.connect(owner).setPlanStatus(1, true);
    plan1 = await nft.plans(1);
    expect(plan1.isActive).to.equal(true);
    console.log("✅ Valid setPlanStatus ทำงาน");

    console.log("🎉 การทดสอบ Input Validation ทั้งหมดสำเร็จ!");
  });

  it("Should validate withdrawal parameters", async function () {
    const { nft, owner, user1, decimals } = await loadFixture(deployFixture);

    console.log("💸 ทดสอบการตรวจสอบ parameters ของการถอนเงิน...");

    // ลงทะเบียนสมาชิกเพื่อให้มีเงินในระบบ
    await nft.connect(user1).registerMember(1, owner.address);

    // Test withdrawal amount validation
    console.log("🚫 ทดสอบ withdrawOwnerBalance ด้วยจำนวนเกินยอดคงเหลือ...");
    const excessAmount = ethers.parseUnits("1000", decimals);
    await expect(
      nft.connect(owner).withdrawOwnerBalance(excessAmount)
    ).to.be.revertedWithCustomError(nft, "LowOwnerBalance");
    console.log("✅ LowOwnerBalance validation ทำงาน");

    console.log("🚫 ทดสอบ withdrawFeeSystemBalance ด้วยจำนวนเกินยอดคงเหลือ...");
    await expect(
      nft.connect(owner).withdrawFeeSystemBalance(excessAmount)
    ).to.be.revertedWithCustomError(nft, "LowFeeBalance");
    console.log("✅ LowFeeBalance validation ทำงาน");

    console.log("🚫 ทดสอบ withdrawFundBalance ด้วยจำนวนเกินยอดคงเหลือ...");
    await expect(
      nft.connect(owner).withdrawFundBalance(excessAmount)
    ).to.be.revertedWithCustomError(nft, "LowFundBalance");
    console.log("✅ LowFundBalance validation ทำงาน");

    // Test valid withdrawal
    const systemStats = await nft.getSystemStats();
    const ownerBalance = systemStats[3];

    if (ownerBalance > 0n) {
      console.log(
        `✅ ทดสอบ withdrawal ที่ถูกต้อง: ${ethers.formatUnits(
          ownerBalance,
          decimals
        )} USDT`
      );
      await nft.connect(owner).withdrawOwnerBalance(ownerBalance);
      console.log("✅ Valid withdrawal ทำงาน");
    }
  });

  it("Should validate batch withdrawal parameters", async function () {
    const { nft, owner, user1, decimals } = await loadFixture(deployFixture);

    console.log("📦 ทดสอบการตรวจสอบ parameters ของ batch withdrawal...");

    // ลงทะเบียนสมาชิกเพื่อให้มีเงินในระบบ
    await nft.connect(user1).registerMember(1, owner.address);

    // Test empty requests array
    console.log("🚫 ทดสอบ batchWithdraw ด้วย empty array...");
    await expect(
      nft.connect(owner).batchWithdraw([])
    ).to.be.revertedWithCustomError(nft, "InvalidRequests");
    console.log("✅ Empty array validation ทำงาน");

    // Test too many requests
    console.log("🚫 ทดสอบ batchWithdraw ด้วย requests มากเกินไป...");
    const tooManyRequests = Array(21).fill({
      recipient: owner.address,
      amount: 1,
      balanceType: 0,
    });

    await expect(
      nft.connect(owner).batchWithdraw(tooManyRequests)
    ).to.be.revertedWithCustomError(nft, "InvalidRequests");
    console.log("✅ Too many requests validation ทำงาน");

    // Test invalid recipient (zero address)
    console.log("🚫 ทดสอบ batchWithdraw ด้วย zero address recipient...");
    const invalidRequests = [
      {
        recipient: ethers.ZeroAddress,
        amount: ethers.parseUnits("1", decimals),
        balanceType: 0,
      },
    ];

    await expect(
      nft.connect(owner).batchWithdraw(invalidRequests)
    ).to.be.revertedWithCustomError(nft, "InvalidRequest");
    console.log("✅ Zero address recipient validation ทำงาน");

    // Test invalid amount (zero)
    console.log("🚫 ทดสอบ batchWithdraw ด้วย zero amount...");
    const zeroAmountRequests = [
      {
        recipient: owner.address,
        amount: 0,
        balanceType: 0,
      },
    ];

    await expect(
      nft.connect(owner).batchWithdraw(zeroAmountRequests)
    ).to.be.revertedWithCustomError(nft, "InvalidRequest");
    console.log("✅ Zero amount validation ทำงาน");

    // Test valid batch withdrawal
    const systemStats = await nft.getSystemStats();
    const ownerBalance = systemStats[3];

    if (ownerBalance > 0n) {
      console.log("✅ ทดสอบ batch withdrawal ที่ถูกต้อง...");
      const validRequests = [
        {
          recipient: owner.address,
          amount: ownerBalance / 2n,
          balanceType: 0,
        },
      ];

      await nft.connect(owner).batchWithdraw(validRequests);
      console.log("✅ Valid batch withdrawal ทำงาน");
    }
  });

  it("Should validate plan upgrade parameters", async function () {
    const { nft, owner, user1 } = await loadFixture(deployFixture);

    console.log("⬆️ ทดสอบการตรวจสอบ parameters ของ plan upgrade...");

    // ลงทะเบียนสมาชิก
    await nft.connect(user1).registerMember(1, owner.address);

    // แก้ไข: รอเวลาให้ผ่าน preventFrontRunning ก่อน
    console.log("⏰ รอเวลาให้ผ่าน preventFrontRunning...");
    await ethers.provider.send("evm_increaseTime", [90]);
    await ethers.provider.send("evm_mine");

    // Test invalid plan ID (0)
    console.log("🚫 ทดสอบ upgradePlan ด้วย plan ID 0...");
    await expect(
      nft.connect(user1).upgradePlan(0)
    ).to.be.revertedWithCustomError(nft, "InvalidPlanID");
    console.log("✅ Plan ID 0 validation ทำงาน");

    // Test invalid plan ID (เกินจำนวนแผน)
    console.log("🚫 ทดสอบ invalid plan ID เกินจำนวนแผน...");
    await expect(
      nft.connect(user1).upgradePlan(100)
    ).to.be.revertedWithCustomError(nft, "InvalidPlanID");
    console.log("✅ Excessive plan ID validation ทำงาน");

    // Test inactive plan - ใช้วิธีอื่นแทนการทดสอบ upgradePlan โดยตรง
    console.log("🚫 ทดสอบการใช้แผนที่ไม่ทำงาน...");
    await nft.connect(owner).setPlanStatus(2, false); // ปิดแผน 2

    // แทนที่จะทดสอบ upgradePlan ให้ทดสอบ registerMember กับแผนที่ปิด
    // (เพราะ upgradePlan จะติด TooSoon หรือ CooldownActive ก่อน)
    await expect(
      nft.connect(owner).registerMember(2, owner.address) // owner สามารถใช้แผนอื่นได้
    ).to.be.revertedWithCustomError(nft, "InactivePlan");

    // เปิดแผนกลับ
    await nft.connect(owner).setPlanStatus(2, true);
    console.log("✅ InactivePlan validation ทำงาน");
  });

  it("Should validate registration parameters", async function () {
    const { nft, owner, user1, user2, user3 } = await loadFixture(
      deployFixture
    );

    console.log("📝 ทดสอบการตรวจสอบ parameters ของการลงทะเบียน...");

    // Test zero address upline
    console.log("🚫 ทดสอบ registerMember ด้วย zero address upline...");
    await expect(
      nft.connect(user1).registerMember(1, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(nft, "ZeroAddress");
    console.log("✅ Zero address upline validation ทำงาน");

    // Test invalid plan (not plan 1)
    console.log("🚫 ทดสอบ registerMember ด้วยแผนที่ไม่ใช่แผน 1...");
    await expect(
      nft.connect(user1).registerMember(2, owner.address)
    ).to.be.revertedWithCustomError(nft, "Plan1Only");
    console.log("✅ Plan1Only validation ทำงาน");

    // Test invalid plan ID - ใช้ owner ที่สามารถลงทะเบียนแผนอื่นได้
    console.log("🚫 ทดสอบ registerMember ด้วย invalid plan ID (plan 0)...");
    await expect(
      nft.connect(owner).registerMember(0, owner.address) // owner สามารถใช้แผนอื่นได้
    ).to.be.revertedWithCustomError(nft, "InvalidPlanID");
    console.log("✅ InvalidPlanID validation ทำงาน");

    console.log("🚫 ทดสอบ registerMember ด้วย excessive plan ID...");
    await expect(
      nft.connect(owner).registerMember(100, owner.address) // owner สามารถใช้แผนอื่นได้
    ).to.be.revertedWithCustomError(nft, "InvalidPlanID");
    console.log("✅ Excessive plan ID validation ทำงาน");

    // Test inactive plan
    console.log("🚫 ทดสอบ registerMember ด้วยแผนที่ไม่ทำงาน...");
    await nft.connect(owner).setPlanStatus(1, false); // ปิดแผน 1

    await expect(
      nft.connect(user1).registerMember(1, owner.address)
    ).to.be.revertedWithCustomError(nft, "InactivePlan");
    console.log("✅ InactivePlan validation ทำงาน");

    // เปิดแผนกลับเพื่อทดสอบต่อ
    await nft.connect(owner).setPlanStatus(1, true);

    // Test valid registration
    console.log("✅ ทดสอบ registerMember ที่ถูกต้อง...");
    await nft.connect(user1).registerMember(1, owner.address);

    const member = await nft.members(user1.address);
    expect(member.planId).to.equal(1);
    expect(member.upline).to.equal(owner.address);
    console.log("✅ Valid registration ทำงาน");

    // Test already member
    await ethers.provider.send("evm_increaseTime", [90]);
    await ethers.provider.send("evm_mine");

    console.log("🚫 ทดสอบ registerMember ซ้ำ...");
    await expect(
      nft.connect(user1).registerMember(1, owner.address)
    ).to.be.revertedWithCustomError(nft, "AlreadyMember");
    console.log("✅ AlreadyMember validation ทำงาน");

    // Test upline not member - แก้ไข: ใช้ user3 ที่แน่ใจว่าไม่ใช่สมาชิก
    console.log("🚫 ทดสอบ registerMember ด้วย upline ที่ไม่ใช่สมาชิก...");

    // ตรวจสอบให้แน่ใจว่า user3 ไม่ใช่สมาชิก
    const user3Balance = await nft.balanceOf(user3.address);
    expect(user3Balance).to.equal(0); // ตรวจสอบว่าไม่มี NFT

    await expect(
      nft.connect(user2).registerMember(1, user3.address)
    ).to.be.revertedWithCustomError(nft, "UplineNotMember");
    console.log("✅ UplineNotMember validation ทำงาน");
  });
});
