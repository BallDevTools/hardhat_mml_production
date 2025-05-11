const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  
  // Load deployment data
  const deploymentPath = path.join(__dirname, "../deployments", `${networkName}.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found. Please deploy the contracts first.");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
  
  // Load USDT contract
  const usdtAddress = deploymentData.fakeUSDT;
  const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
  const fakeUSDT = await FakeUSDT.attach(usdtAddress);
  
  // Load CryptoMembershipNFT contract
  const nftAddress = deploymentData.cryptoMembershipNFT;
  const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
  const cryptoMembershipNFT = await CryptoMembershipNFT.attach(nftAddress);
  
  // Check contract status
  const status = await cryptoMembershipNFT.getContractStatus();
  console.log("Contract Status:");
  console.log("  Paused:", status[0]);
  console.log("  Total Balance:", ethers.formatEther(status[1]), "USDT");
  console.log("  Member Count:", status[2].toString());
  console.log("  Current Plan Count:", status[3].toString());
  
  // Check system stats
  const stats = await cryptoMembershipNFT.getSystemStats();
  console.log("\nSystem Stats:");
  console.log("  Total Members:", stats[0].toString());
  console.log("  Total Revenue:", ethers.formatEther(stats[1]), "USDT");
  console.log("  Total Commission Paid:", ethers.formatEther(stats[2]), "USDT");
  console.log("  Owner Funds:", ethers.formatEther(stats[3]), "USDT");
  console.log("  Fee Funds:", ethers.formatEther(stats[4]), "USDT");
  console.log("  Fund Funds:", ethers.formatEther(stats[5]), "USDT");
  
  // Get plan details
  console.log("\nPlan Details:");
  for (let i = 1; i <= 16; i++) {
    const plan = await cryptoMembershipNFT.plans(i);
    console.log(`  Plan ${i}:`);
    console.log(`    Price: ${ethers.formatEther(plan.price)} USDT`);
    console.log(`    Name: ${plan.name}`);
    console.log(`    Active: ${plan.isActive}`);
    
    const cycleInfo = await cryptoMembershipNFT.getPlanCycleInfo(i);
    console.log(`    Current Cycle: ${cycleInfo[0]}`);
    console.log(`    Members in Current Cycle: ${cycleInfo[1]}`);
    console.log(`    Members Per Cycle: ${cycleInfo[2]}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });