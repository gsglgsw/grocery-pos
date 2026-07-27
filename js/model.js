class PosModel {
    constructor() {
        this.cart = [];
        this.lastScan = { barcode: '', timestamp: 0 };
        this.DEBOUNCE_TIME = POS_CONFIG.DEBOUNCE_TIME;
        this.customItemSequence = 0;
        this.numpadBuffer = '';
        this.activeTail = null;
        this.lastCheckoutState = null;

        // 🚀 Production 專用種子資料庫
        this.localDB = {
            '9990000000001': { name: '自訂商品', price: 0, isOpenPrice: true, isCustom: true },
            '9990000000002': { name: '秤重雞蛋', price: 0, isOpenPrice: true },
            'BOTTLE_RETURN': { name: '退公賣局空瓶', price: -5 }
        };

        this.dbProducts = localforage.createInstance({ name: POS_CONFIG.STORE_NAME, storeName: 'products' });
        this.dbOrders = localforage.createInstance({ name: POS_CONFIG.STORE_NAME, storeName: 'orders' });
        this.dbLedger = localforage.createInstance({ name: POS_CONFIG.STORE_NAME, storeName: 'ledger' });
        this.dbCustomers = localforage.createInstance({ name: POS_CONFIG.STORE_NAME, storeName: 'customers' });
    }

    _getUnifiedDisplayTime() {
        const date = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    async initProductsDB() {
        try {
            const keys = await this.dbProducts.keys();
            if (keys.length === 0) {
                console.log('[系統] 寫入初始種子資料...');
                for (const [barcode, data] of Object.entries(this.localDB)) {
                    await this.dbProducts.setItem(barcode, { barcode: barcode, ...data });
                }
            }
        } catch (error) {
            console.error('[系統] 初始化商品庫失敗:', error);
        }
    }

    async getProduct(barcode) {
        try {
            // 🛡️ 核心防禦：系統虛擬商品直接從記憶體讀取，絕不依賴 IndexedDB
            if (this.localDB && this.localDB[barcode]) {
                return { barcode: barcode, ...this.localDB[barcode] };
            }
            return await this.dbProducts.getItem(barcode);
        } catch (error) {
            console.error(`[系統] 讀取商品 ${barcode} 失敗:`, error);
            return null;
        }
    }

    async saveProduct(productData) {
        try {
            if (!productData.barcode || !productData.name || productData.price === undefined) {
                throw new Error('缺少必填欄位 (條碼、名稱或售價)');
            }
            await this.dbProducts.setItem(productData.barcode, productData);
            this.cart.forEach(item => {
                if (item.barcode === productData.barcode) {
                    item.name = productData.name;
                    item.price = productData.price;
                    item.promotions = productData.promotions || [];
                    item.promoStrategy = productData.promoStrategy || 'BEST';
                }
            });
            this._backgroundSync('SAVE_PRODUCT', productData);
            return { success: true };
        } catch (error) {
            console.error('[系統] 儲存商品失敗:', error);
            return { success: false, message: error.message };
        }
    }

    async autoPruneData(daysToKeep = 20, historyToKeep = 50) {
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        try {
            const orderKeysToRemove = [];
            await this.dbOrders.iterate((value, key) => {
                if (value.timestamp < cutoffTime) orderKeysToRemove.push(key);
            });
            for (const key of orderKeysToRemove) await this.dbOrders.removeItem(key);

            const ledgerUpdates = {};
            await this.dbLedger.iterate((record, key) => {
                if (record && record.history && record.history.length > historyToKeep) {
                    record.history = record.history.slice(-historyToKeep);
                    ledgerUpdates[key] = record;
                }
            });
            for (const [key, record] of Object.entries(ledgerUpdates)) await this.dbLedger.setItem(key, record);
        } catch (error) {
            console.error('[系統] 資料瘦身執行失敗:', error);
        }
    }

    _backgroundSync(action, payload) {
        if (!POS_CONFIG.GAS_API_URL) return;
        try {
            fetch(POS_CONFIG.GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: action, data: payload })
            }).catch(err => console.error('[雲端網路連線失敗]', err));
        } catch (error) {
            console.error('[雲端同步執行錯誤]', error);
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

    async searchProductsByKeyword(keyword, limit = 3) {
        if (!keyword || keyword.trim() === '') return [];
        const lowerKeyword = keyword.toLowerCase();
        const results = [];
        try {
            await this.dbProducts.iterate((product, barcode) => {
                const safeName = product.name || '';
                if (barcode.toLowerCase().includes(lowerKeyword) || safeName.toLowerCase().includes(lowerKeyword)) {
                    if (!barcode.startsWith('999')) results.push({ barcode, name: product.name, price: product.price });
                }
            });
        } catch (error) {}
        return results.slice(0, limit);
    }

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
            this.cart.push({ barcode: `${barcode}_${this.customItemSequence}`, name: `${product.name}${this.customItemSequence}`, price: customPrice || 0, qty: 1, isNegative: false, promotions: [] });
            this._autoSaveCart();
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
        this._autoSaveCart();
        return { success: true };
    }

    updateQty(index, newQty) { 
        if (newQty <= 0) this.cart.splice(index, 1); 
        else this.cart[index].qty = newQty; 
        this._autoSaveCart(); 
    }

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

    calculateCart() {
        let totalAmount = 0; let totalDiscount = 0; let totalCount = 0;
        const evaluatedCart = this.cart.map(item => {
            const originalTotal = item.price * item.qty;
            let currentTotal = originalTotal;
            let appliedPromos = [];
            let totalItemDiscount = 0;
            totalCount += item.qty;

            if (item.promotions && item.promotions.length > 0 && !item.isNegative) {
                const validPromos = item.promotions.filter(p => p.type !== 'NONE' && item.qty >= (parseInt(p.qty)||0) && (parseInt(p.qty)||0) > 0);
                if (validPromos.length > 0) {
                    if (item.promoStrategy === 'BEST') {
                        let bestDiscount = 0; let bestPromoText = '';
                        validPromos.forEach(promo => {
                            const res = this._calcSinglePromo(item.qty, item.price, originalTotal, promo);
                            if (res.discount > bestDiscount) { bestDiscount = res.discount; bestPromoText = res.text; }
                        });
                        if (bestDiscount > 0) {
                            totalItemDiscount = bestDiscount;
                            appliedPromos.push({ text: bestPromoText, discount: bestDiscount });
                        }
                    } else {
                        validPromos.sort((a, b) => a.type === 'QTY_PRICE' ? -1 : 1);
                        validPromos.forEach(promo => {
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
            totalAmount += itemFinalTotal; totalDiscount += totalItemDiscount;
            return { ...item, originalTotal, itemFinalTotal, itemDiscount: totalItemDiscount, appliedPromos };
        });
        return { evaluatedItems: evaluatedCart, totalAmount, totalDiscount, totalCount };
    }

    getSmartTenders(currentTotal = null) {
        const total = currentTotal !== null ? currentTotal : this.calculateCart().totalAmount;
        if (total <= 0) return { top: [], bottom: [] };
        let b1 = (Math.ceil(total / 100) * 100) % 1000; let b2 = (Math.ceil(total / 50) * 50) % 1000; let b3 = total % 100; let b4 = (total + 5) % 100;
        return {
            top: [50, 100, 500, 1000],
            bottom: [{ val: b1, display: String(b1).padStart(3, '0') }, { val: b2, display: String(b2).padStart(3, '0') }, { val: b3, display: String(b3).padStart(2, '0') }, { val: b4, display: String(b4).padStart(2, '0') }]
        };
    }

    processCheckout() {
        const total = this.calculateCart().totalAmount;
        if (total === 0) return { success: false, reason: 'empty_cart' };
        let tendered = this.getNumpadValue();
        if (tendered === null) tendered = total;
        if (tendered < total) return { success: false, reason: 'insufficient_funds' };
        this.lastCheckoutState = { tendered: tendered, change: tendered - total };
        return { success: true, change: tendered - total };
    }

    async updateLedgerDebt(customer, amount, type = 'CREDIT') {
        try {
            const timestamp = Date.now();
            const displayTime = this._getUnifiedDisplayTime();
            
            const ledgerRecord = {
                timestamp: timestamp, displayTime: displayTime,
                customerId: customer.id, customerName: customer.name,
                type: type, amount: amount
            };

            await this.dbLedger.setItem(`LEDGER-${timestamp}`, ledgerRecord);

            const customerData = await this.dbCustomers.getItem(customer.id);
            if (customerData) {
                if (type === 'CREDIT') customerData.debt += amount;
                else if (type === 'PAY') customerData.debt = Math.max(0, customerData.debt - amount); 
                
                customerData.lastUpdate = timestamp; 
                await this.dbCustomers.setItem(customer.id, customerData);
            }

            // 🚀 核心修復：不僅同步帳本，還必須同步更新顧客總欠款
            this._backgroundSync('UPDATE_LEDGER', ledgerRecord);
            if (customerData) this._backgroundSync('SAVE_CUSTOMER', customerData);
            
            return true;
        } catch (error) {
            console.error('[系統] 帳本更新失敗:', error);
            throw error;
        }
    }

    async saveTransaction(type = 'CASH', customer = null) {
        if (this.cart.length === 0) throw new Error('購物車是空的');
        const cartReport = this.calculateCart();
        const orderId = `ORD-${Date.now()}`;
        const timestamp = Date.now();
        const displayTime = this._getUnifiedDisplayTime();

        const orderData = {
            orderId: orderId, timestamp: timestamp, displayTime: displayTime,
            type: type, customerId: customer ? customer.id : null,
            customerName: customer ? customer.name : '一般顧客',
            totalAmount: cartReport.totalAmount, tendered: this.lastCheckoutState.tendered,
            change: this.lastCheckoutState.change, items: cartReport.evaluatedItems 
        };

        try {
            await this.dbOrders.setItem(orderId, orderData);
            if (type === 'CREDIT' && customer) {
                await this.updateLedgerDebt(customer, cartReport.totalAmount, 'CREDIT');
            }
            this._backgroundSync('SAVE_ORDER', orderData);
            return { success: true, orderId: orderId };
        } catch (error) {
            throw error;
        }
    }

    async getTransactionHistory(dateStr = null) {
        try {
            const orders = [];
            await this.dbOrders.iterate((value) => {
                if (dateStr) {
                    if (value.displayTime.startsWith(dateStr)) orders.push(value);
                } else {
                    orders.push(value); 
                }
            });
            orders.sort((a, b) => b.timestamp - a.timestamp);
            return orders;
        } catch (error) {
            return [];
        }
    }

    async getLedgerSummary() {
        try {
            const ledgers = [];
            await this.dbCustomers.iterate((value) => {
                if (value && value.debt !== undefined && value.name && !value.isDeleted) ledgers.push(value);
            });
            ledgers.sort((a, b) => {
                if (a.debt > 0 && b.debt === 0) return -1;
                if (a.debt === 0 && b.debt > 0) return 1;
                return (b.lastUpdate || 0) - (a.lastUpdate || 0);
            });
            return ledgers;
        } catch (error) {
            return [];
        }
    }

    async getAllCustomers() {
        try {
            const customers = [];
            await this.dbCustomers.iterate((value) => {
                if (value && value.id && value.name && value.name.trim() !== '') customers.push({ id: value.id, name: value.name });
            });
            return customers;
        } catch (error) { return []; }
    }

    async createNewCustomer(name) {
        try {
            const customerId = `CUST-${Date.now()}`;
            const newCustomer = { id: customerId, name: name, debt: 0, isDeleted: false, lastUpdate: Date.now() };
            await this.dbCustomers.setItem(customerId, newCustomer);
            this._backgroundSync('SAVE_CUSTOMER', newCustomer);
            return newCustomer;
        } catch (error) { throw error; }
    }

    async getCustomerLedger(customerId) {
        try {
            const customer = await this.dbCustomers.getItem(customerId);
            if (!customer) return null;
            const history = [];
            await this.dbLedger.iterate((record) => { if (record && record.customerId === customerId) history.push(record); });
            history.sort((a, b) => b.timestamp - a.timestamp);
            return { ...customer, totalDebt: customer.debt, history: history };
        } catch (error) { return null; }
    }

    clearAll() { this.cart = []; this.numpadBuffer = ''; this.activeTail = null; localStorage.removeItem('pos_cart_backup'); }

    _autoSaveCart() { localStorage.setItem('pos_cart_backup', JSON.stringify(this.cart)); }

    loadCartBackup() {
        const backup = localStorage.getItem('pos_cart_backup');
        if (backup) {
            try { this.cart = JSON.parse(backup); } catch(e) { this.cart = []; }
        }
    }

    async updateCustomerName(customerId, newName) {
        try {
            const customer = await this.dbCustomers.getItem(customerId);
            if (!customer) throw new Error('找不到該顧客資料');
            customer.name = newName; customer.lastUpdate = Date.now();
            await this.dbCustomers.setItem(customerId, customer);
            this._backgroundSync('SAVE_CUSTOMER', customer);
            return true;
        } catch (error) { throw error; }
    }

    async deleteCustomer(customerId) {
        try {
            const customer = await this.dbCustomers.getItem(customerId);
            if (!customer) throw new Error('找不到該顧客資料');
            if (customer.debt > 0) throw new Error('該顧客仍有欠款，無法刪除');
            customer.isDeleted = true; customer.lastUpdate = Date.now();
            await this.dbCustomers.setItem(customerId, customer);
            this._backgroundSync('SAVE_CUSTOMER', customer);
            return true;
        } catch (error) { throw error; }
    }

    // 🚀 核心升級：具備日期防禦與自我修復演算法的全域同步引擎
    async syncAllDataFromCloud() {
        if (!POS_CONFIG.GAS_API_URL) throw new Error('未設定 API URL');
        const results = { products: 0, customers: 0, ledgers: 0, orders: 0 };
        
        // 🛠️ 防禦型工具：把從 Google Sheets 傳來被弄壞的 Date 字串，強制轉回 "YYYY-MM-DD HH:mm:ss"
        const normalizeDate = (dateVal) => {
            if (!dateVal) return '';
            // 如果字串本身已經是正常格式 (含有 - 且不含 GMT)，直接回傳
            if (typeof dateVal === 'string' && dateVal.includes('-') && !dateVal.includes('GMT')) return dateVal.substring(0, 19);
            
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return String(dateVal);
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };

        try {
            // 1. 同步商品 (Products)
            const resProd = await fetch(`${POS_CONFIG.GAS_API_URL}?action=FETCH_PRODUCTS`);
            const dataProd = await resProd.json();
            if (dataProd.status === 'success' && dataProd.data) {
                for (const item of dataProd.data) await this.dbProducts.setItem(item.barcode, item);
                results.products = dataProd.data.length;
            }

            // 2. 同步顧客帳本明細 (Ledger) -> 必須先抓，供 Customer 自我修復計算
            const resLedger = await fetch(`${POS_CONFIG.GAS_API_URL}?action=FETCH_LEDGER`);
            const dataLedger = await resLedger.json();
            const customerDebtMap = {}; // 存放計算出的真實欠款
            
            if (dataLedger.status === 'success' && dataLedger.data) {
                for (const item of dataLedger.data) {
                    item.displayTime = normalizeDate(item.displayTime); // 🛠️ 日期正規化
                    await this.dbLedger.setItem(`LEDGER-${item.timestamp}`, item);

                    // 🏥 計算該顧客的真實總欠款
                    if (customerDebtMap[item.customerId] === undefined) customerDebtMap[item.customerId] = 0;
                    if (item.type === 'CREDIT') customerDebtMap[item.customerId] += item.amount;
                    if (item.type === 'PAY') customerDebtMap[item.customerId] = Math.max(0, customerDebtMap[item.customerId] - item.amount);
                }
                results.ledgers = dataLedger.data.length;
            }

            // 3. 同步顧客主檔 (Customers) -> 套用自我修復
            const resCust = await fetch(`${POS_CONFIG.GAS_API_URL}?action=FETCH_CUSTOMERS`);
            const dataCust = await resCust.json();
            if (dataCust.status === 'success' && dataCust.data) {
                for (const item of dataCust.data) {
                    // 🏥 自我修復：如果明細算出來的欠款與雲端不同，以算出來的為準！
                    if (customerDebtMap[item.id] !== undefined) {
                        item.debt = customerDebtMap[item.id]; 
                    }
                    await this.dbCustomers.setItem(item.id, item);
                }
                results.customers = dataCust.data.length;
            }

            // 4. 同步訂單 (Orders)
            const resOrders = await fetch(`${POS_CONFIG.GAS_API_URL}?action=FETCH_ORDERS`);
            const dataOrders = await resOrders.json();
            if (dataOrders.status === 'success' && dataOrders.data) {
                for (const item of dataOrders.data) {
                    item.displayTime = normalizeDate(item.displayTime); // 🛠️ 日期正規化
                    await this.dbOrders.setItem(item.orderId, item);
                }
                results.orders = dataOrders.data.length;
            }

            return results;
        } catch (error) {
            console.error('[系統] 雲端同步失敗:', error);
            throw error;
        }
    }
}