// test/unit/CryptoMembershipNFT.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoMembershipNFT", function () {
  let cryptoMembershipNFT;
  let fakeUSDT;
  let owner;
  let user1;
  let user2;
  let user3;

  const planPrice = ethers.parseEther("1"); // 1 USDT for plan 1

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy FakeUSDT
    const FakeUSDT = await ethers.getContractFactory("FakeUSDT");
    fakeUSDT = await FakeUSDT.deploy();
    await fakeUSDT.waitForDeployment();
    
    // First deploy the libraries separately
    const NFTMetadataLib = await ethers.getContractFactory("NFTMetadataLib");
    const nftMetadataLib = await NFTMetadataLib.deploy();
    await nftMetadataLib.waitForDeployment();
    const nftMetadataLibAddress = await nftMetadataLib.getAddress();
    console.log("NFTMetadataLib deployed at:", nftMetadataLibAddress);
    
    const FinanceLib = await ethers.getContractFactory("FinanceLib");
    const financeLib = await FinanceLib.deploy();
    await financeLib.waitForDeployment();
    const financeLibAddress = await financeLib.getAddress();
    console.log("FinanceLib deployed at:", financeLibAddress);
    
    // Deploy CryptoMembershipNFT without manually linking libraries
    const CryptoMembershipNFT = await ethers.getContractFactory("CryptoMembershipNFT");
    
    // Deploy with constructor arguments
    const usdtAddress = await fakeUSDT.getAddress();
    cryptoMembershipNFT = await CryptoMembershipNFT.deploy(usdtAddress, owner.address);
    await cryptoMembershipNFT.waitForDeployment();
    
    console.log("CryptoMembershipNFT deployed at:", await cryptoMembershipNFT.getAddress());
    
    // Transfer USDT to users for testing
    const usdtAmount = ethers.parseEther("100");
    await fakeUSDT.transfer(user1.address, usdtAmount);
    await fakeUSDT.transfer(user2.address, usdtAmount);
    await fakeUSDT.transfer(user3.address, usdtAmount);
    
    // Approve USDT for the NFT contract
    await fakeUSDT.connect(user1).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    await fakeUSDT.connect(user2).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
    await fakeUSDT.connect(user3).approve(await cryptoMembershipNFT.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("should set the right owner", async function () {
      expect(await cryptoMembershipNFT.owner()).to.equal(owner.address);
    });
    
    it("should initialize with correct USDT token", async function () {
      expect(await cryptoMembershipNFT.usdtToken()).to.equal(await fakeUSDT.getAddress());
    });
    
    it("should create default plans", async function () {
      // Check plan 1
      const plan1 = await cryptoMembershipNFT.plans(1);
      expect(plan1.price).to.equal(ethers.parseUnits("1", 18)); // 1 USDT
      expect(plan1.isActive).to.equal(true);
      
      // Check plan 16
      const plan16 = await cryptoMembershipNFT.plans(16);
      expect(plan16.price).to.equal(ethers.parseUnits("16", 18)); // 16 USDT
      expect(plan16.isActive).to.equal(true);
    });
  });

  describe("Member Registration", function () {
    it("should allow registration with valid parameters", async function () {
      await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
      
      // Check user1 is a member
      expect(await cryptoMembershipNFT.balanceOf(user1.address)).to.equal(1);
      
      // Check member details
      const member = await cryptoMembershipNFT.members(user1.address);
      expect(member.upline).to.equal(owner.address);
      expect(member.planId).to.equal(1);
    });
    
    it("should handle referrals correctly", async function () {
      // Register user1 first
      await cryptoMembershipNFT.connect(user1).registerMember(1, owner.address);
      
      // User2 registers with user1 as upline
      await cryptoMembershipNFT.connect(user2).registerMember(1, user1.address);
      
      // Check user2's upline is user1
      const member = await cryptoMembershipNFT.members(user2.address);
      expect(member.upline).to.equal(user1.address);
      
      // Check user1's referral count
      const user1Member = await cryptoMembershipNFT.members(user1.address);
      expect(user1Member.totalReferrals).to.equal(1);
    });
  });

  // Add more test sections for other functionality
});