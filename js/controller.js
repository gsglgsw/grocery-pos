class PosController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.barcodeBuffer = '';
        this.lastKeystrokeTime = Date.now();
        this.isModalOpen = false;
        this.repayState = { customerId: null, customerName: null, maxDebt: 0, currentInput: '' };
        // 🚀 新增：初始化發送端廣播頻道 (與顧客端對接)
        this.posChannel = new BroadcastChannel('pos_sync_channel');
        this.init();
    }

    async init() {
        this.initViewToggle();
        this.view.bindCartActions(this.handleUpdateQty.bind(this));
        this.view.bindQuickKeys(this.handleQuickKey.bind(this));
        this.view.bindNumpadActions(this.handleNumpadInput.bind(this));
        this.view.bindTenderActions(this.handleTenderTop.bind(this), this.handleTenderBottom.bind(this));

        this.view.bindCheckoutAction(this.handleCashCheckout.bind(this));
        this.view.bindLedgerCheckoutAction(this.triggerLedgerFlow.bind(this));
        this.view.bindCloseModalAction(this.handleCloseModal.bind(this));
        this.view.bindClearCartAction(this.handleClearCart.bind(this));

        // 🚀 Phase 7：綁定顧客卡片編輯與刪除行為
        this.view.bindCustomerCRMActions(
            this.handleEditCustomer.bind(this),
            this.handleDeleteCustomer.bind(this)
        );

        // 🚀 更新：傳入相機啟動與停止的控制邏輯
        this.view.bindProductManagerActions(
            this.handleSearchProduct.bind(this), 
            this.handleSaveProduct.bind(this),
            this.handleSyncProducts.bind(this),
            
            this.startCameraScanner.bind(this),
            this.stopCameraScanner.bind(this)
        );

        this.view.bindConfirmMenuActions({
            onCustom: () => { this.handleQuickKey('9990000000001'); this.view.hideConfirmMenu(); },
            onEgg: () => { this.handleQuickKey('9990000000002'); this.view.hideConfirmMenu(); },
            onCash: () => { this.view.hideConfirmMenu(); this.handleCashCheckout(); },
            onCancel: () => { this.view.hideConfirmMenu(); },
            onLedger: () => { this.view.hideConfirmMenu(); this.triggerLedgerFlow(); }
        });

        this.view.bindCustomerModalActions(
            this.handleCreditCheckout.bind(this),
            () => { this.view.hideCustomerModal(); this.isModalOpen = false; },
            this.handleAddCustomer.bind(this)
        );

        this.view.bindOpenRepayAction(this.openRepayModal.bind(this));
        this.view.bindRepayActions({
            onNumpad: this.handleRepayNumpad.bind(this),
            onFullRepay: () => {
                this.repayState.currentInput = this.repayState.maxDebt.toString();
                this.view.renderRepayNumpad(this.repayState.currentInput);
            },
            onCancel: () => { this.view.hideRepayModal(); },
            onConfirm: this.executeRepayment.bind(this)
        });

        this.view.bindOpenHistoryAction(this.openHistoryModal.bind(this));
        // 🚀 整合 Phase 7：綁定賒帳本內的獨立新增顧客按鈕
        this.view.bindAddCustomerLedgerAction(this.handleAddCustomerLedger.bind(this));
        this.view.bindAuditFilterActions(this.loadAuditToday.bind(this), this.loadAuditYesterday.bind(this), this.loadAuditCustomDate.bind(this));

        this._initSystemPruning();
        await this.model.initProductsDB();
        

        this.initScannerListener();
        this.model.loadCartBackup();
        this.updateView();
    }

async handleSyncProducts() {
        try {
            const count = await this.model.syncProductsFromCloud();
            alert(`✅ 同步完成！已成功從雲端下載並更新 ${count} 筆商品資料。`);
            this.updateView(); // 刷新畫面，套用可能的價格變動
        } catch (error) {
            alert(`❌ 同步失敗，請檢查網路連線或 API 設定。\n錯誤訊息：${error.message}`);
        }
    }

    _initSystemPruning() {
        this.model.autoPruneData(20, 50);
        const today = new Date();
        const past20 = new Date();
        past20.setDate(today.getDate() - 20);
        const todayStr = this._formatDateStr(today);
        const past20Str = this._formatDateStr(past20);
        this.view.setAuditDateInput(todayStr, past20Str, todayStr);
    }

    handleClearCart() {
        if (this.model.cart.length === 0) return;
        if (window.confirm('確定要清空目前的結帳清單嗎？\n(注意：此動作無法復原)')) { this.model.clearAll(); this.updateView(); }
    }

    initViewToggle() {
        this.view.btnGoLedger.addEventListener('click', async () => {
            const ledgers = await this.model.getLedgerSummary();
            this.view.renderLedgerList(ledgers);
            this.view.checkoutView.classList.add('hidden');
            this.view.ledgerView.classList.remove('hidden');
            this.view.ledgerView.classList.add('flex');
        });
        this.view.btnBackCheckout.addEventListener('click', () => { this.view.ledgerView.classList.add('hidden'); this.view.ledgerView.classList.remove('flex'); this.view.checkoutView.classList.remove('hidden'); });
        
        this.view.btnGoAudit.addEventListener('click', async () => { 
            await this.loadAuditToday(); 
            this.view.checkoutView.classList.add('hidden'); 
            this.view.auditView.classList.remove('hidden'); 
            this.view.auditView.classList.add('flex'); 
        });
        this.view.btnBackCheckoutAudit.addEventListener('click', () => { this.view.auditView.classList.add('hidden'); this.view.auditView.classList.remove('flex'); this.view.checkoutView.classList.remove('hidden'); });
    }

    async handleAddCustomer() {
        const name = prompt('請輸入新顧客的姓名或暱稱：\n(例如：王阿姨, 轉角麵攤)');
        if (!name || name.trim() === '') return;
        try {
            const newCustomer = await this.model.createNewCustomer(name.trim());
            const customers = await this.model.getAllCustomers();
            this.view.showCustomerModal(customers);
            alert(`✅ 已成功新增常客：${newCustomer.name}`);
        } catch (error) {
            alert('新增失敗，請聯絡系統管理員。');
        }
    }
// 🚀 整合 Phase 7：獨立新增顧客並直接刷新賒帳本畫面
    async handleAddCustomerLedger() {
        const name = prompt('請輸入新顧客的姓名或暱稱：\n(例如：王阿姨, 轉角麵攤)');
        
        // 防呆：如果按取消，或沒有輸入文字，就直接終止
        if (!name || name.trim() === '') return;

        try {
            // 1. 寫入資料庫
            const newCustomer = await this.model.createNewCustomer(name.trim());

            // 2. 重新撈取名單並刷新賒帳本畫面
            const ledgers = await this.model.getLedgerSummary();
            this.view.renderLedgerList(ledgers);

            // 3. UX 反饋
            alert(`✅ 已成功建立顧客檔案：${newCustomer.name}\n(現在可以開始為他進行掛帳了)`);

        } catch (error) {
            alert('新增失敗，請聯絡系統管理員。');
            console.error(error);
        }
    }

    openRepayModal(dataset) {
        this.repayState = { customerId: dataset.id, customerName: dataset.name, maxDebt: parseInt(dataset.debt, 10), currentInput: '' };
        this.view.showRepayModal(this.repayState);
    }

    handleRepayNumpad(val) {
        if (val === 'C') { this.repayState.currentInput = ''; } else { if (this.repayState.currentInput.length < 6) this.repayState.currentInput += val; }
        const inputNum = parseInt(this.repayState.currentInput, 10);
        if (inputNum > this.repayState.maxDebt) this.repayState.currentInput = this.repayState.maxDebt.toString();
        this.view.renderRepayNumpad(this.repayState.currentInput);
    }

    async executeRepayment() {
        const repayAmount = parseInt(this.repayState.currentInput, 10);
        if (isNaN(repayAmount) || repayAmount <= 0) { alert('請輸入有效還款金額'); return; }
        const isFullRepay = repayAmount === this.repayState.maxDebt;
        const confirmMsg = isFullRepay ? `⚠️ 警告：您即將「全額結清」 ${this.repayState.customerName} 的欠款 $${repayAmount}。\n\n確定要執行嗎？(收銀台已確實收到款項)` : `確認要為 ${this.repayState.customerName} 紀錄還款 $${repayAmount} 嗎？`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await this.model.updateLedgerDebt({ id: this.repayState.customerId, name: this.repayState.customerName }, repayAmount, 'PAY');
            this.view.hideRepayModal();
            const ledgers = await this.model.getLedgerSummary();
            this.view.renderLedgerList(ledgers);
            alert(`✅ 已成功紀錄還款 $${repayAmount}`);
        } catch (error) {
            alert('還款處理失敗，請重試。');
        }
    }

    async openHistoryModal(customerId) {
        const ledgerRecord = await this.model.getCustomerLedger(customerId);
        if (ledgerRecord) { this.view.showHistoryModal(ledgerRecord); } else { alert('無法讀取該顧客資料'); }
    }

    async triggerLedgerFlow() {
        const cartReport = this.model.calculateCart();
        if (cartReport.totalAmount === 0 && this.model.cart.length === 0) return; 
        this.isModalOpen = true;
        const customers = await this.model.getAllCustomers();
        this.view.showCustomerModal(customers);
    }

    handleTenderTop(amount) { this.model.addTenderAmount(amount); this.updateNumpadView(); }
    handleTenderBottom(amount) { this.model.toggleTailAmount(amount); this.updateNumpadView(); }
    
    updateNumpadView() { 
        this.view.renderNumpad(this.model.numpadBuffer); 
        const currentTotal = this.model.calculateCart().totalAmount;
        const tenders = this.model.getSmartTenders(currentTotal); 
        this.view.renderTenders(tenders, this.model.activeTail); 
    }
    
    handleNumpadInput(val) { if (val === 'C') { this.model.clearNumpad(); } else if (val === '確認') { this.view.showConfirmMenu(); return; } else { this.model.appendNumpad(val); } this.updateNumpadView(); }

    // 🚀 升級：處理現金結帳，並廣播找零畫面
    handleCashCheckout() {
        const result = this.model.processCheckout();
        if (!result.success) {
            if (result.reason === 'empty_cart') return;
            if (result.reason === 'insufficient_funds') { this.view.showNumpadError(); return; }
        }
        
        this.isModalOpen = true;
        this.view.showChangeModal(result.change);

        // 📡 廣播：通知顧客端顯示找零大畫面
        this.posChannel.postMessage({
            action: 'SHOW_CHANGE',
            data: { change: result.change }
        });
    }

    async handleCreditCheckout(customer) {
        try {
            this.model.lastCheckoutState = { tendered: 0, change: 0 };
            await this.model.saveTransaction('CREDIT', customer);
            this.view.hideCustomerModal();
            this.isModalOpen = false;
            this.model.clearAll();
            this.updateView();
            setTimeout(() => alert('掛帳成功！已同步至顧客帳本。'), 100);
        } catch (error) {
            alert('掛帳失敗：資料庫寫入異常。');
        }
    }

    async handleCloseModal() {
        try {
            await this.model.saveTransaction('CASH');
            this.isModalOpen = false;
            this.model.clearAll();
            this.view.hideChangeModal();
            this.updateView();
        } catch (error) {
            alert('系統錯誤：資料寫入失敗，請勿關閉網頁並通知管理員。');
        }
    }

    initScannerListener() {
        const SCANNER_TIMEOUT_MS = 1000; // 給長輩手動輸入 1 秒鐘的緩衝

        document.addEventListener('keydown', (e) => {
            if (e.isComposing || e.keyCode === 229) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || this.isModalOpen) return;
            
            const now = Date.now();
            if (now - this.lastKeystrokeTime > SCANNER_TIMEOUT_MS) {
                this.barcodeBuffer = ''; 
                this.view.renderBarcodeBuffer(this.barcodeBuffer);
                this.view.hideSearchSuggestions();
            }
            this.lastKeystrokeTime = now;
            
            if (e.key === 'Enter') {
                if (this.barcodeBuffer.length > 2) this.processBarcode(this.barcodeBuffer);
                this.barcodeBuffer = '';
                this.view.renderBarcodeBuffer(this.barcodeBuffer);
                this.view.hideSearchSuggestions();
                e.preventDefault();
            } else if (e.key === 'Backspace') {
                if (this.barcodeBuffer.length > 0) {
                    this.barcodeBuffer = this.barcodeBuffer.slice(0, -1);
                    this.view.renderBarcodeBuffer(this.barcodeBuffer);
                    this._triggerSmartSearch(this.barcodeBuffer); 
                }
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
                this.barcodeBuffer += e.key;
                this.view.renderBarcodeBuffer(this.barcodeBuffer);
                this._triggerSmartSearch(this.barcodeBuffer); 
            }
        });

        if (this.view.inputBarcodeSearch) {
            this.view.inputBarcodeSearch.addEventListener('input', (e) => { this._triggerSmartSearch(e.target.value); });
            this.view.inputBarcodeSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (!this.view.searchSuggestions.classList.contains('hidden')) e.preventDefault();
                    const val = e.target.value.trim();
                    if (val.length > 2) {
                        this.processBarcode(val);
                        e.target.value = ''; 
                        this.view.hideSearchSuggestions();
                    }
                }
            });
            this.view.bindSuggestionClick((barcode) => {
                this.processBarcode(barcode);
                this.view.inputBarcodeSearch.value = ''; 
                this.view.hideSearchSuggestions();
                this.barcodeBuffer = ''; 
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#input-barcode-search') && !e.target.closest('#search-suggestions')) { this.view.hideSearchSuggestions(); }
            });
        }
    }

    async _triggerSmartSearch(keyword) {
        const cleanKeyword = keyword.trim();
        if (cleanKeyword.length > 0) {
            const suggestions = await this.model.searchProductsByKeyword(cleanKeyword, 3);
            this.view.renderSearchSuggestions(suggestions);
        } else {
            this.view.hideSearchSuggestions();
        }
    }

    // 🚀 關鍵修復：補回被遺漏的 processBarcode 函式
    async processBarcode(barcode) { 
        await this.processProductEntry(barcode); 
    }

    // 🚀 關鍵修復：升級降級機制的 UX，使用原生 Prompt 直接詢問價格
    async processProductEntry(barcode) {
        let result = await this.model.addToCart(barcode);
        
        if (!result.success && result.reason === 'unknown_barcode') {
            const priceStr = prompt(`📦 發現未建檔商品！\n條碼: ${result.barcode}\n\n請直接輸入此商品的「售價」(純數字)：`);
            if (priceStr === null || priceStr.trim() === '') return; 
            const customPrice = parseInt(priceStr, 10);
            if (isNaN(customPrice) || customPrice < 0) {
                alert('❌ 金額輸入錯誤，請重新操作。');
                return;
            }
            await this.model.addToCart(result.barcode, customPrice, true);
            this.updateView();
            return;
        }
        if (result.success) { this.updateView(); }
    }

    handleUpdateQty(index, change) { 
        const currentQty = this.model.cart[index].qty; 
        this.model.updateQty(index, currentQty + change); 
        this.updateView(); 
    }

async handleQuickKey(barcode) {
        const product = await this.model.getProduct(barcode);
        
        // 🚀 Tech Lead 防呆：如果資料庫完全找不到該快捷商品，絕對不能默默失敗！
        if (!product) {
            alert(`❌ 系統錯誤：找不到快捷商品檔案 (條碼: ${barcode})！\n這通常是因為資料庫被清空，請重新整理網頁讓系統重建預設檔案。`);
            return;
        }

        let customPrice = null;
        if (product && product.isOpenPrice) {
            customPrice = this.model.getNumpadValue();
            if (customPrice === null) { 
                this.view.showNumpadError(); 
                return; 
            }
        }
        
        const result = await this.model.addToCart(barcode, customPrice);
        if (result.success) { 
            this.model.clearNumpad(); 
            this.updateView(); 
        }
    }

    // 🚀 升級：更新視圖邏輯，並同步廣播給顧客端
    updateView() {
        const cartReport = this.model.calculateCart();
        this.view.renderCart(cartReport.evaluatedItems);
        this.view.renderTotal(cartReport.totalAmount, cartReport.totalCount, cartReport.totalDiscount);
        this.updateNumpadView();

        // 📡 廣播：將最新的購物車結算報告發送給顧客螢幕
        // 💡 巧思：當購物車被清空時，cartReport.evaluatedItems 為空陣列，
        // 顧客端收到後會自動觸發 clearScreen() 恢復歡迎畫面，符合 DRY 原則！
        this.posChannel.postMessage({
            action: 'UPDATE_CART',
            data: cartReport
        });
    }

    _formatDateStr(dateObj) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    }

    async loadAuditToday() {
        const todayStr = this._formatDateStr(new Date());
        this.view.setAuditDateInput(todayStr); 
        await this._loadAuditData(todayStr);
    }

    async loadAuditYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1); 
        const yesterdayStr = this._formatDateStr(yesterday);
        this.view.setAuditDateInput(yesterdayStr);
        await this._loadAuditData(yesterdayStr);
    }

    async loadAuditCustomDate(dateStr) {
        if (!dateStr) return; 
        await this._loadAuditData(dateStr);
    }

    async _loadAuditData(dateStr) {
        const orders = await this.model.getTransactionHistory(dateStr);
        this.view.renderAuditList(orders, dateStr);
    }

    async handleSearchProduct(barcode) {
        const product = await this.model.getProduct(barcode);
        if (product) {
            this.view.fillProductForm(product);
            alert(`✅ 找到商品：${product.name}，可直接進行修改。`);
        } else {
            alert(`ℹ️ 資料庫無此商品，請建立新檔案。`);
        }
    }

    // 🚀 新增：處理商品儲存邏輯
    async handleSaveProduct(productData, closeCallback) {
        if (!productData.barcode || !productData.name) {
            alert('❌ 儲存失敗：請務必填寫「商品條碼」與「商品名稱」');
            return;
        }

        const result = await this.model.saveProduct(productData);
        if (result.success) {
            alert(`✅ 成功建檔：${productData.name}\n(系統已自動將其加入搜尋預覽資料庫)`);
            closeCallback(); 
            
            // 🚀 關鍵修復：存檔後強制更新視圖！
            // 這會重新觸發 calculateCart 演算法，並讓購物車裡的商品瞬間套用新的價格與促銷！
            this.updateView(); 
        } else {
            alert(`❌ 儲存發生錯誤：${result.message}`);
        }
    }

    // 🚀 Phase 7：處理編輯顧客姓名
    async handleEditCustomer(customerId, currentName) {
        const newName = prompt(`修改顧客名稱：\n原名稱：${currentName}`, currentName);
        if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

        try {
            await this.model.updateCustomerName(customerId, newName.trim());
            const ledgers = await this.model.getLedgerSummary();
            this.view.renderLedgerList(ledgers);
            alert(`✅ 顧客名稱已更新為：${newName.trim()}`);
        } catch (error) {
            alert(`❌ 更新失敗：${error.message}`);
        }
    }

    // 🚀 Phase 7：處理軟刪除顧客 (具備嚴格欠款檢查機制)
    async handleDeleteCustomer(customerId, name, debt) {
        if (debt > 0) {
            alert(`⚠️ 無法刪除：顧客「${name}」目前尚有 $${debt} 欠款未結清！\n請先辦理還款結清後再進行刪除。`);
            return;
        }

        if (!window.confirm(`⚠️ 確定要隱藏顧客「${name}」的卡片嗎？\n(歷史交易紀錄仍會保留在每日查帳中)`)) return;

        try {
            await this.model.deleteCustomer(customerId);
            const ledgers = await this.model.getLedgerSummary();
            this.view.renderLedgerList(ledgers);
            alert(`✅ 已成功移除顧客卡片：${name}`);
        } catch (error) {
            alert(`❌ 刪除失敗：${error.message}`);
        }
    }

    // 🚀 實作相機掃描核心邏輯
    startCameraScanner() {
        // 確保不會重複啟動
        if (this.html5QrcodeScanner) {
            this.stopCameraScanner();
        }

        // 初始化掃描器，指定綁定到 view 上的 div ID
        this.html5QrcodeScanner = new Html5Qrcode("camera-reader");
        
        // 設定掃描參數 (使用後鏡頭，更新率 10fps 節省效能)
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };

        this.html5QrcodeScanner.start(
            { facingMode: "environment" }, // 強制使用後置鏡頭
            config,
            (decodedText, decodedResult) => {
                // 掃描成功的回呼函式
                console.log(`[系統] 相機掃描成功: ${decodedText}`);
                
                // 1. 嗶一聲 (UX 體驗)
                this._playBeepSound();
                
                // 2. 將條碼填入 input
                this.view.inputProdBarcode.value = decodedText;
                
                // 3. 自動停止相機與隱藏 UI
                this.stopCameraScanner();
                this.view.cameraReaderContainer.classList.add('hidden');
                this.view.cameraReaderContainer.classList.remove('flex');
                
                // 4. 自動觸發搜尋
                this.handleSearchProduct(decodedText);
            },
            (errorMessage) => {
                // 掃描進行中的背景錯誤 (略過，因為每秒會失敗十幾次是正常的)
            }
        ).catch((err) => {
            console.error("[系統] 無法啟動相機:", err);
            alert("無法啟動相機，請檢查瀏覽器權限設定。");
        });
    }

    stopCameraScanner() {
        if (this.html5QrcodeScanner && this.html5QrcodeScanner.isScanning) {
            this.html5QrcodeScanner.stop().then(() => {
                console.log("[系統] 相機已停止");
                this.html5QrcodeScanner.clear();
                this.html5QrcodeScanner = null;
            }).catch(err => {
                console.error("[系統] 停止相機時發生錯誤:", err);
            });
        }
    }

    // 輕量化系統提示音 (使用 Web Audio API，無需外部音檔)
    _playBeepSound() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 800; // 頻率 800Hz
        gainNode.gain.setValueAtTime(1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); // 0.1 秒後淡出
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }

}