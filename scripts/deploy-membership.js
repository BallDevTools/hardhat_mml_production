const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Crypto Membership NFT contract...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  const initialBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(initialBalance)} BNB`);

  // Get the network name for configuration selection
  const networkName = network.name;
  console.log(`Deploying to network: ${networkName}`);

  // Setup deployment file path
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }
  const deploymentPath = path.join(deploymentDir, `${networkName}.json`);
  let deploymentData = {};
  
  try {
    if (fs.existsSync(deploymentPath)) {
      deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
    }
  } catch (error) {
    console.log("No existing deployment file found. Creating a new one.");
  }

  // Get USDT token address from deployment data, env, or deploy new one
  let usdtAddress;
  if (deploymentData.fakeUSDT) {
    usdtAddress = deploymentData.fakeUSDT;
    console.log(`Using existing USDT token from deployment data: ${usdtAddress}`);
  } else if (process.env[`${networkName.toUpperCase()}_USDT_ADDRESS`]) {
    usdtAddress = process.env[`${networkName.toUpperCase()}_USDT_ADDRESS`];
    console.log(`Using existing USDT token from environment: ${usdtAddress}`);
  } else {
    // For testing, we can deploy a new fake USDT
    console.log("No USDT address provided, deploying a new FakeUSDT");
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    const fakeUSDT = await FakeUSDT.deploy();
    await fakeUSDT.waitForDeployment();
    usdtAddress = await fakeUSDT.getAddress();
    console.log(`FakeUSDT deployed to: ${usdtAddress}`);
    
    deploymentData.fakeUSDT = usdtAddress;
  }

  // Deploy CryptoMembershipNFT
  console.log("Deploying CryptoMembershipNFT...");
  const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");

  // Deploy main contract
  const cryptoMembershipNFT = await CryptoMembershipNFT.deploy(usdtAddress, deployer.address);
  await cryptoMembershipNFT.waitForDeployment();
  const cryptoMembershipNFTAddress = await cryptoMembershipNFT.getAddress();
  console.log(`CryptoMembershipNFT deployed to: ${cryptoMembershipNFTAddress}`);

  // Save deployment data
  deploymentData.cryptoMembershipNFT = cryptoMembershipNFTAddress;
  
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log(`Deployment information saved to ${deploymentPath}`);

  // Log contract details for verification
  console.log("\nContract deployment completed!");
  console.log("----------------------------------------------------");
  console.log("CryptoMembershipNFT:", cryptoMembershipNFTAddress);
  console.log("USDT Token:", usdtAddress);
  console.log("----------------------------------------------------");

  console.log("\nTo verify the main contract:");
  console.log(`npx hardhat verify --network ${networkName} ${cryptoMembershipNFTAddress} "${usdtAddress}" "${deployer.address}"`);

  // Calculate deployment cost
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployment cost: ${ethers.formatEther(initialBalance - finalBalance)} BNB`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });