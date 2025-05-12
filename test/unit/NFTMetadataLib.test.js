const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTMetadataLib Unit Tests", function () {
  async function deployFixture() {
    // Deploy NFTMetadataLibTester contract ซึ่งใช้ฟังก์ชันจาก NFTMetadataLib
    const NFTMetadataLibTester = await ethers.getContractFactory("NFTMetadataLibTester");
    const tester = await NFTMetadataLibTester.deploy();
    
    return { tester };
  }
  
  describe("uint2str", function () {
    it("Should convert 0 to string correctly", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      const result = await tester.testUint2str(0);
      expect(result).to.equal("0");
    });
    
    it("Should convert positive integers to string correctly", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบกับตัวเลขต่างๆ
      const testCases = [
        { input: 1, expected: "1" },
        { input: 12345, expected: "12345" },
        { input: 9876543210, expected: "9876543210" },
        { input: ethers.parseEther("1"), expected: "1000000000000000000" }
      ];
      
      for (const { input, expected } of testCases) {
        const result = await tester.testUint2str(input);
        expect(result).to.equal(expected);
      }
    });
    
    it("Should handle very large numbers", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบกับตัวเลขขนาดใหญ่
      const largeNumber = ethers.parseEther("1000000000"); // 10^9 ETH
      const result = await tester.testUint2str(largeNumber);
      expect(result).to.equal("1000000000000000000000000000");
    });
  });
  
  describe("base64Encode", function () {
    it("Should encode empty data correctly", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      const emptyData = ethers.toUtf8Bytes("");
      const result = await tester.testBase64Encode(emptyData);
      expect(result).to.equal("");
    });
    
    it("Should encode ASCII text correctly", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบการเข้ารหัสข้อความปกติ
      const testStr = "Hello, World!";
      const testData = ethers.toUtf8Bytes(testStr);
      const result = await tester.testBase64Encode(testData);
      
      // ผลลัพธ์ที่คาดหวังจากการเข้ารหัส Base64
      const expectedBase64 = Buffer.from(testStr).toString('base64');
      expect(result).to.equal(expectedBase64);
    });
    
    it("Should encode non-ASCII text correctly", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบการเข้ารหัสข้อความที่มีอักขระพิเศษ
      const testStr = "สวัสดี, 世界!";
      const testData = ethers.toUtf8Bytes(testStr);
      const result = await tester.testBase64Encode(testData);
      
      // ผลลัพธ์ที่คาดหวังจากการเข้ารหัส Base64
      const expectedBase64 = Buffer.from(testStr).toString('base64');
      expect(result).to.equal(expectedBase64);
    });
    
    it("Should encode JSON data correctly", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบการเข้ารหัสข้อมูล JSON
      const jsonData = {
        name: "Test NFT",
        description: "This is a test NFT metadata",
        image: "ipfs://example",
        attributes: [
          { trait_type: "Plan Level", value: "1" },
          { trait_type: "Transferable", value: "No" }
        ]
      };
      
      const jsonStr = JSON.stringify(jsonData);
      const testData = ethers.toUtf8Bytes(jsonStr);
      const result = await tester.testBase64Encode(testData);
      
      // ผลลัพธ์ที่คาดหวังจากการเข้ารหัส Base64
      const expectedBase64 = Buffer.from(jsonStr).toString('base64');
      expect(result).to.equal(expectedBase64);
    });
    
    it("Should encode binary data correctly", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบการเข้ารหัสข้อมูลแบบ binary
      const binaryData = new Uint8Array([0, 1, 2, 3, 255, 254, 253, 252]);
      const result = await tester.testBase64Encode(binaryData);
      
      // ผลลัพธ์ที่คาดหวังจากการเข้ารหัส Base64
      const expectedBase64 = Buffer.from(binaryData).toString('base64');
      expect(result).to.equal(expectedBase64);
    });
    
    it("Should handle data requiring padding", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // ทดสอบข้อมูลที่ต้องการการเติมเต็มในการเข้ารหัส Base64
      // Base64 encoding pads to a multiple of 3 bytes, so we test with
      // lengths that are not multiples of 3
      
      // 1 byte (requires 2 padding chars in Base64)
      const oneByteData = new Uint8Array([65]); // ASCII 'A'
      const oneByteResult = await tester.testBase64Encode(oneByteData);
      expect(oneByteResult).to.equal("QQ==");
      
      // 2 bytes (requires 1 padding char in Base64)
      const twoByteData = new Uint8Array([65, 66]); // ASCII 'AB'
      const twoByteResult = await tester.testBase64Encode(twoByteData);
      expect(twoByteResult).to.equal("QUI=");
      
      // 3 bytes (no padding needed)
      const threeByteData = new Uint8Array([65, 66, 67]); // ASCII 'ABC'
      const threeByteResult = await tester.testBase64Encode(threeByteData);
      expect(threeByteResult).to.equal("QUJD");
    });
  });
  
  describe("Integration", function () {
    it("Should create valid NFT metadata JSON", async function () {
      const { tester } = await loadFixture(deployFixture);
      
      // สร้าง JSON metadata เสมือน
      const metadata = {
        name: "Test NFT #1",
        description: "Test NFT with level 1",
        image: "ipfs://QmExample",
        attributes: [
          { trait_type: "Plan Level", value: "1" },
          { trait_type: "Transferable", value: "No" }
        ]
      };
      
      // แปลงเป็น JSON string
      const jsonStr = JSON.stringify(metadata);
      const jsonData = ethers.toUtf8Bytes(jsonStr);
      
      // เข้ารหัส base64
      const base64Encoded = await tester.testBase64Encode(jsonData);
      
      // ตรวจสอบว่า base64 ถูกต้อง
      const decodedStr = Buffer.from(base64Encoded, 'base64').toString('utf8');
      const decodedJson = JSON.parse(decodedStr);
      
      // ตรวจสอบค่า
      expect(decodedJson.name).to.equal(metadata.name);
      expect(decodedJson.description).to.equal(metadata.description);
      expect(decodedJson.image).to.equal(metadata.image);
      expect(decodedJson.attributes).to.deep.equal(metadata.attributes);
    });
  });
});