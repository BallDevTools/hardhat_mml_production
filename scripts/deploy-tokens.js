const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying FakeUSDT token...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  const initialBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(initialBalance)} BNB`);

  // Deploy FakeUSDT
  const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
  const fakeUSDT = await FakeUSDT.deploy();
  await fakeUSDT.waitForDeployment();

  const usdtAddress = await fakeUSDT.getAddress();
  console.log(`FakeUSDT deployed to: ${usdtAddress}`);

  // Log contract details for verification
  console.log("\nContract deployment completed!");
  console.log("----------------------------------------------------");
  console.log("FakeUSDT:", usdtAddress);
  console.log("----------------------------------------------------");
  console.log("\nTo verify contracts:");
  console.log(`npx hardhat verify --network ${network.name} ${usdtAddress}`);

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployment cost: ${ethers.formatEther(initialBalance - finalBalance)} BNB`);
  
  // Save deployment info to a file
  const fs = require("fs");
  const path = require("path");
  
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }
  
  const deploymentPath = path.join(deploymentDir, `${network.name}.json`);
  let deploymentData = {};
  
  try {
    if (fs.existsSync(deploymentPath)) {
      deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
    }
  } catch (error) {
    console.log("No existing deployment file found. Creating a new one.");
  }
  
  deploymentData.fakeUSDT = usdtAddress;
  
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log(`Deployment information saved to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
