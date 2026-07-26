/**
 * 系統全域設定檔 (Environment Configuration)
 * 嚴禁在此處撰寫任何業務邏輯 (Business Logic) 或 DOM 操作。
 */
const POS_CONFIG = {
    // ---------------------------------------------------
    // Google Apps Script (GAS) API 網址
    // 部署時，請將此處替換為正式環境的 Web App URL
    // ---------------------------------------------------
    GAS_API_URL: "https://script.google.com/macros/s/AKfycbwE4LS4ziqca3uoLv4YTn4Rlf9naP7a7Xd3dFSnu6bfAiKX6r73U_rBWi-YoLPOSD9f/exec", 
    
    // 系統基礎設定
    STORE_NAME: "勝芳商行 POS 系統",
    VERSION: "1.0.0",
    
    // 營業邏輯參數 (集中管理以利未來調整)
    DEBOUNCE_TIME: 800, // 掃描槍防抖時間 (毫秒)
};

// 防止設定在執行期間被意外竄改 (Immutable)
Object.freeze(POS_CONFIG);