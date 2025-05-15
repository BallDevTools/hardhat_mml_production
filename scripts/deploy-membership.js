// scripts/deploy-membership.js
const hre = require("hardhat");

async function main() {
  console.log("Deploying CryptoMembershipNFT to BSC Testnet...");
  
  // 1. Deploy FakeUSDT first
  const FakeUSDT = await hre.ethers.getContractFactory("FakeUSDT");
  const usdt = await FakeUSDT.deploy();
  await usdt.waitForDeployment();
  
  const usdtAddress = await usdt.getAddress();
  console.log(`FakeUSDT deployed to: ${usdtAddress}`);
  
  // 2. Deploy CryptoMembershipNFT
  const [deployer] = await hre.ethers.getSigners();
  const CryptoMembershipNFT = await hre.ethers.getContractFactory("CryptoMembershipNFT");
  const nft = await CryptoMembershipNFT.deploy(usdtAddress, deployer.address);
  await nft.waitForDeployment();
  
  const nftAddress = await nft.getAddress();
  console.log(`CryptoMembershipNFT deployed to: ${nftAddress}`);
  
  // 3. Display summary
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log(`FakeUSDT: ${usdtAddress}`);
  console.log(`CryptoMembershipNFT: ${nftAddress}`);
  console.log(`Owner: ${deployer.address}`);
  
  // บันทึกข้อมูลการ deploy ไว้ในไฟล์เพื่อใช้อ้างอิงในอนาคต
  const fs = require('fs');
  const deploymentInfo = {
    network: "bscTestnet",
    usdtAddress: usdtAddress,
    nftAddress: nftAddress,
    owner: deployer.address,
    deploymentTime: new Date().toISOString()
  };
  
  fs.writeFileSync(
    'deployment-info.json', 
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment information saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });