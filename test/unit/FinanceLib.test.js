// test/unit/FinanceLib.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper contract to expose library functions for testing
const FinanceLibTesterArtifact = {
  _format: "hh-sol-artifact-1",
  contractName: "FinanceLibTester",
  sourceName: "contracts/test/FinanceLibTester.sol",
  abi: [
    {
      inputs: [],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "_amount",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "_currentPlanId",
          type: "uint256",
        },
      ],
      name: "testDistributeFunds",
      outputs: [
        {
          internalType: "uint256",
          name: "ownerShare",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "feeShare",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "fundShare",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "uplineShare",
          type: "uint256",
        },
      ],
      stateMutability: "pure",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "planId",
          type: "uint256",
        },
      ],
      name: "testGetPlanShares",
      outputs: [
        {
          internalType: "uint256",
          name: "userShare",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "companyShare",
          type: "uint256",
        },
      ],
      stateMutability: "pure",
      type: "function",
    },
  ],
  bytecode: "0x608060405234801561001057600080fd5b50610343806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063cc3e213d1461003b578063d4efbf781461006c575b600080fd5b61005560048036038101906100509190610197565b6100a0565b6040516100639291906101d0565b60405180910390f35b610086600480360381019061008191906101f9565b6100fa565b6040516100979493929190610255565b60405180910390f35b6000808273ffffffffffffffffffffffffffffffffffffffff166100c4846100fa565b9091509150505b915091565b60008160046100db9190610296565b1415610100576000915050611111565b9091509150565b60008060008060008673ffffffffffffffffffffffffffffffffffffffff1660056000101561012957600080fd5b63ff73faed6000101561013c57600080fd5b63ffffffff600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614151561017a57600080fd5b8293508493505094509450945094505b9296509295509295565b6000813590506101918161032c565b92915050565b6000602082840312156101ad576101ac610327565b5b60006101bb84828501610182565b91505092915050565b6101cd81610296565b82525050565b60006040820190506101e860008301856101c4565b6101f560208301846101c4565b9392505050565b6000806040838503121561021057610104610328564b5b600061021e85828601610182565b925050602061022f85828601610182565b9150509250929050565b61024281610296565b82525050565b61025181610296565b82525050565b600060808201905061026c6000830187610239565b6102796020830186610239565b6102866040830185610239565b6102936060830184610239565b95945050505050565b60006102a182610308565b91506102ac83610308565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038211156102e1576102e06102f8565b5b828201905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000819050919050565b600080fd5b61033581610308565b811461034057600080fd5b50565b610100546c696374ff73faed9881810102808218",
  deployedBytecode: "0x608060405234801561001057600080fd5b50600436106100365760003560e01c8063cc3e213d1461003b578063d4efbf781461006c575b600080fd5b61005560048036038101906100509190610197565b6100a0565b6040516100639291906101d0565b60405180910390f35b610086600480360381019061008191906101f9565b6100fa565b6040516100979493929190610255565b60405180910390f35b6000808273ffffffffffffffffffffffffffffffffffffffff166100c4846100fa565b9091509150505b915091565b60008160046100db9190610296565b1415610100576000915050611111565b9091509150565b60008060008060008673ffffffffffffffffffffffffffffffffffffffff1660056000101561012957600080fd5b63ff73faed6000101561013c57600080fd5b63ffffffff600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614151561017a57600080fd5b8293508493505094509450945094505b9296509295509295565b6000813590506101918161032c565b92915050565b6000602082840312156101ad576101ac610327565b5b60006101bb84828501610182565b91505092915050565b6101cd81610296565b82525050565b60006040820190506101e860008301856101c4565b6101f560208301846101c4565b9392505050565b6000806040838503121561021057610104610328564b5b600061021e85828601610182565b925050602061022f85828601610182565b9150509250929050565b61024281610296565b82525050565b61025181610296565b82525050565b600060808201905061026c6000830187610239565b6102796020830186610239565b6102866040830185610239565b6102936060830184610239565b95945050505050565b60006102a182610308565b91506102ac83610308565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038211156102e1576102e06102f8565b5b828201905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000819050919050565b600080fd5b61033581610308565b811461034057600080fd5b50565b610100546c6963",
  linkReferences: {},
  deployedLinkReferences: {},
};

const FinanceLibContractFactory = async () => {
  // First deploy the library
  const FinanceLib = await ethers.getContractFactory("FinanceLib");
  const financeLib = await FinanceLib.deploy();
  await financeLib.waitForDeployment();
  
  // Create test contract with library functions exposed
  const testContractArtifact = {
    ...FinanceLibTesterArtifact,
    linkReferences: {
      "contracts/test/FinanceLibTester.sol": {
        "FinanceLib": [
          {
            length: 20,
            start: 422,
          },
        ],
      },
    },
  };
  
  // Deploy the test contract with library linked
  return ethers.getContractFactoryFromArtifact(testContractArtifact, {
    libraries: {
      FinanceLib: await financeLib.getAddress(),
    },
  });
};

describe("FinanceLib", function () {
  let tester;

  before(async function () {
    // Deploy the test contract that calls the library functions
    console.log("Creating contract factory...");
    const TestContract = await FinanceLibContractFactory();
    console.log("Deploying test contract...");
    tester = await TestContract.deploy();
    await tester.waitForDeployment();
    console.log("Test contract deployed at:", await tester.getAddress());
  });

  describe("getPlanShares", function() {
    it("should return 50/50 split for plans 1-4", async function() {
      for (let i = 1; i <= 4; i++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(i);
        expect(userShare).to.equal(50);
        expect(companyShare).to.equal(50);
      }
    });

    it("should return 55/45 split for plans 5-8", async function() {
      for (let i = 5; i <= 8; i++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(i);
        expect(userShare).to.equal(55);
        expect(companyShare).to.equal(45);
      }
    });

    it("should return 58/42 split for plans 9-12", async function() {
      for (let i = 9; i <= 12; i++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(i);
        expect(userShare).to.equal(58);
        expect(companyShare).to.equal(42);
      }
    });

    it("should return 60/40 split for plans 13+", async function() {
      for (let i = 13; i <= 16; i++) {
        const [userShare, companyShare] = await tester.testGetPlanShares(i);
        expect(userShare).to.equal(60);
        expect(companyShare).to.equal(40);
      }
    });
  });

  describe("distributeFunds", function() {
    it("should distribute funds correctly for plan 1", async function() {
      const amount = ethers.parseEther("100");
      const planId = 1;
      
      const [ownerShare, feeShare, fundShare, uplineShare] = await tester.testDistributeFunds(amount, planId);
      
      // For plan 1: 50% company, 50% user
      // Company: 80% owner, 20% fee
      // User: 60% upline, 40% fund
      
      const expectedOwnerShare = amount * 50n * 80n / 10000n;
      const expectedFeeShare = amount * 50n * 20n / 10000n;
      const expectedUplineShare = amount * 50n * 60n / 10000n;
      const expectedFundShare = amount * 50n * 40n / 10000n;
      
      expect(ownerShare).to.equal(expectedOwnerShare);
      expect(feeShare).to.equal(expectedFeeShare);
      expect(fundShare).to.equal(expectedFundShare);
      expect(uplineShare).to.equal(expectedUplineShare);
      
      // Verify total equals original amount
      const totalDistributed = ownerShare + feeShare + fundShare + uplineShare;
      expect(totalDistributed).to.equal(amount);
    });
  });
});