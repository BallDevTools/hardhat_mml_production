// test/unit/NFTMetadataLib.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFTMetadataLib", function () {
  let tester;

  before(async function () {
    // Deploy NFTMetadataLibTester without manual linking
    const NFTMetadataLibTester = await ethers.getContractFactory("NFTMetadataLibTester");
    tester = await NFTMetadataLibTester.deploy();
    await tester.waitForDeployment();
    console.log("NFTMetadataLibTester deployed at:", await tester.getAddress());
  });

  describe("uint2str", function() {
    it("should convert 0 to string '0'", async function() {
      const result = await tester.testUint2str(0);
      expect(result).to.equal("0");
    });

    it("should convert positive integers to strings", async function() {
      const result = await tester.testUint2str(12345);
      expect(result).to.equal("12345");
    });

    it("should convert large numbers to strings", async function() {
      const result = await tester.testUint2str(999999999);
      expect(result).to.equal("999999999");
    });
  });

  describe("base64Encode", function() {
    it("should encode empty data as empty string", async function() {
      // ใช้ ethers.toUtf8Bytes แทน []
      const emptyBytes = ethers.toUtf8Bytes("");
      const result = await tester.testBase64Encode(emptyBytes);
      expect(result).to.equal("");
    });

    it("should correctly encode 'Hello World!'", async function() {
      const data = ethers.toUtf8Bytes("Hello World!");
      const result = await tester.testBase64Encode(data);
      expect(result).to.equal("SGVsbG8gV29ybGQh");
    });
  });
});