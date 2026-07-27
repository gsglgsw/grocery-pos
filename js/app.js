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

    // 🚀 Tech Lead 修正：移除舊版的 touchmove preventDefault。
    // 觸控防滑動已全權交由 index.html 的 CSS (overscroll-behavior) 處理，
    // 確保 iPad 上的 click 事件不會被誤殺，恢復絲滑的觸控手感！
});