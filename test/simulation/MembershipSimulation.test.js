const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Membership Activity Simulation", function () {
  // ฟังก์ชันสำหรับเตรียม test environment
  async function deploySimulationFixture() {
    const signers = await ethers.getSigners();
    const [owner, ...users] = signers;

    // สร้าง users จำนวน 50 คน
    const memberUsers = users.slice(0, 50);

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
    const initialAmount = ethers.parseUnits("1000", decimals); // ให้เยอะหน่อยสำหรับ upgrade

    // *** ตรวจสอบยอดเงิน owner ก่อนโอน ***
    const ownerBalance = await usdt.balanceOf(owner.address);
    console.log(
      `👤 Owner balance: ${ethers.formatUnits(ownerBalance, decimals)} USDT`
    );

    // *** คำนวณจำนวนเงินที่ต้องการ ***
    const totalNeeded = initialAmount * BigInt(memberUsers.length);
    console.log(
      `💵 Total needed: ${ethers.formatUnits(totalNeeded, decimals)} USDT`
    );

    if (ownerBalance < totalNeeded) {
      throw new Error(
        `Insufficient balance. Owner has ${ethers.formatUnits(
          ownerBalance,
          decimals
        )} USDT, but needs ${ethers.formatUnits(totalNeeded, decimals)} USDT`
      );
    }

    // แจก USDT และอนุมัติให้ทุกคน
    for (const user of memberUsers) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(await nft.getAddress(), initialAmount);
    }

    return { nft, usdt, owner, memberUsers, decimals };
  }

  // ฟังก์ชันสำหรับสุ่มการกระทำ
  // แก้ไข test/simulation/MembershipSimulation.test.js

  // ฟังก์ชันสำหรับเตรียม test environment
  async function deploySimulationFixture() {
    const signers = await ethers.getSigners();
    const [owner, ...users] = signers;

    // สร้าง users จำนวน 50 คน
    const memberUsers = users.slice(0, 50);

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
    const initialAmount = ethers.parseUnits("1000", decimals); // ให้เยอะหน่อยสำหรับ upgrade

    // *** ตรวจสอบยอดเงิน owner ก่อนโอน ***
    const ownerBalance = await usdt.balanceOf(owner.address);
    console.log(
      `👤 Owner balance: ${ethers.formatUnits(ownerBalance, decimals)} USDT`
    );

    // *** คำนวณจำนวนเงินที่ต้องการ ***
    const totalNeeded = initialAmount * BigInt(memberUsers.length);
    console.log(
      `💵 Total needed: ${ethers.formatUnits(totalNeeded, decimals)} USDT`
    );

    if (ownerBalance < totalNeeded) {
      throw new Error(
        `Insufficient balance. Owner has ${ethers.formatUnits(
          ownerBalance,
          decimals
        )} USDT, but needs ${ethers.formatUnits(totalNeeded, decimals)} USDT`
      );
    }

    // แจก USDT และอนุมัติให้ทุกคน
    for (const user of memberUsers) {
      await usdt.transfer(user.address, initialAmount);
      await usdt.connect(user).approve(await nft.getAddress(), initialAmount);
    }

    return { nft, usdt, owner, memberUsers, decimals };
  }

  // ฟังก์ชันสำหรับสุ่มการกระทำ
  class MembershipSimulator {
    constructor(nft, usdt, owner, users, decimals) {
      this.nft = nft;
      this.usdt = usdt;
      this.owner = owner;
      this.users = users;
      this.decimals = decimals; // *** เพิ่ม decimals ***
      this.registeredMembers = new Set();
      this.memberPlans = new Map(); // เก็บแผนปัจจุบันของแต่ละสมาชิก
      this.memberUplines = new Map(); // เก็บ upline ของแต่ละสมาชิก
      this.simulationStats = {
        registrations: 0,
        upgrades: 0,
        exits: 0,
        commissionsPaid: 0,
        cycleCompletions: 0,
        totalRevenue: 0n,
      };
    }

    // สุ่มเลือก user ที่ยังไม่ได้สมัคร
    getRandomUnregisteredUser() {
      const unregistered = this.users.filter(
        (user) => !this.registeredMembers.has(user.address)
      );
      if (unregistered.length === 0) return null;
      return unregistered[Math.floor(Math.random() * unregistered.length)];
    }

    // สุ่มเลือก user ที่สมัครแล้ว
    getRandomRegisteredUser() {
      const registered = Array.from(this.registeredMembers);
      if (registered.length === 0) return null;
      const address = registered[Math.floor(Math.random() * registered.length)];
      return this.users.find((user) => user.address === address);
    }

    // สุ่มเลือก upline จากสมาชิกที่มีอยู่
    getRandomUpline() {
      if (this.registeredMembers.size === 0) return this.owner.address;

      // 30% โอกาสเลือก owner เป็น upline
      if (Math.random() < 0.3) return this.owner.address;

      const members = Array.from(this.registeredMembers);
      const randomAddress = members[Math.floor(Math.random() * members.length)];
      return randomAddress;
    }

    // สุ่มการลงทะเบียนสมาชิกใหม่
    async simulateRegistration() {
      const user = this.getRandomUnregisteredUser();
      if (!user) return false;

      const uplineAddress = this.getRandomUpline();

      try {
        console.log(
          `📝 ${user.address.slice(
            0,
            8
          )}... สมัครสมาชิก Plan 1 (Upline: ${uplineAddress.slice(0, 8)}...)`
        );

        await this.nft.connect(user).registerMember(1, uplineAddress);

        this.registeredMembers.add(user.address);
        this.memberPlans.set(user.address, 1);
        this.memberUplines.set(user.address, uplineAddress);
        this.simulationStats.registrations++;

        // *** แก้ไข: ใช้ parseUnits แทน parseEther ***
        const planPrice = ethers.parseUnits("1", this.decimals);
        this.simulationStats.totalRevenue += planPrice;

        console.log(
          `✅ สมัครสมาชิกสำเร็จ! (สมาชิกทั้งหมด: ${this.registeredMembers.size})`
        );
        return true;
      } catch (error) {
        console.log(`❌ ลงทะเบียนล้มเหลว: ${error.message}`);
        return false;
      }
    }

    // สุ่มการอัพเกรดแผน
    async simulateUpgrade() {
      const user = this.getRandomRegisteredUser();
      if (!user) return false;

      const currentPlan = this.memberPlans.get(user.address);
      if (!currentPlan || currentPlan >= 16) return false; // ไม่สามารถอัพเกรดต่อได้

      const nextPlan = currentPlan + 1;

      try {
        console.log(
          `⬆️ ${user.address.slice(
            0,
            8
          )}... อัพเกรด Plan ${currentPlan} → Plan ${nextPlan}`
        );

        await this.nft.connect(user).upgradePlan(nextPlan);

        this.memberPlans.set(user.address, nextPlan);
        this.simulationStats.upgrades++;

        // *** แก้ไข: ใช้ parseUnits แทน parseEther ***
        const upgradeCost =
          ethers.parseUnits(nextPlan.toString(), this.decimals) -
          ethers.parseUnits(currentPlan.toString(), this.decimals);
        this.simulationStats.totalRevenue += upgradeCost;

        console.log(`✅ อัพเกรดสำเร็จ! (Plan ${nextPlan})`);
        return true;
      } catch (error) {
        console.log(`❌ อัพเกรดล้มเหลว: ${error.message}`);
        return false;
      }
    }

    // สุ่มการออกจากระบบ (หลัง 30 วัน)
    async simulateExit() {
      const user = this.getRandomRegisteredUser();
      if (!user) return false;

      try {
        console.log(`🚪 ${user.address.slice(0, 8)}... พยายามออกจากระบบ`);

        await this.nft.connect(user).exitMembership();

        this.registeredMembers.delete(user.address);
        this.memberPlans.delete(user.address);
        this.memberUplines.delete(user.address);
        this.simulationStats.exits++;

        console.log(
          `✅ ออกจากระบบสำเร็จ! (สมาชิกเหลือ: ${this.registeredMembers.size})`
        );
        return true;
      } catch (error) {
        console.log(
          `❌ ออกจากระบบล้มเหลว: ${error.message} (อาจยังไม่ครบ 30 วัน)`
        );
        return false;
      }
    }

    // สุ่มการกระทำ
    async performRandomAction() {
      // กำหนดความน่าจะเป็นของการกระทำ
      const actions = [
        {
          name: "register",
          weight: 50,
          action: () => this.simulateRegistration(),
        },
        { name: "upgrade", weight: 30, action: () => this.simulateUpgrade() },
        { name: "exit", weight: 5, action: () => this.simulateExit() },
        { name: "wait", weight: 15, action: () => this.simulateWait() },
      ];

      // สุ่มเลือกการกระทำตามน้ำหนัก
      const totalWeight = actions.reduce(
        (sum, action) => sum + action.weight,
        0
      );
      let random = Math.random() * totalWeight;

      for (const action of actions) {
        random -= action.weight;
        if (random <= 0) {
          return await action.action();
        }
      }

      return false;
    }

    // จำลองการรอ (เพื่อให้เวลาผ่าน)
    async simulateWait() {
      const waitTime = Math.floor(Math.random() * 300) + 60; // รอ 1-5 นาที
      console.log(`⏰ รอเวลา ${waitTime} วินาที...`);

      await ethers.provider.send("evm_increaseTime", [waitTime]);
      await ethers.provider.send("evm_mine");

      return true;
    }

    // ดึงสถิติระบบ
    async getSystemStats() {
      try {
        const stats = await this.nft.getSystemStats();
        return stats;
      } catch (error) {
        console.log("ไม่สามารถดึงสถิติระบบได้:", error.message);
        return null;
      }
    }

    // แสดงสถิติการจำลอง
    printSimulationStats() {
      console.log("\n" + "=".repeat(60));
      console.log("📊 สถิติการจำลอง Membership Activity");
      console.log("=".repeat(60));
      console.log(`👥 สมาชิกทั้งหมด: ${this.registeredMembers.size} คน`);
      console.log(
        `📝 การลงทะเบียน: ${this.simulationStats.registrations} ครั้ง`
      );
      console.log(`⬆️ การอัพเกรด: ${this.simulationStats.upgrades} ครั้ง`);
      console.log(`🚪 การออกจากระบบ: ${this.simulationStats.exits} ครั้ง`);
      console.log(
        `💰 รายได้รวม: ${ethers.formatUnits(
          this.simulationStats.totalRevenue,
          this.decimals
        )} USDT`
      );

      // แสดงการกระจายของแผน
      const planDistribution = new Map();
      for (const plan of this.memberPlans.values()) {
        planDistribution.set(plan, (planDistribution.get(plan) || 0) + 1);
      }

      console.log("\n📈 การกระจายของแผน:");
      for (const [plan, count] of planDistribution.entries()) {
        console.log(`   Plan ${plan}: ${count} คน`);
      }
      console.log("=".repeat(60));
    }

    // แสดงสถิติระบบจริง
    async printSystemStats() {
      const stats = await this.getSystemStats();
      if (!stats) return;

      console.log("\n💎 สถิติระบบจาก Smart Contract:");
      console.log(`   Total Members: ${stats[0]}`);
      console.log(
        `   Total Revenue: ${ethers.formatUnits(stats[1], this.decimals)} USDT`
      );
      console.log(
        `   Total Commission: ${ethers.formatUnits(
          stats[2],
          this.decimals
        )} USDT`
      );
      console.log(
        `   Owner Funds: ${ethers.formatUnits(stats[3], this.decimals)} USDT`
      );
      console.log(
        `   Fee Funds: ${ethers.formatUnits(stats[4], this.decimals)} USDT`
      );
      console.log(
        `   Fund Balance: ${ethers.formatUnits(stats[5], this.decimals)} USDT`
      );
    }
  }

  describe("Random Membership Activity Simulation", function () {
    it("Should simulate random member activities over time", async function () {
      this.timeout(300000); // 5 นาที timeout

      const { nft, usdt, owner, memberUsers } = await loadFixture(
        deploySimulationFixture
      );
      const simulator = new MembershipSimulator(nft, usdt, owner, memberUsers);

      console.log("\n🚀 เริ่มจำลองกิจกรรมสมาชิก...\n");

      const totalActions = 100; // จำนวนการกระทำทั้งหมด
      let successfulActions = 0;

      for (let i = 0; i < totalActions; i++) {
        console.log(`\n--- การกระทำที่ ${i + 1}/${totalActions} ---`);

        const success = await simulator.performRandomAction();
        if (success) successfulActions++;

        // แสดงสถิติทุกๆ 20 การกระทำ
        if ((i + 1) % 20 === 0) {
          simulator.printSimulationStats();
          await simulator.printSystemStats();
        }
      }

      // แสดงสถิติสุดท้าย
      console.log("\n🎯 ผลการจำลองสุดท้าย");
      simulator.printSimulationStats();
      await simulator.printSystemStats();

      console.log(
        `\n✨ การกระทำที่สำเร็จ: ${successfulActions}/${totalActions} (${(
          (successfulActions / totalActions) *
          100
        ).toFixed(1)}%)`
      );

      // ตรวจสอบว่ามีสมาชิกอย่างน้อย 10 คน
      expect(simulator.registeredMembers.size).to.be.at.least(10);
    });

    it("Should simulate member upgrade chain scenario", async function () {
      this.timeout(180000); // 3 นาที timeout

      const { nft, usdt, owner, memberUsers } = await loadFixture(
        deploySimulationFixture
      );
      const simulator = new MembershipSimulator(nft, usdt, owner, memberUsers);

      console.log("\n🔗 จำลองสถานการณ์ Upgrade Chain...\n");

      // สร้าง upgrade chain: user1 → user2 → user3 → user4
      const chainUsers = memberUsers.slice(0, 4);

      // ลงทะเบียนทีละคน
      for (let i = 0; i < chainUsers.length; i++) {
        const user = chainUsers[i];
        const upline = i === 0 ? owner.address : chainUsers[i - 1].address;

        await simulator.nft.connect(user).registerMember(1, upline);
        simulator.registeredMembers.add(user.address);
        simulator.memberPlans.set(user.address, 1);

        console.log(
          `📝 ${user.address.slice(0, 8)}... ลงทะเบียน (Upline: ${upline.slice(
            0,
            8
          )}...)`
        );

        // รอเวลาเพื่อป้องกัน TooSoon error
        await ethers.provider.send("evm_increaseTime", [70]);
        await ethers.provider.send("evm_mine");
      }

      // ทำการอัพเกรดแบบสุ่ม
      for (let round = 0; round < 20; round++) {
        console.log(`\n--- รอบอัพเกรด ${round + 1} ---`);

        // รอเวลาสำหรับ upgrade cooldown
        await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 60]); // 1 วัน + 1 นาที
        await ethers.provider.send("evm_mine");

        // สุ่มเลือกคนอัพเกรด
        const userToUpgrade =
          chainUsers[Math.floor(Math.random() * chainUsers.length)];
        const currentPlan =
          simulator.memberPlans.get(userToUpgrade.address) || 1;

        if (currentPlan < 16) {
          try {
            await simulator.nft
              .connect(userToUpgrade)
              .upgradePlan(currentPlan + 1);
            simulator.memberPlans.set(userToUpgrade.address, currentPlan + 1);

            console.log(
              `⬆️ ${userToUpgrade.address.slice(
                0,
                8
              )}... อัพเกรด Plan ${currentPlan} → Plan ${currentPlan + 1}`
            );
          } catch (error) {
            console.log(`❌ อัพเกรดล้มเหลว: ${error.message}`);
          }
        }
      }

      // แสดงผลลัพธ์ chain
      console.log("\n🏆 ผลลัพธ์ Upgrade Chain:");
      for (let i = 0; i < chainUsers.length; i++) {
        const user = chainUsers[i];
        const plan = simulator.memberPlans.get(user.address);
        const member = await simulator.nft.members(user.address);

        console.log(
          `   User ${i + 1}: Plan ${plan}, Total Referrals: ${
            member.totalReferrals
          }, Total Earnings: ${ethers.formatEther(member.totalEarnings)} USDT`
        );
      }

      await simulator.printSystemStats();
    });

    it("Should simulate cycle completion scenarios", async function () {
      this.timeout(240000); // 4 นาที timeout

      const { nft, usdt, owner, memberUsers } = await loadFixture(
        deploySimulationFixture
      );

      console.log("\n🔄 จำลองการครบรอบ (Cycle Completion)...\n");

      // ลงทะเบียนสมาชิกจำนวนมากเพื่อให้ครบรอบ
      const batchSize = 8; // ทำให้เกิน 1 รอบ (4 คน/รอบ)

      for (let i = 0; i < batchSize; i++) {
        const user = memberUsers[i];
        const upline = i === 0 ? owner.address : memberUsers[i - 1].address;

        console.log(
          `📝 สมาชิกที่ ${i + 1}: ${user.address.slice(
            0,
            8
          )}... (Upline: ${upline.slice(0, 8)}...)`
        );

        const tx = await nft.connect(user).registerMember(1, upline);
        const receipt = await tx.wait();

        // ตรวจสอบว่ามี NewCycleStarted event หรือไม่
        const newCycleEvent = receipt.logs.find((log) => {
          try {
            const parsed = nft.interface.parseLog(log);
            return parsed.name === "NewCycleStarted";
          } catch {
            return false;
          }
        });

        if (newCycleEvent) {
          const parsed = nft.interface.parseLog(newCycleEvent);
          console.log(
            `🔄 รอบใหม่เริ่มขึ้น! Plan ${parsed.args[0]}, Cycle ${parsed.args[1]}`
          );
        }

        // ตรวจสอบสถานะรอบ
        const cycleInfo = await nft.getPlanCycleInfo(1);
        console.log(
          `   └─ รอบปัจจุบัน: ${cycleInfo[0]}, สมาชิกในรอบ: ${cycleInfo[1]}/4`
        );

        // รอเวลาเพื่อป้องกัน TooSoon error
        if (i < batchSize - 1) {
          await ethers.provider.send("evm_increaseTime", [70]);
          await ethers.provider.send("evm_mine");
        }
      }

      // แสดงสถิติรอบสุดท้าย
      const finalCycleInfo = await nft.getPlanCycleInfo(1);
      console.log(`\n🎯 สถิติรอบสุดท้าย:`);
      console.log(`   รอบปัจจุบัน: ${finalCycleInfo[0]}`);
      console.log(`   สมาชิกในรอบปัจจุบัน: ${finalCycleInfo[1]}/4`);
      console.log(`   สมาชิกทั้งหมด: ${await nft.totalSupply()}`);

      // ตรวจสอบว่ามีการเริ่มรอบใหม่แล้ว
      expect(finalCycleInfo[0]).to.be.gt(1n); // ควรมีรอบที่ 2 ขึ้นไป
    });

    it("Should simulate mixed activity with time progression", async function () {
      this.timeout(360000); // 6 นาที timeout

      const { nft, usdt, owner, memberUsers } = await loadFixture(
        deploySimulationFixture
      );
      const simulator = new MembershipSimulator(nft, usdt, owner, memberUsers);

      console.log("\n🎭 จำลองกิจกรรมผสมผสานตามเวลา...\n");

      // จำลอง 30 วันของกิจกรรม
      const totalDays = 30;
      const actionsPerDay = 5;

      for (let day = 1; day <= totalDays; day++) {
        console.log(`\n📅 วันที่ ${day}/${totalDays}`);

        // ทำกิจกรรมหลายอย่างในแต่ละวัน
        for (let action = 0; action < actionsPerDay; action++) {
          await simulator.performRandomAction();

          // รอเวลาระหว่างการกระทำ
          await ethers.provider.send("evm_increaseTime", [
            Math.floor(Math.random() * 3600) + 1800,
          ]); // 30 นาที - 1.5 ชั่วโมง
          await ethers.provider.send("evm_mine");
        }

        // ข้ามไปวันถัดไป
        await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // 1 วัน
        await ethers.provider.send("evm_mine");

        // แสดงสถิติทุกๆ 10 วัน
        if (day % 10 === 0) {
          simulator.printSimulationStats();
        }

        // ลองให้บางคนออกจากระบบหลังจาก 30 วัน
        if (day === 30) {
          console.log("\n🚪 ลองให้สมาชิกออกจากระบบหลัง 30 วัน...");
          for (let i = 0; i < 3; i++) {
            await simulator.simulateExit();
          }
        }
      }

      // สรุปผลสุดท้าย
      console.log("\n🏁 สรุปผลการจำลอง 30 วัน");
      simulator.printSimulationStats();
      await simulator.printSystemStats();

      // ตรวจสอบว่าระบบยังคงทำงานได้ปกติ
      expect(simulator.registeredMembers.size).to.be.gt(0);
    });
  });
});
