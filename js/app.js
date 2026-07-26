/**
 * 系統進入點 (Entry Point)
 * 負責實例化 MVC 物件，並處理全局初始設定 (如 Service Worker 註冊與強制快取更新指令)。
 */
document.addEventListener('DOMContentLoaded', () => {
    const appModel = new PosModel();
    const appView = new PosView();
    const appController = new PosController(appModel, appView);
    
    console.log('系統初始化完成。MVC 架構已啟動。');
    
    // TODO Phase 4: 在此處註冊 Service Worker 並實作 Force-Sync 機制以符合維運需求。
});
// 🚀 Phase 8: 系統層級防呆攔截
document.addEventListener('DOMContentLoaded', () => {
    // 1. 徹底禁用右鍵選單 (包含平板長按呼叫的選單)
    document.addEventListener('contextmenu', event => event.preventDefault());

    // 2. 阻擋 iOS Safari 的橡皮筋邊緣回彈效果 (Overscroll)
    document.body.addEventListener('touchmove', function(e) {
        if (e.target.tagName !== 'INPUT' && !e.target.closest('.custom-scrollbar')) {
            e.preventDefault();
        }
    }, { passive: false });
});