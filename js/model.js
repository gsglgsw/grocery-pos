class PosModel {
    constructor() {
        this.cart = [];
        this.lastScan = { barcode: '', timestamp: 0 };
        this.DEBOUNCE_TIME = POS_CONFIG.DEBOUNCE_TIME;
        this.customItemSequence = 0;
        this.numpadBuffer = '';
        this.activeTail = null;
        this.lastCheckoutState = null;

        this.dbOrders = localforage.createInstance({ name: POS_CONFIG.STORE_NAME, storeName: 'orders' });
        this.dbLedger = localforage.createInstance({ name: POS_CONFIG.STORE_NAME, storeName: 'ledger' });
        // 🚀 新增：商品資料庫
        this.dbProducts = localforage.createInstance({ name: POS_CONFIG.STORE_NAME, storeName: 'products' });
        
        // 確保以下四個 IndexedDB 都有被正確宣告與實體化
        this.dbProducts = localforage.createInstance({ name: 'dbProducts' });
        this.dbOrders = localforage.createInstance({ name: 'dbOrders' });
        this.dbLedger = localforage.createInstance({ name: 'dbLedger' });
        
        // 🚀 核心修復：補上遺漏的顧客資料庫實體宣告
        this.dbCustomers = localforage.createInstance({ name: 'dbCustomers' });
    }

    _getUnifiedDisplayTime() {
        const date = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const YYYY = date.getFullYear();
        const MM = pad(date.getMonth() + 1);
        const DD = pad(date.getDate());
        const HH = pad(date.getHours());
        const mm = pad(date.getMinutes());
        const ss = pad(date.getSeconds());
        return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`; // 保證輸出 2026-07-27 18:06:15
    }

   // ==========================================
    // 📦 商品資料庫 (dbProducts) 核心邏輯
    // ==========================================

    // 🚀 初始化商品庫 (若為空，則寫入 localDB 種子資料)
    async initProductsDB() {
        try {
            const keys = await this.dbProducts.keys();
            if (keys.length === 0) {
                console.log('[系統] 偵測到空的商品庫，正在寫入初始種子資料...');
                for (const [barcode, data] of Object.entries(this.localDB)) {
                    await this.dbProducts.setItem(barcode, { barcode: barcode, ...data });
                }
            }
        } catch (error) {
            console.error('[系統] 初始化商品庫失敗:', error);
        }
    }

   // 🚀 讀取單一商品 (用於掃描結帳)
    async getProduct(barcode) {
        try {
            return await this.dbProducts.getItem(barcode);
        } catch (error) {
            console.error(`[系統] 讀取商品 ${barcode} 失敗:`, error);
            return null;
        }
    }
    // 🚀 儲存或更新商品資料 (包含未來的促銷規則)
    async saveProduct(productData) {
        try {
            // 防禦性編程：嚴格檢查必填欄位
            if (!productData.barcode || !productData.name || productData.price === undefined) {
                throw new Error('缺少必填欄位 (條碼、名稱或售價)');
            }
            
            // 1. 寫入本地端 IndexedDB (保證離線可用)
            await this.dbProducts.setItem(productData.barcode, productData);
            
            // 2. 狀態同步：更新購物車內現有商品的快取屬性
            this.cart.forEach(item => {
                if (item.barcode === productData.barcode) {
                    item.name = productData.name;
                    item.price = productData.price;
                    item.promotions = productData.promotions || [];
                    item.promoStrategy = productData.promoStrategy || 'BEST';
                }
            });

            // 3. 🚀 雲端同步：發動非同步背景請求，將商品上傳至 Google Sheets
            // 注意：不使用 await，讓它在背景執行 (Fire-and-Forget)，絕對不卡住長輩的 UI 畫面
            this._backgroundSync('SAVE_PRODUCT', productData);
            
            return { success: true };
        } catch (error) {
            console.error('[系統] 儲存商品失敗:', error);
            return { success: false, message: error.message };
        }
    }
    // 🚀 新增：資料庫背景自動瘦身防爆機制
    async autoPruneData(daysToKeep = 20, historyToKeep = 50) {
        console.log('[系統] 啟動背景資料瘦身機制...');
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

        try {
            // 1. 隔離清理：瘦身 dbOrders (超過 20 天的訂單徹底刪除)
            const orderKeysToRemove = [];
            await this.dbOrders.iterate((value, key) => {
                if (value.timestamp < cutoffTime) {
                    orderKeysToRemove.push(key);
                }
            });
            for (const key of orderKeysToRemove) {
                await this.dbOrders.removeItem(key);
            }
            if (orderKeysToRemove.length > 0) console.log(`[系統] 釋放空間：已清除 ${orderKeysToRemove.length} 筆過期訂單。`);

            // 2. 精準裁切：瘦身 dbLedger (絕對不刪除顧客，只裁切過長歷史)
            const ledgerUpdates = {};
            await this.dbLedger.iterate((record, key) => {
                if (record && record.history && record.history.length > historyToKeep) {
                    record.history = record.history.slice(-historyToKeep);
                    ledgerUpdates[key] = record;
                }
            });
            for (const [key, record] of Object.entries(ledgerUpdates)) {
                await this.dbLedger.setItem(key, record);
            }
            if (Object.keys(ledgerUpdates).length > 0) console.log(`[系統] 效能優化：已裁切 ${Object.keys(ledgerUpdates).length} 位顧客的歷史紀錄。`);

        } catch (error) {
            console.error('[系統] 資料瘦身執行失敗，請通知管理員:', error);
        }
    }
    // (將這段新增在 model.js 的 class 內部)
    // 🚀 新增：非同步背景同步方法 (Fire-and-Forget)
    _backgroundSync(action, payload) {
        if (!POS_CONFIG.GAS_API_URL) {
            console.warn('[系統] 未設定 GAS_API_URL，略過雲端備份。');
            return;
        }
        try {
            // 注意：這裡我們刻意不使用 await，讓它在背景慢慢跑，不阻塞前端 UI
            fetch(POS_CONFIG.GAS_API_URL, {
                method: 'POST',
                // 技巧：不宣告 Content-Type 為 application/json，避開瀏覽器嚴格的 CORS 預檢請求
                body: JSON.stringify({ action: action, data: payload })
            }).then(res => res.json())
                .then(result => {
                    if (result.status === 'error') console.error('[雲端同步異常]', result.message);
                })
                .catch(err => console.error('[雲端網路連線失敗]', err));
        } catch (error) {
            console.error('[雲端同步執行階段錯誤]', error);
        }
    }

    appendNumpad(char) { this.activeTail = null; if (this.numpadBuffer.length < 6) this.numpadBuffer += char; }
    clearNumpad() { this.numpadBuffer = ''; this.activeTail = null; }
    getNumpadValue() { return this.numpadBuffer === '' ? null : parseInt(this.numpadBuffer, 10); }
    addTenderAmount(amount) { let current = parseInt(this.numpadBuffer || 0, 10); this.numpadBuffer = (current + amount).toString(); }
    toggleTailAmount(amount) {
        let current = parseInt(this.numpadBuffer || 0, 10);
        if (this.activeTail === amount) {
            let newVal = current - amount; this.numpadBuffer = newVal > 0 ? newVal.toString() : ''; this.activeTail = null;
        } else { if (this.activeTail !== null) current -= this.activeTail; this.numpadBuffer = (current + amount).toString(); this.activeTail = amount; }
    }

    // 🚀 升級：智慧商品搜尋引擎 (正式對接 dbProducts，解決資料未綁定問題)
    async searchProductsByKeyword(keyword, limit = 3) {
        if (!keyword || keyword.trim() === '') return [];
        const lowerKeyword = keyword.toLowerCase();
        const results = [];
        
        try {
            // 遍歷真實的 IndexedDB 商品庫
            await this.dbProducts.iterate((product, barcode) => {
                const safeName = product.name || '';
                if (barcode.toLowerCase().includes(lowerKeyword) || safeName.toLowerCase().includes(lowerKeyword)) {
                    // 略過系統保留商品 (例如 999 開頭的自訂商品)
                    if (!barcode.startsWith('999')) {
                        results.push({ barcode, name: product.name, price: product.price });
                    }
                }
            });
        } catch (error) {
            console.error('[系統] 搜尋商品失敗:', error);
        }
        
        return results.slice(0, limit); // 只回傳前 N 筆
    }
   // 🚀 升級：非同步購物車加入邏輯 (快取促銷規則) + 觸發自動備份
    async addToCart(barcode, customPrice = null, isFallback = false) {
        const now = Date.now();
        if (this.lastScan.barcode === barcode && (now - this.lastScan.timestamp) < this.DEBOUNCE_TIME) return { success: false, reason: 'debounce' };
        this.lastScan = { barcode: barcode, timestamp: now };

        let product;
        if (isFallback) {
            product = { name: `未知商品 (${barcode})`, price: customPrice || 0, isOpenPrice: true, isCustom: true, promotions: [] };
        } else {
            product = await this.getProduct(barcode);
        }
        
        if (!product) return { success: false, reason: 'unknown_barcode', barcode: barcode };

        if (product.isCustom) {
            this.customItemSequence++;
            // 🚀 快取空的 promotions
            this.cart.push({ barcode: `${barcode}_${this.customItemSequence}`, name: `${product.name}${this.customItemSequence}`, price: customPrice || 0, qty: 1, isNegative: false, promotions: [] });
            
            this._autoSaveCart(); // 🛡️ 觸發防護網備份
            return { success: true };
        }
        
        const existingItem = this.cart.find(item => item.barcode === barcode);
        if (existingItem && !product.isOpenPrice) { 
            existingItem.qty += 1;
       } else { 
            this.cart.push({ 
                barcode: barcode, 
                name: product.name, 
                price: product.isOpenPrice ? customPrice : product.price, 
                qty: 1, 
                isNegative: (product.price || 0) < 0,
                promotions: product.promotions || [],
                promoStrategy: product.promoStrategy || 'BEST'
            }); 
        }
        
        this._autoSaveCart(); // 🛡️ 觸發防護網備份
        return { success: true };
    }

    // 🚀 更新數量時，也必須觸發備份
    updateQty(index, newQty) { 
        if (newQty <= 0) {
            this.cart.splice(index, 1); 
        } else {
            this.cart[index].qty = newQty; 
        }
        this._autoSaveCart(); // 🛡️ 觸發防護網備份
    }

    // 🚀 新增：核心結帳演算法引擎 (Promotion Engine)
    // 🚀 新增：單一促銷規則運算模組 (具備台式折數智慧轉換)
    _calcSinglePromo(qty, unitPrice, currentTotal, promo) {
        const conditionQty = parseInt(promo.qty) || 0;
        const conditionVal = parseFloat(promo.val) || 0;
        if (qty < conditionQty || conditionQty <= 0) return { discount: 0, text: '' };

        if (promo.type === 'QTY_PRICE') {
            const bundleCount = Math.floor(qty / conditionQty);
            const remainder = qty % conditionQty;
            const newTotal = (bundleCount * conditionVal) + (remainder * unitPrice);
            const discount = currentTotal - newTotal;
            return { discount: discount > 0 ? discount : 0, text: `✨ 滿${conditionQty}件特價$${conditionVal}` };
            
        } else if (promo.type === 'QTY_DISCOUNT') {
            // 🚀 智慧折數轉換演算法 (UX 防呆)
            // 如果輸入 5 -> 視為 50% (5折)
            // 如果輸入 8 -> 視為 80% (8折)
            // 如果輸入 85 -> 視為 85% (85折)
            let rate, display;
            if (conditionVal >= 10) {
                rate = conditionVal / 100;
                display = (conditionVal % 10 === 0) ? `${conditionVal / 10}折` : `${conditionVal}折`;
            } else {
                rate = conditionVal / 10;
                display = `${conditionVal}折`;
            }
            
            const discount = Math.round(currentTotal * (1 - rate));
            return { discount: discount > 0 ? discount : 0, text: `✨ 滿${conditionQty}件打${display}` };
        }
        return { discount: 0, text: '' };
    }

    // 🚀 升級：具備 STACK (合併) 與 BEST (擇優) 策略的結帳引擎
    calculateCart() {
        let totalAmount = 0;
        let totalDiscount = 0;
        let totalCount = 0;

        const evaluatedCart = this.cart.map(item => {
            const originalTotal = item.price * item.qty;
            let currentTotal = originalTotal;
            let appliedPromos = [];
            let totalItemDiscount = 0;
            totalCount += item.qty;

            if (item.promotions && item.promotions.length > 0 && !item.isNegative) {
                // 過濾掉未設定的空白優惠
                const validPromos = item.promotions.filter(p => p.type !== 'NONE' && item.qty >= (parseInt(p.qty)||0) && (parseInt(p.qty)||0) > 0);

                if (validPromos.length > 0) {
                    if (item.promoStrategy === 'BEST') {
                        // 策略一：擇優計算 (各自算出折扣，挑最便宜的)
                        let bestDiscount = 0;
                        let bestPromoText = '';
                        validPromos.forEach(promo => {
                            const res = this._calcSinglePromo(item.qty, item.price, originalTotal, promo);
                            if (res.discount > bestDiscount) {
                                bestDiscount = res.discount;
                                bestPromoText = res.text;
                            }
                        });
                        if (bestDiscount > 0) {
                            totalItemDiscount = bestDiscount;
                            appliedPromos.push({ text: bestPromoText, discount: bestDiscount });
                        }
                    } else {
                        // 策略二：合併計算 (標準零售業 STACK 邏輯：特價優先算，打折再疊加)
                        // 排序：確保 QTY_PRICE (特價) 永遠比 QTY_DISCOUNT (打折) 先執行
                        validPromos.sort((a, b) => a.type === 'QTY_PRICE' ? -1 : 1);
                        
                        validPromos.forEach(promo => {
                            // 注意：每一次疊加，都是用「上一個扣完的金額 (currentTotal)」繼續算
                            const res = this._calcSinglePromo(item.qty, item.price, currentTotal, promo);
                            if (res.discount > 0) {
                                currentTotal -= res.discount;
                                totalItemDiscount += res.discount;
                                appliedPromos.push({ text: res.text, discount: res.discount });
                            }
                        });
                    }
                }
            }

            const itemFinalTotal = originalTotal - totalItemDiscount;
            totalAmount += itemFinalTotal;
            totalDiscount += totalItemDiscount;

            return { 
                ...item, 
                originalTotal, 
                itemFinalTotal, 
                itemDiscount: totalItemDiscount, 
                appliedPromos 
            };
        });

        return { evaluatedItems: evaluatedCart, totalAmount, totalDiscount, totalCount };
    }

    // 🚀 關鍵修復：改用 currentTotal 參數，或 fallback 使用 calculateCart
    getSmartTenders(currentTotal = null) {
        const total = currentTotal !== null ? currentTotal : this.calculateCart().totalAmount;
        if (total <= 0) return { top: [], bottom: [] };
        let b1 = (Math.ceil(total / 100) * 100) % 1000; let b2 = (Math.ceil(total / 50) * 50) % 1000; let b3 = total % 100; let b4 = (total + 5) % 100;
        return {
            top: [50, 100, 500, 1000],
            bottom: [{ val: b1, display: String(b1).padStart(3, '0') }, { val: b2, display: String(b2).padStart(3, '0') }, { val: b3, display: String(b3).padStart(2, '0') }, { val: b4, display: String(b4).padStart(2, '0') }]
        };
    }

   // 🚀 關鍵修復：捨棄 getTotal，改用 calculateCart().totalAmount
    processCheckout() {
        const total = this.calculateCart().totalAmount;
        if (total === 0) return { success: false, reason: 'empty_cart' };
        let tendered = this.getNumpadValue();
        if (tendered === null) tendered = total;
        if (tendered < total) return { success: false, reason: 'insufficient_funds' };
        this.lastCheckoutState = { tendered: tendered, change: tendered - total };
        return { success: true, change: tendered - total };
    }

    // 🚀 更新顧客帳本 (掛帳/還款)，並同步至雲端
    async updateLedgerDebt(customer, amount, type = 'CREDIT') {
        try {
            const timestamp = Date.now();
            const displayTime = this._getUnifiedDisplayTime();
            
            const ledgerRecord = {
                timestamp: timestamp,
                displayTime: displayTime,
                customerId: customer.id,
                customerName: customer.name,
                type: type, 
                amount: amount
            };

            // 1. 寫入帳本明細 (Transaction)
            await this.dbLedger.setItem(`LEDGER-${timestamp}`, ledgerRecord);

            // 2. 更新顧客總餘額 (Profile)
            const customerData = await this.dbCustomers.getItem(customer.id);
            if (customerData) {
                if (type === 'CREDIT') customerData.debt += amount;
                else if (type === 'PAY') customerData.debt = Math.max(0, customerData.debt - amount); // 防呆：欠款不能為負
                
                customerData.lastUpdate = timestamp; // 🚀 更新最後交易時間，供排序使用
                await this.dbCustomers.setItem(customer.id, customerData);
            }

            // 3. 雲端同步
            this._backgroundSync('UPDATE_LEDGER', ledgerRecord);
            return true;
        } catch (error) {
            console.error('[系統] 帳本更新失敗:', error);
            throw error;
        }
    }

    // 🚀 儲存交易紀錄 (支援現金 CASH 與掛帳 CREDIT)，並同步至雲端
    async saveTransaction(type = 'CASH', customer = null) {
        if (this.cart.length === 0) throw new Error('購物車是空的');

        const cartReport = this.calculateCart();
        const orderId = `ORD-${Date.now()}`;
        const timestamp = Date.now();
        const displayTime = this._getUnifiedDisplayTime();

        const orderData = {
            orderId: orderId,
            timestamp: timestamp,
            displayTime: displayTime,
            type: type,
            customerId: customer ? customer.id : null,
            customerName: customer ? customer.name : '一般顧客',
            totalAmount: cartReport.totalAmount,
            tendered: this.lastCheckoutState.tendered,
            change: this.lastCheckoutState.change,
            items: cartReport.evaluatedItems // 包含購買商品、數量、折扣明細
        };

        try {
            // 1. 寫入本地端 IndexedDB
            await this.dbOrders.setItem(orderId, orderData);

            // 2. 如果是掛帳，連動更新本地顧客帳本
            if (type === 'CREDIT' && customer) {
                await this.updateLedgerDebt(customer, cartReport.totalAmount, 'CREDIT');
            }

            // 3. 🚀 雲端同步：發動背景備份，將訂單上傳至 Google Sheets
            this._backgroundSync('SAVE_ORDER', orderData);

            return { success: true, orderId: orderId };
        } catch (error) {
            console.error('[系統] 訂單寫入失敗:', error);
            throw error;
        }
    }

    // 🚀 升級：加入 YYYY-MM-DD 的日期過濾參數
    async getTransactionHistory(dateStr = null) {
        try {
            const orders = [];
            await this.dbOrders.iterate((value) => {
                if (dateStr) {
                    // value.displayTime 格式為 "YYYY-MM-DD HH:mm:ss"
                    if (value.displayTime.startsWith(dateStr)) {
                        orders.push(value);
                    }
                } else {
                    orders.push(value); // 未傳入日期則全撈 (備用)
                }
            });
            // 依然依據時間戳由新到舊排序
            orders.sort((a, b) => b.timestamp - a.timestamp);
            return orders;
        } catch (error) {
            console.error('[系統] 讀取交易紀錄失敗:', error);
            return [];
        }
    }

    // 🚀 升級：撈取帳本名單 (實作未結清置頂演算法)
    async getLedgerSummary() {
        try {
            const ledgers = [];
            await this.dbCustomers.iterate((value) => {
                if (value && value.debt !== undefined && value.name) {
                    ledgers.push(value);
                }
            });

            // 💡 演算法：多權重排序
            ledgers.sort((a, b) => {
                // 權重 1：有欠款的 (debt > 0) 排前面
                if (a.debt > 0 && b.debt === 0) return -1;
                if (a.debt === 0 && b.debt > 0) return 1;
                // 權重 2：依據最後動作時間，越新的排越上面
                return (b.lastUpdate || 0) - (a.lastUpdate || 0);
            });

            return ledgers;
        } catch (error) {
            console.error('[系統] 讀取帳本總表失敗:', error);
            return [];
        }
    }

    // 🚀 升級：撈取所有顧客名單
    async getAllCustomers() {
        try {
            const customers = [];
            await this.dbCustomers.iterate((value) => {
                if (value && value.id && value.name && value.name.trim() !== '') {
                    customers.push({ id: value.id, name: value.name });
                }
            });
            return customers;
        } catch (error) {
            console.error('[系統] 讀取顧客名單失敗:', error);
            return [];
        }
    }

    // 🚀 新增：建立新顧客檔案 (嚴格寫入 dbCustomers)
    async createNewCustomer(name) {
        try {
            const customerId = `CUST-${Date.now()}`;
            const newCustomer = {
                id: customerId,
                name: name,
                debt: 0,
                isDeleted: false,
                lastUpdate: Date.now()
            };
            await this.dbCustomers.setItem(customerId, newCustomer);
            
            // 📡 同步至雲端 Customers 表
            this._backgroundSync('SAVE_CUSTOMER', newCustomer);
            
            return newCustomer;
        } catch (error) {
            console.error('[系統] 新增顧客失敗:', error);
            throw error;
        }
    }

    // 🚀 新增：撈取單一顧客的完整帳本紀錄 (Profile + History)
    async getCustomerLedger(customerId) {
        try {
            // 1. 取得顧客基本資料
            const customer = await this.dbCustomers.getItem(customerId);
            if (!customer) return null;

            // 2. 掃描明細表，撈出屬於該顧客的所有歷史紀錄
            const history = [];
            await this.dbLedger.iterate((record) => {
                if (record && record.customerId === customerId) {
                    history.push(record);
                }
            });

            // 3. 將歷史紀錄由新到舊排序
            history.sort((a, b) => b.timestamp - a.timestamp);

            // 4. 合併回傳
            return {
                ...customer,
                totalDebt: customer.debt, // 為了相容前端 View 的變數名稱
                history: history
            };
        } catch (error) {
            console.error('[系統] 讀取單一顧客帳本失敗:', error);
            return null;
        }
    }

    _formatDate(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    clearAll() {
        this.cart = [];
        this.numpadBuffer = '';
        this.activeTail = null;
        localStorage.removeItem('pos_cart_backup'); // 結帳完或手動清空時，刪除備份
    }

    // ----------------------------------------------------
    // 🚀 第三道防護：購物車自動備份機制 (Cart Auto-Backup)
    // ----------------------------------------------------
    _autoSaveCart() {
        // 將目前的購物車陣列轉為字串，瞬間寫入本機硬碟
        localStorage.setItem('pos_cart_backup', JSON.stringify(this.cart));
    }

    loadCartBackup() {
        const backup = localStorage.getItem('pos_cart_backup');
        if (backup) {
            try {
                this.cart = JSON.parse(backup);
                console.log('[系統] 成功還原上一筆未完成的結帳單！');
            } catch(e) {
                this.cart = [];
            }
        }
    }

    // 🚀 Phase 7：更新顧客基本資料 (更名)
    async updateCustomerName(customerId, newName) {
        try {
            const customer = await this.dbCustomers.getItem(customerId);
            if (!customer) throw new Error('找不到該顧客資料');
            
            customer.name = newName;
            customer.lastUpdate = Date.now();
            await this.dbCustomers.setItem(customerId, customer);
            
            // 📡 同步至雲端 Customers 表 (Upsert 覆蓋舊名)
            this._backgroundSync('SAVE_CUSTOMER', customer);
            
            return true;
        } catch (error) {
            console.error('[系統] 更新顧客姓名失敗:', error);
            throw error;
        }
    }

    // 🚀 Phase 7 新增：軟刪除/封存顧客 (Soft Delete)
    // 🛑 核心防呆：有欠款金額者絕對禁止刪除！
    // 🚀 Phase 7：軟刪除/封存顧客 (Soft Delete)
    async deleteCustomer(customerId) {
        try {
            const customer = await this.dbCustomers.getItem(customerId);
            if (!customer) throw new Error('找不到該顧客資料');
            if (customer.debt > 0) throw new Error('該顧客仍有欠款，無法刪除');

            customer.isDeleted = true;
            customer.lastUpdate = Date.now();
            await this.dbCustomers.setItem(customerId, customer);
            
            // 📡 同步至雲端 Customers 表 (將 isDeleted 標記為 TRUE)
            this._backgroundSync('SAVE_CUSTOMER', customer);
            
            return true;
        } catch (error) {
            console.error('[系統] 軟刪除顧客失敗:', error);
            throw error;
        }
    }

    // 🚀 Phase 8.1 新增：從雲端批量下載並覆蓋 IndexedDB
    async syncProductsFromCloud() {
        if (!POS_CONFIG.GAS_API_URL) throw new Error('未設定 API URL');
        try {
            // 發出 GET 請求抓取資料
            const response = await fetch(`${POS_CONFIG.GAS_API_URL}?action=FETCH_PRODUCTS`);
            const result = await response.json();
            
            if (result.status !== 'success') throw new Error(result.message);
            
            const products = result.data;
            if (!products || products.length === 0) return 0;

            // 採用批次寫入 (Batch Write) 提升效能
            for (const product of products) {
                await this.dbProducts.setItem(product.barcode, product);
            }
            
            return products.length; // 回傳成功更新的筆數
        } catch (error) {
            console.error('[系統] 雲端同步商品失敗:', error);
            throw error;
        }
    }

    // 🚀 升級：撈取帳本名單 (自動過濾被軟刪除 isDeleted 的顧客)
    async getLedgerSummary() {
        try {
            const ledgers = [];
            await this.dbCustomers.iterate((value) => {
                // 過濾掉已被軟刪除 (isDeleted === true) 的顧客
                if (value && value.debt !== undefined && value.name && !value.isDeleted) {
                    ledgers.push(value);
                }
            });

            ledgers.sort((a, b) => {
                if (a.debt > 0 && b.debt === 0) return -1;
                if (a.debt === 0 && b.debt > 0) return 1;
                return (b.lastUpdate || 0) - (a.lastUpdate || 0);
            });

            return ledgers;
        } catch (error) {
            console.error('[系統] 讀取帳本總表失敗:', error);
            return [];
        }
    }
}