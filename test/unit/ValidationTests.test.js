// Add to test/unit/ValidationTests.test.js
describe("Input Validation Tests", function () {
  it("Should validate all input parameters thoroughly", async function() {
    const { nft, owner } = await loadFixture(deployFixture);
    
    // Test plan creation with boundary values
    await expect(
      nft.connect(owner).createPlan(0, "Zero Price", 4)
    ).to.be.revertedWithCustomError(nft, "ZeroPrice");
    
    await expect(
      nft.connect(owner).createPlan(ethers.parseEther("1"), "", 4)
    ).to.be.revertedWithCustomError(nft, "EmptyName");
    
    // Test with extreme values
    const extremelyHighPrice = ethers.parseEther("1000000000"); // 1 billion ETH
    await nft.connect(owner).createPlan(extremelyHighPrice, "Extremely High Price", 4);
    
    const plan = await nft.plans(17); // Should be the new plan
    expect(plan.price).to.equal(extremelyHighPrice);
  });
});