// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");

// Import private key from .env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const BSC_SCAN_API_KEY = process.env.BSC_SCAN_API_KEY || "";

// Gas optimization settings
const gasPrice = parseInt(process.env.GAS_PRICE || "5") * 1e9; // Default 5 gwei
const gasLimit = parseInt(process.env.GAS_LIMIT || "5500000"); // Reasonable default

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // ใน hardhat.config.js
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true // เปิดกลับมาเมื่อ deploy จริง
    }
  },
  networks: {
    // BSC Mainnet
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gasPrice,
      gas: gasLimit,
      timeout: 60000 // 60 seconds
    },
    // BSC Testnet
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: [PRIVATE_KEY],
      gasPrice: gasPrice * 2, // Higher gas price on testnet for faster confirmations
      gas: gasLimit,
      timeout: 60000
    },
    // For local development
    hardhat: {
      // No specific config needed for basic usage
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  etherscan: {
    apiKey: {
      bsc: BSC_SCAN_API_KEY,
      bscTestnet: BSC_SCAN_API_KEY
    },
    customChains: [
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com"
        }
      },
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: gasPrice,
    token: "BNB",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: "gas-report.txt",
    noColors: true,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  mocha: {
    timeout: 60000, // Longer timeout for tests
  }
};