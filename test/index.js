// ไฟล์ index.js สำหรับรวมการทดสอบทั้งหมด

// การทดสอบหลัก
require('./unit/CryptoMembershipNFT.test');

// การทดสอบ Libraries
require('./unit/FinanceLib.test');
require('./unit/NFTMetadataLib.test');
require('./unit/TokenLib.test');
require('./unit/MembershipLib.test');
require('./unit/ContractErrors.test');

// การทดสอบ Events
require('./unit/CompleteEventTests.test');

// การทดสอบ Integration
require('./integration/CommissionPayment.test');
require('./integration/PlanUpgradeChain.test');

// การทดสอบ Security
require('./security/SecurityTests.test');
require('./security/EmergencyWithdrawTests.test');

// การทดสอบ Performance
require('./performance/GasUsageTests.test');

// การทดสอบ Validation
require('./unit/ValidationTests.test');

// การทดสอบ Simulation
require('./simulation/MembershipSimulation.test');