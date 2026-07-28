/**
 * 系統進入點 (Entry Point)
 */
document.addEventListener('DOMContentLoaded', () => {
    const appModel = new PosModel();
    const appView = new PosView();
    const appController = new PosController(appModel, appView);
    
    console.log('[系統] 初始化完成。MVC 架構已啟動。');
    
    // 1. 徹底禁用右鍵選單 (包含平板長按呼叫的文字選取選單)
    document.addEventListener('contextmenu', event => event.preventDefault());

    // =========================================================================
    // 🚀 Tech Lead 注入：iOS Safari 虛擬鍵盤收起後的「觸控熱區偏移」修復機制
    // =========================================================================
    document.addEventListener('focusout', (e) => {
        const tag = e.target.tagName;
        // 如果失去焦點的元素是輸入框或下拉選單 (代表鍵盤即將收起)
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            // 利用 setTimeout 稍微延遲，等 iOS 動畫跑完後，強制重置滾動位置，逼迫 WebKit 重新計算觸控座標
            setTimeout(() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }, 100);
        }
    });

});