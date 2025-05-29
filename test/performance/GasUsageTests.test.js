// test/performance/GasUsageTests.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Gas Usage Optimization", function () {
  // สร้างฟังก์ชัน deployWithMembersFixture ที่สมบูรณ์
  async function deployWithMembersFixture() {
    const [owner, ...signers] = await ethers.getSigners();
    const users = signers.slice(0, 5); // เตรียมผู้ใช้ 5 คนสำหรับการทดสอบ
    
    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const usdt = await FakeUSDT.deploy();
    
    // Deploy CryptoMembershipNFT
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    const nft = await CryptoMembershipNFT.deploy(await usdt.getAddress(), owner.address);
    
    // จำลองเงินสำหรับทดสอบ
    const initialAmount = ethers.parseEther("100");
    
    // แจกจ่าย USDT ให้ผู้ใช้ทุกคนและอนุมัติให้ contract ใช้
    for (const user of users) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(await nft.getAddress(), initialAmount);
    }
    
    // ลงทะเบียนผู้ใช้ 3 คนเพื่อสร้างยอดเงินในระบบทั้ง 3 ประเภท (owner, fee, fund)
    for (let i = 0; i < 3; i++) {
      const upline = i === 0 ? owner.address : users[i-1].address;
      
      // รอเวลาระหว่างการลงทะเบียนเพื่อหลีกเลี่ยง TooSoon error
      if (i > 0) {
        await ethers.provider.send("evm_increaseTime", [60]);
        await ethers.provider.send("evm_mine");
      }
      
      await nft.connect(users[i]).registerMember(1, upline);
    }
    
    return { nft, usdt, owner, users };
  }
  
  it("Should optimize gas usage for batch operations", async function() {
    // เพิ่ม timeout เพื่อให้มีเวลาเพียงพอในการทดสอบ
    this.timeout(60000);
    
    const { nft, usdt, owner, users } = await loadFixture(deployWithMembersFixture);
    
    // ดึงข้อมูลยอดเงินในระบบเพื่อทำการถอน
    const systemStats = await nft.getSystemStats();
    const ownerBalance = systemStats[3]; // ownerFunds
    const feeBalance = systemStats[4]; // feeFunds
    const fundBalance = systemStats[5]; // fundFunds
    
    console.log(`ยอดเงิน Owner: ${ethers.formatEther(ownerBalance)} USDT`);
    console.log(`ยอดเงิน Fee: ${ethers.formatEther(feeBalance)} USDT`);
    console.log(`ยอดเงิน Fund: ${ethers.formatEther(fundBalance)} USDT`);
    
    // ตรวจสอบว่ามียอดเงินสำหรับทดสอบหรือไม่
    expect(ownerBalance).to.be.gt(0, "ยอดเงิน Owner ควรมากกว่า 0");
    expect(feeBalance).to.be.gt(0, "ยอดเงิน Fee ควรมากกว่า 0");
    expect(fundBalance).to.be.gt(0, "ยอดเงิน Fund ควรมากกว่า 0");
    
    // สร้าง withdrawal requests สำหรับ batch withdrawal
    const withdrawalRequests = [
      {
        recipient: owner.address,
        amount: ownerBalance / 2n,
        balanceType: 0 // owner
      },
      {
        recipient: users[0].address,
        amount: feeBalance / 2n,
        balanceType: 1 // fee
      },
      {
        recipient: users[1].address,
        amount: fundBalance / 2n,
        balanceType: 2 // fund
      }
    ];
    
    // วัดการใช้ gas สำหรับการถอนแบบกลุ่ม
    const batchTx = await nft.connect(owner).batchWithdraw(withdrawalRequests);
    const batchReceipt = await batchTx.wait();
    const batchGasUsed = batchReceipt.gasUsed;
    
    console.log(`การใช้ Gas สำหรับการถอนแบบกลุ่ม: ${batchGasUsed.toString()}`);
    
    // Deploy ใหม่เพื่อทดสอบแบบแยก transaction
    const { nft: nft2, usdt: usdt2, owner: owner2, users: users2 } = await loadFixture(deployWithMembersFixture);
    
    // ดึงข้อมูลยอดเงินในระบบใหม่
    const systemStats2 = await nft2.getSystemStats();
    const ownerBalance2 = systemStats2[3]; // ownerFunds
    const feeBalance2 = systemStats2[4]; // feeFunds
    const fundBalance2 = systemStats2[5]; // fundFunds
    
    // วัดการใช้ gas สำหรับการถอนแบบแยก transaction
    let individualGasUsed = 0n;
    
    // ถอนยอด Owner
    const tx1 = await nft2.connect(owner2).withdrawOwnerBalance(ownerBalance2 / 2n);
    const receipt1 = await tx1.wait();
    individualGasUsed += receipt1.gasUsed;
    
    // ถอนยอด Fee
    const tx2 = await nft2.connect(owner2).withdrawFeeSystemBalance(feeBalance2 / 2n);
    const receipt2 = await tx2.wait();
    individualGasUsed += receipt2.gasUsed;
    
    // ถอนยอด Fund
    const tx3 = await nft2.connect(owner2).withdrawFundBalance(fundBalance2 / 2n);
    const receipt3 = await tx3.wait();
    individualGasUsed += receipt3.gasUsed;
    
    console.log(`การใช้ Gas รวมสำหรับการถอนแบบแยก transaction: ${individualGasUsed.toString()}`);
    
    // เปรียบเทียบการใช้ gas
    console.log(`ประหยัด Gas: ${individualGasUsed - batchGasUsed} หน่วย (${((Number(individualGasUsed - batchGasUsed) / Number(individualGasUsed)) * 100).toFixed(2)}%)`);
    
    // ตรวจสอบว่าการถอนแบบกลุ่มใช้ gas น้อยกว่า
    expect(batchGasUsed).to.be.lt(individualGasUsed, "การถอนแบบกลุ่มควรใช้ Gas น้อยกว่าการถอนแบบแยก transaction");
  });
});