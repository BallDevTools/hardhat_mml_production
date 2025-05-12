// ไฟล์ index.js สำหรับรวมการทดสอบทั้งหมด

// การทดสอบหลัก
require('./unit/CryptoMembershipNFT.test');

// การทดสอบ Libraries
require('./unit/FinanceLib.test');
require('./unit/NFTMetadataLib.test');
require('./unit/TokenLib.test');
require('./unit/MembershipLib.test');
require('./unit/ContractErrors.test');

// หากมีการทดสอบเพิ่มเติมในอนาคตสามารถเพิ่มได้ที่นี่