// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FakeUSDT is ERC20, Ownable {
    // ใช้ 6 decimals เหมือน USDT จริง
    uint8 private constant _DECIMALS = 6;
    
    constructor() ERC20("Fake USDT", "USDT") Ownable(msg.sender) {
        // Mint 1M tokens ให้ deployer
        _mint(msg.sender, 1000000 * 10**_DECIMALS);
    }
    
    // Override decimals เป็น 6 เหมือน USDT จริง
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
    
    // เพิ่มฟังก์ชัน mint สำหรับ testing
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    // เพิ่มฟังก์ชัน burn สำหรับ testing
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
    
    // เพิ่มฟังก์ชัน burnFrom สำหรับ testing
    function burnFrom(address account, uint256 amount) public {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }
    
    // ฟังก์ชันสำหรับแจกเงินให้ users ใน test
    function faucet(address to, uint256 amount) public {
        require(amount <= 10000 * 10**_DECIMALS, "Too much requested");
        _mint(to, amount);
    }
}