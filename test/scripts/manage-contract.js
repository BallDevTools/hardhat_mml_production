// scripts/manage-contract.js
const hre = require("hardhat");
const fs = require('fs');

async function main() {
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const [owner] = await hre.ethers.getSigners();
  
  console.log("Contract Management Script");
  console.log("Owner:", owner.address);
  
  // เชื่อมต่อกับ contracts
  const FakeUSDT = await hre.ethers.getContractFactory("FakeUSDT");
  const usdt = FakeUSDT.attach(deploymentInfo.usdtAddress);
  
  const CryptoMembershipNFT = await hre.ethers.getContractFactory("CryptoMembershipNFT");
  const nft = CryptoMembershipNFT.attach(deploymentInfo.nftAddress);
  
  // เมนูการจัดการ
  const action = process.argv[2];
  
  switch (action) {
    case 'info':
      await showContractInfo(usdt, nft);
      break;
      
    case 'create-plan':
      await createNewPlan(nft);
      break;
      
    case 'pause':
      await pauseContract(nft);
      break;
      
    case 'unpause':
      await unpauseContract(nft);
      break;
      
    case 'transfer-usdt':
      await transferUSDT(usdt);
      break;
      
    case 'withdraw':
      await withdrawFunds(nft);
      break;
      
    default:
      console.log("Available commands:");
      console.log("  npm run manage info          - Show contract information");
      console.log("  npm run manage create-plan   - Create new membership plan");
      console.log("  npm run manage pause         - Pause contract");
      console.log("  npm run manage unpause       - Unpause contract");
      console.log("  npm run manage transfer-usdt - Transfer USDT to test address");
      console.log("  npm run manage withdraw      - Withdraw owner funds");
  }
}

async function showContractInfo(usdt, nft) {
  console.log("\n=== Contract Information ===");
  
  // USDT Info
  const usdtBalance = await usdt.balanceOf(await hre.ethers.getSigners().then(s => s[0].address));
  console.log(`Owner USDT Balance: ${hre.ethers.formatEther(usdtBalance)} USDT`);
  
  // NFT Contract Info
  const contractStatus = await nft.getContractStatus();
  const systemStats = await nft.getSystemStats();
  
  console.log(`Contract Paused: ${contractStatus[0]}`);
  console.log(`Total Balance: ${hre.ethers.formatEther(contractStatus[1])} USDT`);
  console.log(`Member Count: ${contractStatus[2]}`);
  console.log(`Total Revenue: ${hre.ethers.formatEther(systemStats[1])} USDT`);
  console.log(`Owner Funds: ${hre.ethers.formatEther(systemStats[3])} USDT`);
  console.log(`Fee Funds: ${hre.ethers.formatEther(systemStats[4])} USDT`);
  console.log(`Fund Balance: ${hre.ethers.formatEther(systemStats[5])} USDT`);
}

async function createNewPlan(nft) {
  console.log("\n=== Creating New Plan ===");
  
  const planPrice = hre.ethers.parseEther("20"); // 20 USDT
  const planName = "Premium Plan";
  const membersPerCycle = 4;
  
  try {
    const tx = await nft.createPlan(planPrice, planName, membersPerCycle);
    await tx.wait();
    
    console.log("✅ New plan created successfully!");
    console.log(`Price: ${hre.ethers.formatEther(planPrice)} USDT`);
    console.log(`Name: ${planName}`);
    console.log(`Members per Cycle: ${membersPerCycle}`);
    
  } catch (error) {
    console.error("❌ Failed to create plan:", error.message);
  }
}

async function pauseContract(nft) {
  try {
    const tx = await nft.setPaused(true);
    await tx.wait();
    console.log("✅ Contract paused successfully!");
  } catch (error) {
    console.error("❌ Failed to pause contract:", error.message);
  }
}

async function unpauseContract(nft) {
  try {
    const tx = await nft.restartAfterPause();
    await tx.wait();
    console.log("✅ Contract unpaused successfully!");
  } catch (error) {
    console.error("❌ Failed to unpause contract:", error.message);
  }
}

async function transferUSDT(usdt) {
  const testAddress = "0x742d35Cc6636C0532925a3b2c5C9F86CE7Ab8EdF"; // ใส่ address ที่ต้องการทดสอบ
  const amount = hre.ethers.parseEther("100"); // 100 USDT
  
  try {
    const tx = await usdt.transfer(testAddress, amount);
    await tx.wait();
    
    console.log(`✅ Transferred ${hre.ethers.formatEther(amount)} USDT to ${testAddress}`);
  } catch (error) {
    console.error("❌ Failed to transfer USDT:", error.message);
  }
}

async function withdrawFunds(nft) {
  try {
    const systemStats = await nft.getSystemStats();
    const ownerFunds = systemStats[3];
    
    if (ownerFunds > 0) {
      const tx = await nft.withdrawOwnerBalance(ownerFunds);
      await tx.wait();
      
      console.log(`✅ Withdrew ${hre.ethers.formatEther(ownerFunds)} USDT from owner funds`);
    } else {
      console.log("No owner funds to withdraw");
    }
  } catch (error) {
    console.error("❌ Failed to withdraw funds:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});