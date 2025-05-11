// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./NFTMetadataLib.sol";
import "./FinanceLib.sol";

/**
 * @title CryptoMembershipNFT
 * @dev สัญญาสมาชิก NFT พร้อมระบบอ้างอิงและการจัดการแผนสมาชิก (NFT ไม่สามารถโอนหรือแก้ไขได้)
 * @notice สัญญานี้จัดการระบบสมาชิก NFT ที่มีแผนการอัปเกรดและระบบอ้างอิง
 * @custom:security-contact security@example.com
 */
contract CryptoMembershipNFT is ERC721Enumerable, Ownable, ReentrancyGuard {
    // ===== STORAGE OPTIMIZATION =====
    struct ContractState {
        uint256 tokenIdCounter;
        uint256 planCount;
        uint256 ownerBalance;
        uint256 feeSystemBalance;
        uint256 fundBalance;
        uint256 totalCommissionPaid;
        bool firstMemberRegistered;
        bool paused;
        uint256 emergencyWithdrawRequestTime;
    }
    
    ContractState private state;
    
    IERC20 public immutable usdtToken;
    uint8 private immutable _tokenDecimals;
    address public priceFeed;
    string private _baseTokenURI;
    
    // Constants defined once to save gas
    uint256 public constant MAX_MEMBERS_PER_CYCLE = 4;
    uint256 public constant TIMELOCK_DURATION = 2 days;
    uint256 public constant EMERGENCY_TIMELOCK = 24 hours;
    uint256 private constant MIN_ACTION_DELAY = 1 minutes;
    uint256 private constant UPGRADE_COOLDOWN = 1 days;
    uint256 private constant MAX_REFERRAL_DEPTH = 10;
    
    // Main data structures
    struct MembershipPlan {
        uint256 price;
        string name;
        uint256 membersPerCycle;
        bool isActive;
    }

    struct Member {
        address upline;
        uint256 totalReferrals;
        uint256 totalEarnings;
        uint256 planId;
        uint256 cycleNumber;
        uint256 registeredAt;
    }

    struct CycleInfo {
        uint256 currentCycle;
        uint256 membersInCurrentCycle;
    }

    struct NFTImage {
        string imageURI;
        string name;
        string description;
        uint256 planId;
        uint256 createdAt;
    }
    
    // ===== MAPPINGS =====
    mapping(uint256 => MembershipPlan) public plans;
    mapping(address => Member) public members;
    mapping(uint256 => CycleInfo) public planCycles;
    mapping(uint256 => NFTImage) public tokenImages;
    mapping(uint256 => string) public planDefaultImages;
    mapping(address => uint256) private lastActionTimestamp;
    mapping(address => bool) private _isReferralLoop;
    mapping(address => uint256) private _lastUpgradeRequest;
    
    // Reentrancy protection specific for transfers
    bool private _inTransaction;
    
    // ===== EVENTS =====
    event PlanCreated(uint256 planId, string name, uint256 price, uint256 membersPerCycle);
    event MemberRegistered(address indexed member, address indexed upline, uint256 planId, uint256 cycleNumber);
    event ReferralPaid(address indexed from, address indexed to, uint256 amount);
    event PlanUpgraded(address indexed member, uint256 oldPlanId, uint256 newPlanId, uint256 cycleNumber);
    event NewCycleStarted(uint256 planId, uint256 cycleNumber);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event ContractPaused(bool status);
    event PriceFeedUpdated(address indexed newPriceFeed);
    event MemberExited(address indexed member, uint256 refundAmount);
    event FundsDistributed(uint256 ownerAmount, uint256 feeAmount, uint256 fundAmount);
    event UplineNotified(address indexed upline, address indexed downline, uint256 downlineCurrentPlan, uint256 downlineTargetPlan);
    event PlanDefaultImageSet(uint256 indexed planId, string imageURI);
    event BatchWithdrawalProcessed(uint256 totalOwner, uint256 totalFee, uint256 totalFund);
    event EmergencyWithdrawRequested(uint256 timestamp);
    event ContractStatusUpdated(bool isPaused, uint256 totalBalance);
    event TransactionFailed(address indexed user, string reason);
    event TimelockUpdated(uint256 newDuration);
    event ReferralLoopDetected(address indexed member, address indexed upline);
    event EmergencyWithdrawInitiated(uint256 timestamp, uint256 amount);
    event MetadataUpdated(uint256 indexed tokenId, string newURI);
    
    // ===== MODIFIERS =====
    modifier whenNotPaused() {
        require(!state.paused, "0x01");
        _;
    }

    modifier onlyMember() {
        require(balanceOf(msg.sender) > 0, "0x02");
        _;
    }
    
    modifier noReentrantTransfer() {
        require(!_inTransaction, "0x03");
        _inTransaction = true;
        _;
        _inTransaction = false;
    }
    
    modifier preventFrontRunning() {
        require(block.timestamp >= lastActionTimestamp[msg.sender] + MIN_ACTION_DELAY, "0x04");
        lastActionTimestamp[msg.sender] = block.timestamp;
        _;
    }

    modifier noReferralLoop(address _upline) {
        require(!_isReferralLoop[_upline], "0x05");
        require(!_checkReferralLoop(_upline), "Referral loop detected");
        _;
    }

    modifier validAddress(address _addr) {
        require(_addr != address(0), "0x06");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(address _usdtToken, address initialOwner) 
        ERC721("Crypto Membership NFT", "CMNFT") 
        Ownable(initialOwner) 
        validAddress(_usdtToken) 
        validAddress(initialOwner) 
    {
        require(_usdtToken != address(0), "0x07");
        require(initialOwner != address(0), "0x08");
        
        usdtToken = IERC20(_usdtToken);
        _tokenDecimals = IERC20Metadata(_usdtToken).decimals();
        require(_tokenDecimals > 0, "0x09");
        
        _createDefaultPlans();
        _setupDefaultImages();
    }

    // ===== INTERNAL SETUP FUNCTIONS =====
    function _setupDefaultImages() internal {
        for (uint256 i = 0; i < 16;) {
            planDefaultImages[i + 1] = _uint2str(i + 1); // ใช้รหัสตัวเลข 1-16
            unchecked { ++i; }
        }
    }

    function _createDefaultPlans() internal {
        uint256 decimal = 10 ** _tokenDecimals;
        
        for (uint256 i = 0; i < 16;) {
            string memory planName = _uint2str(i + 1); // ใช้รหัสตัวเลข 1-16
            _createPlan((i + 1) * decimal, planName, MAX_MEMBERS_PER_CYCLE);
            unchecked { ++i; }
        }
    }

    // ===== TOKEN TRANSFER RESTRICTION =====
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256,
        uint256
    ) internal virtual {
        require(from == address(0) || to == address(0), "0x0A");
    }

    // ===== PLAN MANAGEMENT =====
    function createPlan(uint256 _price, string calldata _name, uint256 _membersPerCycle) external onlyOwner {
        require(_membersPerCycle == MAX_MEMBERS_PER_CYCLE, "0x0B");
        require(bytes(_name).length > 0, "0x0C");
        require(_price > 0, "0x0D");
        
        _createPlan(_price, _name, _membersPerCycle);
    }

    function _createPlan(uint256 _price, string memory _name, uint256 _membersPerCycle) internal {
        // ตรวจสอบว่าราคาสูงกว่าแผนก่อนหน้าหรือไม่ (ถ้ามี)
        if (state.planCount > 0) {
            require(_price > plans[state.planCount].price, "New plan price must be higher than previous plan");
        }
        
        unchecked { state.planCount++; }
        plans[state.planCount] = MembershipPlan(_price, _name, _membersPerCycle, true);
        planCycles[state.planCount] = CycleInfo(1, 0);
        emit PlanCreated(state.planCount, _name, _price, _membersPerCycle);
    }

    function setPlanDefaultImage(uint256 _planId, string calldata _imageURI) external onlyOwner {
        require(_planId > 0 && _planId <= state.planCount, "0x0E");
        require(bytes(_imageURI).length > 0, "0x0F");
        
        planDefaultImages[_planId] = _imageURI;
        emit PlanDefaultImageSet(_planId, _imageURI);
    }

    // ===== NFT METADATA =====
    function getNFTImage(uint256 _tokenId) external view returns (
        string memory imageURI,
        string memory name,
        string memory description,
        uint256 planId,
        uint256 createdAt
    ) {
        require(_exists(_tokenId), "0x10");
        NFTImage memory image = tokenImages[_tokenId];
        
        return (
            image.imageURI,
            image.name,
            image.description,
            image.planId,
            image.createdAt
        );
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), "0x11");
        
        NFTImage memory image = tokenImages[_tokenId];
        Member memory member = members[ownerOf(_tokenId)];
        
        return
            string(
                abi.encodePacked(
                    'data:application/json;base64,',
                    NFTMetadataLib.base64Encode(
                        abi.encodePacked(
                            '{"name":"', image.name,
                            '", "description":"', image.description,
                            '", "image":"', image.imageURI,
                            '", "attributes": [{"trait_type": "Plan Level", "value": "',
                            NFTMetadataLib.uint2str(member.planId),
                            '"}]}'
                        )
                    )
                )
            );
    }

    // ===== MEMBER MANAGEMENT =====
    function registerMember(uint256 _planId, address _upline) 
        external 
        nonReentrant 
        whenNotPaused 
        preventFrontRunning 
        validAddress(_upline) 
        noReferralLoop(_upline) 
    {
        require(_planId > 0 && _planId <= state.planCount, "0x12");
        require(_planId == 1, "0x13");
        require(plans[_planId].isActive, "0x14");
        require(balanceOf(msg.sender) == 0, "0x15");
        require(bytes(planDefaultImages[_planId]).length > 0, "0x16");

        address finalUpline = _determineUpline(_upline, _planId);

        _safeTransferFrom(msg.sender, address(this), plans[_planId].price);

        uint256 tokenId = state.tokenIdCounter;
        unchecked { state.tokenIdCounter++; }
        _safeMint(msg.sender, tokenId);

        _setTokenImage(tokenId, _planId);

        uint256 cycleNumber = _updateCycle(_planId);

        members[msg.sender] = Member(
            finalUpline, 
            0, 
            0, 
            _planId, 
            cycleNumber,
            block.timestamp
        );

        uint256 uplineShare = _distributeAndRecordFunds(plans[_planId].price, _planId);

        _handleUplinePayment(finalUpline, uplineShare);

        emit MemberRegistered(msg.sender, finalUpline, _planId, cycleNumber);
    }

    function _checkReferralLoop(address _upline) private view returns (bool) {
        address[] memory visited = new address[](MAX_REFERRAL_DEPTH);
        uint256 index = 0;
        address current = _upline;

        while (current != address(0) && index < MAX_REFERRAL_DEPTH) {
            for (uint256 i = 0; i < index; i++) {
                if (visited[i] == current) {
                    return true; // พบลูป
                }
            }
            visited[index] = current;
            index++;
            current = members[current].upline;
        }
        return false;
    }

    function _determineUpline(address _upline, uint256 _planId) private returns (address) {
        if (!state.firstMemberRegistered) {
            state.firstMemberRegistered = true;
            return owner();
        }
        if (_upline == address(0) || _upline == msg.sender) {
            return owner();
        }
        require(balanceOf(_upline) > 0, "0x17");
        require(members[_upline].planId >= _planId, "0x18");
        return _upline;
    }

    function _setTokenImage(uint256 tokenId, uint256 planId) private {
        string memory defaultImage = planDefaultImages[planId];
        string memory planName = plans[planId].name;
        tokenImages[tokenId] = NFTImage(
            defaultImage,
            planName,
            string(abi.encodePacked("Crypto Membership NFT - ", planName, " Plan")),
            planId,
            block.timestamp
        );
    }

    function _updateCycle(uint256 _planId) private returns (uint256) {
        CycleInfo storage cycleInfo = planCycles[_planId];
        unchecked { cycleInfo.membersInCurrentCycle++; }
        
        if (cycleInfo.membersInCurrentCycle >= plans[_planId].membersPerCycle) {
            unchecked { 
                cycleInfo.currentCycle++;
                cycleInfo.membersInCurrentCycle = 0;
            }
            emit NewCycleStarted(_planId, cycleInfo.currentCycle);
        }
        return cycleInfo.currentCycle;
    }

    function _distributeAndRecordFunds(uint256 amount, uint256 planId) private returns (uint256) {
        (
            uint256 ownerShare,
            uint256 feeShare,
            uint256 fundShare,
            uint256 uplineShare
        ) = FinanceLib.distributeFunds(amount, planId);

        unchecked {
            state.ownerBalance += ownerShare;
            state.feeSystemBalance += feeShare;
            state.fundBalance += fundShare;
        }

        emit FundsDistributed(ownerShare, feeShare, fundShare);
        return uplineShare;
    }

    // ===== SECURE TOKEN TRANSFER FUNCTIONS =====
    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        uint256 balanceBefore = usdtToken.balanceOf(to);
        require(usdtToken.transferFrom(from, to, amount), "0x1A");
        uint256 balanceAfter = usdtToken.balanceOf(to);
        require(balanceAfter >= balanceBefore + amount, "0x1B");
    }
    
    function _safeTransfer(address to, uint256 amount) internal {
        uint256 balanceBefore = usdtToken.balanceOf(to);
        require(usdtToken.transfer(to, amount), "0x1C");
        uint256 balanceAfter = usdtToken.balanceOf(to);
        require(balanceAfter >= balanceBefore + amount, "0x1D");
    }

    // ===== FUND DISTRIBUTION =====
    function _handleUplinePayment(address _upline, uint256 _uplineShare) internal {
        if (_upline != address(0)) {
            if (members[_upline].planId >= members[msg.sender].planId) {
                _payReferralCommission(msg.sender, _upline, _uplineShare);
                unchecked { members[_upline].totalReferrals += 1; }
            } else {
                unchecked { state.ownerBalance += _uplineShare; }
            }
        } else {
            unchecked { state.ownerBalance += _uplineShare; }
        }
    }

    function _payReferralCommission(address _from, address _to, uint256 _amount) internal noReentrantTransfer {
        Member storage upline = members[_to];
        uint256 commission = _amount;

        _safeTransfer(_to, commission);
        
        unchecked {
            upline.totalEarnings += commission;
            state.totalCommissionPaid += commission;
        }
        
        emit ReferralPaid(_from, _to, commission);
    }

    // ===== PLAN UPGRADE =====
    function upgradePlan(uint256 _newPlanId) external nonReentrant whenNotPaused onlyMember preventFrontRunning noReentrantTransfer {
        require(block.timestamp >= _lastUpgradeRequest[msg.sender] + UPGRADE_COOLDOWN, "0x1E");
        _lastUpgradeRequest[msg.sender] = block.timestamp;

        require(msg.sender != address(0), "0x20");
        require(members[msg.sender].registeredAt > 0, "0x21");
        require(_newPlanId > 0 && _newPlanId <= state.planCount, "0x22");
        require(plans[_newPlanId].isActive, "0x23");

        Member storage member = members[msg.sender];
        require(_newPlanId > member.planId, "0x24");
        require(_newPlanId == member.planId + 1, "0x25");

        uint256 priceDifference = plans[_newPlanId].price - plans[member.planId].price;
        require(priceDifference > 0, "0x26");
        
        _safeTransferFrom(msg.sender, address(this), priceDifference);

        uint256 oldPlanId = member.planId;
        address upline = member.upline;

        CycleInfo storage cycleInfo = planCycles[_newPlanId];
        unchecked { cycleInfo.membersInCurrentCycle++; }
        
        if (cycleInfo.membersInCurrentCycle >= plans[_newPlanId].membersPerCycle) {
            unchecked { 
                cycleInfo.currentCycle++;
                cycleInfo.membersInCurrentCycle = 0;
            }
            emit NewCycleStarted(_newPlanId, cycleInfo.currentCycle);
        }

        member.cycleNumber = cycleInfo.currentCycle;
        member.planId = _newPlanId;

        if (upline != address(0) && members[upline].planId < _newPlanId) {
            emit UplineNotified(upline, msg.sender, oldPlanId, _newPlanId);
        }

        (
            uint256 ownerShare,
            uint256 feeShare,
            uint256 fundShare,
            uint256 uplineShare
        ) = FinanceLib.distributeFunds(priceDifference, _newPlanId);

        unchecked {
            state.ownerBalance += ownerShare;
            state.feeSystemBalance += feeShare;
            state.fundBalance += fundShare;
        }

        emit FundsDistributed(ownerShare, feeShare, fundShare);

        _handleUplinePayment(upline, uplineShare);

        uint256 tokenId = tokenOfOwnerByIndex(msg.sender, 0);
        NFTImage storage tokenImage = tokenImages[tokenId];
        tokenImage.planId = _newPlanId;
        tokenImage.name = plans[_newPlanId].name;
        tokenImage.description = string(abi.encodePacked("Crypto Membership NFT - ", plans[_newPlanId].name, " Plan"));

        emit PlanUpgraded(msg.sender, oldPlanId, _newPlanId, cycleInfo.currentCycle);
    }

    // ===== MEMBER EXIT =====
    function exitMembership() external nonReentrant whenNotPaused onlyMember {
        Member storage member = members[msg.sender];
        
        uint256 requiredTime = member.registeredAt + 30 days;
        require(block.timestamp > requiredTime, "0x27");
        
        uint256 planPrice = plans[member.planId].price;
        uint256 refundAmount = (planPrice * 30) / 100;
        
        require(state.fundBalance >= refundAmount, "0x28");
        
        unchecked { state.fundBalance -= refundAmount; }
        
        uint256 tokenId = tokenOfOwnerByIndex(msg.sender, 0);
        delete tokenImages[tokenId];
        
        _burn(tokenId);
        delete members[msg.sender];
        
        _safeTransfer(msg.sender, refundAmount);
        
        emit MemberExited(msg.sender, refundAmount);
    }
    
    // ===== FINANCE MANAGEMENT =====
    function withdrawOwnerBalance(uint256 amount) external onlyOwner nonReentrant noReentrantTransfer {
        require(amount <= state.ownerBalance, "0x29");
        unchecked { state.ownerBalance -= amount; }
        _safeTransfer(owner(), amount);
    }

    function withdrawFeeSystemBalance(uint256 amount) external onlyOwner nonReentrant noReentrantTransfer {
        require(amount <= state.feeSystemBalance, "0x2A");
        unchecked { state.feeSystemBalance -= amount; }
        _safeTransfer(owner(), amount);
    }

    function withdrawFundBalance(uint256 amount) external onlyOwner nonReentrant noReentrantTransfer {
        require(amount <= state.fundBalance, "0x2B");
        unchecked { state.fundBalance -= amount; }
        _safeTransfer(owner(), amount);
    }

    // ===== BATCH WITHDRAWALS =====
    struct WithdrawalRequest {
        address recipient;
        uint256 amount;
        uint256 balanceType;
    }

    function batchWithdraw(WithdrawalRequest[] calldata requests) external onlyOwner nonReentrant noReentrantTransfer {
        require(requests.length > 0, "0x2C");
        require(requests.length <= 20, "0x2D");
        
        uint256 totalOwner;
        uint256 totalFee;
        uint256 totalFund;
        
        for (uint256 i = 0; i < requests.length;) {
            WithdrawalRequest calldata req = requests[i];
            
            require(req.recipient != address(0), "0x2E");
            require(req.amount > 0, "0x2F");
            require(req.balanceType <= 2, "0x30");
            
            if (req.balanceType == 0) {
                require(req.amount <= state.ownerBalance, "0x31");
                unchecked { 
                    totalOwner += req.amount;
                    state.ownerBalance -= req.amount; 
                }
            } else if (req.balanceType == 1) {
                require(req.amount <= state.feeSystemBalance, "0x32");
                unchecked { 
                    totalFee += req.amount;
                    state.feeSystemBalance -= req.amount; 
                }
            } else {
                require(req.amount <= state.fundBalance, "0x33");
                unchecked { 
                    totalFund += req.amount;
                    state.fundBalance -= req.amount; 
                }
            }
            
            _safeTransfer(req.recipient, req.amount);
            
            unchecked { ++i; }
        }
        
        emit BatchWithdrawalProcessed(totalOwner, totalFee, totalFund);
    }
    
    // ===== INFO & QUERY FUNCTIONS =====
    function getPlanCycleInfo(uint256 _planId) external view returns (
        uint256 currentCycle, 
        uint256 membersInCurrentCycle, 
        uint256 membersPerCycle
    ) {
        require(_planId > 0 && _planId <= state.planCount, "0x34");
        CycleInfo memory cycleInfo = planCycles[_planId];
        return (cycleInfo.currentCycle, cycleInfo.membersInCurrentCycle, plans[_planId].membersPerCycle);
    }
    
    function getSystemStats() external view returns (
        uint256 totalMembers, 
        uint256 totalRevenue, 
        uint256 totalCommission, 
        uint256 ownerFunds, 
        uint256 feeFunds, 
        uint256 fundFunds
    ) {
        return (
            totalSupply(),
            state.ownerBalance + state.feeSystemBalance + state.fundBalance + state.totalCommissionPaid,
            state.totalCommissionPaid,
            state.ownerBalance,
            state.feeSystemBalance,
            state.fundBalance
        );
    }
    
    function getContractStatus() external view returns (
        bool isPaused,
        uint256 totalBalance,
        uint256 memberCount,
        uint256 currentPlanCount,
        bool hasEmergencyRequest,
        uint256 emergencyTimeRemaining
    ) {
        uint256 timeRemaining = state.emergencyWithdrawRequestTime > 0 ? 
            state.emergencyWithdrawRequestTime + EMERGENCY_TIMELOCK - block.timestamp : 0;
        
        return (
            state.paused,
            usdtToken.balanceOf(address(this)),
            totalSupply(),
            state.planCount,
            state.emergencyWithdrawRequestTime > 0,
            timeRemaining
        );
    }
    
    // ===== CONTRACT CONFIGURATION =====
    function updateMembersPerCycle(uint256 _planId, uint256 _newMembersPerCycle) external onlyOwner {
        require(_planId > 0 && _planId <= state.planCount, "0x35");
        require(_newMembersPerCycle == MAX_MEMBERS_PER_CYCLE, "0x36");
        plans[_planId].membersPerCycle = _newMembersPerCycle;
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        require(bytes(baseURI).length > 0, "0x37");
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setPlanStatus(uint256 _planId, bool _isActive) external onlyOwner {
        require(_planId > 0 && _planId <= state.planCount, "0x38");
        plans[_planId].isActive = _isActive;
    }
    
    function setPriceFeed(address _priceFeed) external onlyOwner {
        require(_priceFeed != address(0), "0x39");
        priceFeed = _priceFeed;
        emit PriceFeedUpdated(_priceFeed);
    }

    // ===== EMERGENCY FUNCTIONS =====
    function setPaused(bool _paused) external onlyOwner {
        state.paused = _paused;
        emit ContractPaused(_paused);
        emit ContractStatusUpdated(_paused, usdtToken.balanceOf(address(this)));
    }

    function requestEmergencyWithdraw() external onlyOwner {
        state.emergencyWithdrawRequestTime = block.timestamp;
        emit EmergencyWithdrawRequested(block.timestamp);
    }

    function emergencyWithdraw() external onlyOwner nonReentrant noReentrantTransfer {
        require(state.emergencyWithdrawRequestTime > 0, "0x3A");
        require(block.timestamp >= state.emergencyWithdrawRequestTime + EMERGENCY_TIMELOCK, "0x3B");
        
        uint256 contractBalance = usdtToken.balanceOf(address(this));
        require(contractBalance > 0, "0x3C");
        
        // คำนวณผลรวมของยอดคงเหลือที่บันทึก
        uint256 expectedBalance = state.ownerBalance + state.feeSystemBalance + state.fundBalance;
        
        // ตรวจสอบว่ายอดจริงเพียงพอหรือไม่
        require(contractBalance >= expectedBalance, "Insufficient contract balance for recorded balances");
        
        emit EmergencyWithdrawInitiated(block.timestamp, contractBalance);
        
        // อัปเดตยอดคงเหลือตามสัดส่วน
        if (expectedBalance > 0) {
            uint256 ownerShare = (contractBalance * state.ownerBalance) / expectedBalance;
            uint256 feeShare = (contractBalance * state.feeSystemBalance) / expectedBalance;
            uint256 fundShare = contractBalance - ownerShare - feeShare; // เพื่อให้ครบยอด
            
            state.ownerBalance = 0;
            state.feeSystemBalance = 0;
            state.fundBalance = 0;
            
            // โอนเงินไปยังเจ้าของ
            _safeTransfer(owner(), contractBalance);
            
            emit EmergencyWithdraw(owner(), contractBalance);
            emit FundsDistributed(ownerShare, feeShare, fundShare); // บันทึกการกระจาย
        } else {
            // กรณีไม่มียอดคงเหลือที่บันทึก
            state.ownerBalance = 0;
            state.feeSystemBalance = 0;
            state.fundBalance = 0;
            
            _safeTransfer(owner(), contractBalance);
            
            emit EmergencyWithdraw(owner(), contractBalance);
        }
        
        state.emergencyWithdrawRequestTime = 0;
    }
    
    function restartAfterPause() external onlyOwner {
        require(state.paused, "0x3D");
        state.paused = false;
        emit ContractPaused(false);
        emit ContractStatusUpdated(false, usdtToken.balanceOf(address(this)));
    }
    
    // ===== CONTRACT VALIDATION =====
    function validateContractBalance() public view returns (bool, uint256, uint256) {
        uint256 expectedBalance = state.ownerBalance + state.feeSystemBalance + state.fundBalance;
        uint256 actualBalance = usdtToken.balanceOf(address(this));
        return (actualBalance >= expectedBalance, expectedBalance, actualBalance);
    }

    // ===== HELPER FUNCTIONS =====
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        return NFTMetadataLib.uint2str(_i);
    }
}