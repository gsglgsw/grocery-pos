class PosView {
    constructor() {
        // --- 基礎介面綁定 ---
        this.globalLoader = document.getElementById('global-loader');
        this.cartListContainer = document.getElementById('cart-list-container');
        this.totalDisplay = document.getElementById('cart-total-display');

        this.checkoutView = document.getElementById('checkout-view');
        this.ledgerView = document.getElementById('ledger-view');
        this.auditView = document.getElementById('audit-view');

        this.btnClearCart = document.getElementById('btn-clear-cart');
        this.btnGoLedger = document.getElementById('btn-go-ledger');
        this.btnBackCheckout = document.getElementById('btn-back-checkout');
        this.btnGoAudit = document.getElementById('btn-go-audit');
        this.btnBackCheckoutAudit = document.getElementById('btn-back-checkout-audit');

        this.btnQuickCustom = document.getElementById('btn-quick-custom');
        this.btnQuickEgg = document.getElementById('btn-quick-egg');
        this.btnQuickBottle = document.getElementById('btn-quick-bottle');
        this.numpadDisplay = document.getElementById('numpad-display');
        this.numpadBtns = document.querySelectorAll('.numpad-btn');
        this.tenderContainer = document.getElementById('tender-container');

        this.btnCheckout = document.getElementById('btn-checkout');
        this.btnCheckoutLedger = document.getElementById('btn-checkout-ledger');

        this.changeModal = document.getElementById('change-modal');
        this.changeAmountDisplay = document.getElementById('change-amount-display');
        this.btnCloseModal = document.getElementById('btn-close-modal');

        this.confirmMenuModal = document.getElementById('confirm-menu-modal');
        this.btnConfirmCustom = document.getElementById('btn-confirm-custom');
        this.btnConfirmEgg = document.getElementById('btn-confirm-egg');
        this.btnConfirmLedger = document.getElementById('btn-confirm-ledger');
        this.btnConfirmCash = document.getElementById('btn-confirm-cash');
        this.btnCloseConfirm = document.getElementById('btn-close-confirm');

        // --- 查帳與帳本綁定 ---
        this.auditListContainer = document.getElementById('audit-list-container');
        this.auditTotalSales = document.getElementById('audit-total-sales');
        this.ledgerListContainer = document.getElementById('ledger-list-container');
        // 🚀 新增：綁定賒帳本的新增顧客按鈕
        this.btnAddCustomerLedger = document.getElementById('btn-add-customer-ledger');
        // 🚀 新增：查帳日期過濾器節點
        this.btnAuditToday = document.getElementById('btn-audit-today');
        this.btnAuditYesterday = document.getElementById('btn-audit-yesterday');
        this.inputAuditDate = document.getElementById('input-audit-date');

        // --- 顧客選單綁定 ---
        this.customerModal = document.getElementById('customer-modal');
        this.customerListContainer = document.getElementById('customer-list-container');
        this.btnCloseCustomer = document.getElementById('btn-close-customer');
        this.btnAddCustomer = document.getElementById('btn-add-customer');

        // --- 還款選單綁定 ---
        this.repayModal = document.getElementById('repay-modal');
        this.repayCustomerName = document.getElementById('repay-customer-name');
        this.repayCurrentDebt = document.getElementById('repay-current-debt');
        this.repayInputDisplay = document.getElementById('repay-input-display');
        this.repayNumpadBtns = document.querySelectorAll('.btn-repay-numpad');
        this.btnRepayFull = document.getElementById('btn-repay-full');
        this.btnCloseRepay = document.getElementById('btn-close-repay');
        this.btnConfirmRepay = document.getElementById('btn-confirm-repay');

        // --- 歷史明細綁定 ---
        this.historyModal = document.getElementById('history-modal');
        this.historyCustomerName = document.getElementById('history-customer-name');
        this.historyTotalDebt = document.getElementById('history-total-debt');
        this.historyListContainer = document.getElementById('history-list-container');
        this.btnCloseHistory = document.getElementById('btn-close-history');

        // 商品建檔 Modal DOM
        this.btnOpenProductManager = document.getElementById('btn-open-product-manager');
        this.modalProductManager = document.getElementById('modal-product-manager');
        this.btnCloseProductManager = document.getElementById('btn-close-product-manager');
        this.btnCancelProduct = document.getElementById('btn-cancel-product');
        this.btnSearchProduct = document.getElementById('btn-search-product');
        this.btnSaveProduct = document.getElementById('btn-save-product');

        this.inputProdBarcode = document.getElementById('input-prod-barcode');
        this.inputProdName = document.getElementById('input-prod-name');
        this.inputProdSupplier = document.getElementById('input-prod-supplier');
        this.inputProdCost = document.getElementById('input-prod-cost');
        this.inputProdPrice = document.getElementById('input-prod-price');

        this.selectPromo1Type = document.getElementById('select-promo1-type');
        this.inputPromo1Qty = document.getElementById('input-promo1-qty');
        this.inputPromo1Val = document.getElementById('input-promo1-val');

        this.selectPromo2Type = document.getElementById('select-promo2-type');
        this.inputPromo2Qty = document.getElementById('input-promo2-qty');
        this.inputPromo2Val = document.getElementById('input-promo2-val');

        // 🚀 新增：綁定上方的主搜尋框
        this.inputBarcodeSearch = document.getElementById('input-barcode-search');

        // 🚀 新增：綁定上方主搜尋框與下拉選單
        this.inputBarcodeSearch = document.getElementById('input-barcode-search');
        this.searchSuggestions = document.getElementById('search-suggestions');

        // 相機掃描綁定
        this.btnCameraScan = document.getElementById('btn-camera-scan');
        this.btnStopCamera = document.getElementById('btn-stop-camera');
        this.cameraReaderContainer = document.getElementById('camera-reader-container');

        this.btnSyncCloud = document.getElementById('btn-sync-cloud');
    this.syncIcon = document.getElementById('sync-icon');

    }

    // 🚀 新增：全域遮罩控制
    showLoader() { 
        if (this.globalLoader) {
            this.globalLoader.classList.remove('hidden'); 
            this.globalLoader.classList.add('flex'); 
        }
    }
    hideLoader() { 
        if (this.globalLoader) {
            this.globalLoader.classList.add('hidden'); 
            this.globalLoader.classList.remove('flex'); 
        }
    }

    // ==========================================
    // 🚀 新增：商品搜尋與智慧預覽 UI 控制
    // ==========================================

    // 這個函式是用來同步掃描槍的盲打內容 (修復先前的 is not a function 錯誤)
    renderBarcodeBuffer(text) {
        // 只有當長輩「沒有」點擊輸入框時，才把盲打的字塞進去
        if (this.inputBarcodeSearch && document.activeElement !== this.inputBarcodeSearch) {
            this.inputBarcodeSearch.value = text;
        }
    }

    // 渲染下拉建議清單
    renderSearchSuggestions(products) {
        if (!this.searchSuggestions) return;
        this.searchSuggestions.innerHTML = '';

        if (products.length === 0) {
            this.searchSuggestions.classList.add('hidden');
            return;
        }

        products.forEach(p => {
            // 將條碼藏在 dataset 中，供點擊時讀取
            const liHTML = `
                <li class="suggestion-item p-4 hover:bg-blue-100 cursor-pointer text-gray-800 flex justify-between items-center transition-colors" data-barcode="${p.barcode}">
                    <span class="text-2xl font-bold">${p.name}</span>
                    <span class="text-xl text-gray-500 font-mono">${p.barcode}</span>
                </li>`;
            this.searchSuggestions.insertAdjacentHTML('beforeend', liHTML);
        });
        this.searchSuggestions.classList.remove('hidden');
    }

    hideSearchSuggestions() {
        if (this.searchSuggestions) this.searchSuggestions.classList.add('hidden');
    }

    // 綁定下拉選單的點擊事件
    bindSuggestionClick(handler) {
        if (!this.searchSuggestions) return;
        this.searchSuggestions.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) handler(item.dataset.barcode); // 回傳條碼給 Controller
        });
    }

    // ==========================================
    // 購物車與計算機渲染
    // ==========================================
    renderNumpad(value) { this.numpadDisplay.textContent = value || ''; }
    bindNumpadActions(handler) { this.numpadBtns.forEach(btn => { btn.addEventListener('click', (e) => handler(e.target.textContent.trim())); }); }
    showNumpadError() { const container = this.numpadDisplay.parentElement; container.classList.add('bg-red-200', 'border-red-500'); setTimeout(() => container.classList.remove('bg-red-200', 'border-red-500'), 300); }

    // 🚀 修復：確保這三個渲染函數完整存在於 View 中
    renderTenders(tenders, activeTail) {
        this.tenderContainer.innerHTML = '';
        if (!tenders.top || tenders.top.length === 0) return;
        const topHTML = `<div class="grid grid-cols-4 gap-2">${tenders.top.map(amt => `<button class="btn-tender-top bg-blue-600 text-white rounded-lg py-3 text-2xl font-bold shadow hover:bg-blue-500 active:scale-95 transition-transform" data-amount="${amt}">+$${amt}</button>`).join('')}</div>`;
        const bottomHTML = `<div class="grid grid-cols-4 gap-2">${tenders.bottom.map(item => {
            const isActive = activeTail === item.val;
            const bgClass = isActive ? 'bg-orange-500 text-white border-2 border-orange-700 shadow-inner' : 'bg-gray-600 text-gray-100 shadow hover:bg-gray-500';
            return `<button class="btn-tender-bottom ${bgClass} rounded-lg py-3 text-2xl font-bold active:scale-95 transition-all" data-amount="${item.val}">.${item.display}</button>`;
        }).join('')}</div>`;
        this.tenderContainer.insertAdjacentHTML('beforeend', topHTML + bottomHTML);
    }

    renderCart(evaluatedItems) {
        this.cartListContainer.innerHTML = '';
        evaluatedItems.forEach((item, index) => {
            const bgClass = item.isNegative ? 'bg-red-50 border-red-200' : 'bg-white border-gray-300';
            const textClass = item.isNegative ? 'text-red-700' : 'text-gray-900';
            const priceClass = item.isNegative ? 'text-danger' : 'text-gray-600';
            const btnColorClass = item.isNegative ? 'bg-red-500 hover:bg-red-600' : 'bg-brand hover:bg-blue-600';

            const displayBarcode = item.barcode.startsWith('9990000000001') ? '自訂金額商品' : (item.barcode === 'BOTTLE_RETURN' ? '無條碼商品' : item.barcode);

            // 🚀 動態生成多個優惠標籤，並分別顯示折抵金額
            let promoBadges = '';
            if (item.appliedPromos && item.appliedPromos.length > 0) {
                item.appliedPromos.forEach(p => {
                    promoBadges += `<div class="mt-2 inline-flex items-center max-w-full bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold border border-green-300 shadow-sm mr-2 truncate">
                        <span class="truncate">${p.text}</span> <span class="ml-1 shrink-0">(-$${p.discount})</span>
                    </div>`;
                });
            }
            const rowTotalHTML = item.itemDiscount > 0
                ? `<span class="text-2xl text-gray-400 line-through block mb-1">$${item.originalTotal}</span><span class="text-4xl font-black text-danger">$${item.itemFinalTotal}</span>`
                : `<span class="text-4xl font-black text-danger">$${item.itemFinalTotal}</span>`;

            const itemHTML = `<div class="flex items-center justify-between ${bgClass} border-2 p-4 rounded-2xl shadow-sm mb-3">
                <div class="flex-1">
                    <h2 class="text-3xl font-extrabold ${textClass}">${item.name}</h2>
                    <p class="text-gray-500 text-xl font-medium mt-1">${displayBarcode}</p>
                    ${promoBadges}
                </div>
                <div class="flex items-center space-x-6 mx-4">
                    <span class="text-3xl font-bold ${priceClass}">$${item.price}</span><span class="text-2xl text-gray-400">x</span>
                    <button class="btn-decrease bg-gray-200 text-gray-700 w-14 h-14 rounded-full text-3xl font-bold active:scale-90" data-index="${index}">-</button>
                    <span class="text-4xl font-black min-w-[3rem] text-center">${item.qty}</span>
                    <button class="btn-increase ${btnColorClass} text-white w-14 h-14 rounded-full text-3xl font-bold active:scale-90" data-index="${index}">+</button>
                </div>
                <div class="w-32 text-right flex flex-col items-end justify-center">
                    ${rowTotalHTML}
                </div>
            </div>`;
            this.cartListContainer.insertAdjacentHTML('beforeend', itemHTML);
        });
        this.cartListContainer.scrollTop = this.cartListContainer.scrollHeight;
    }

    renderTotal(totalAmount, totalCount, totalDiscount = 0) {
        this.totalDisplay.textContent = `$${totalAmount}`;
        const totalLabel = this.totalDisplay.previousElementSibling;

        if (totalLabel) {
            if (totalDiscount > 0) {
                totalLabel.innerHTML = `總計 (${totalCount}件)：<br><span class="text-xl text-green-400 font-normal">已為顧客省下 $${totalDiscount}</span>`;
            } else {
                totalLabel.textContent = `總計 (${totalCount}件)：`;
            }
        }
    }

    // 🚀 升級：顯示總折扣額度
    renderTotal(totalAmount, totalCount, totalDiscount = 0) {
        this.totalDisplay.textContent = `$${totalAmount}`;
        const totalLabel = this.totalDisplay.previousElementSibling;

        if (totalLabel) {
            if (totalDiscount > 0) {
                totalLabel.innerHTML = `總計 (${totalCount}件)：<br><span class="text-xl text-green-400 font-normal">已為顧客省下 $${totalDiscount}</span>`;
            } else {
                totalLabel.textContent = `總計 (${totalCount}件)：`;
            }
        }
    }

    // ==========================================
    // 基礎事件綁定
    // ==========================================
    bindCartActions(handler) { this.cartListContainer.addEventListener('click', (e) => { const index = e.target.getAttribute('data-index'); if (index === null) return; if (e.target.classList.contains('btn-increase')) handler(parseInt(index), 1); else if (e.target.classList.contains('btn-decrease')) handler(parseInt(index), -1); }); }
    bindQuickKeys(handler) { 
        if (this.btnQuickCustom) this.btnQuickCustom.addEventListener('click', () => handler('9990000000001')); 
        if (this.btnQuickEgg) this.btnQuickEgg.addEventListener('click', () => handler('9990000000002')); 
        if (this.btnQuickBottle) this.btnQuickBottle.addEventListener('click', () => handler('BOTTLE_RETURN')); 
    }
    bindTenderActions(handlerTop, handlerBottom) { this.tenderContainer.addEventListener('click', (e) => { const btnTop = e.target.closest('.btn-tender-top'); const btnBottom = e.target.closest('.btn-tender-bottom'); if (btnTop) handlerTop(parseInt(btnTop.dataset.amount)); else if (btnBottom) handlerBottom(parseInt(btnBottom.dataset.amount)); }); }
    bindCheckoutAction(handler) { this.btnCheckout.addEventListener('click', handler); }
    bindLedgerCheckoutAction(handler) { this.btnCheckoutLedger.addEventListener('click', handler); }
    bindCloseModalAction(handler) { this.btnCloseModal.addEventListener('click', handler); }
    bindClearCartAction(handler) { this.btnClearCart.addEventListener('click', handler); }

    // ==========================================
    // 找零與防呆選單 Modal
    // ==========================================
    showChangeModal(changeAmount) { this.changeAmountDisplay.textContent = `$${changeAmount}`; this.changeModal.classList.remove('hidden'); this.changeModal.classList.add('flex'); }
    hideChangeModal() { this.changeModal.classList.add('hidden'); this.changeModal.classList.remove('flex'); }
    showConfirmMenu() { this.confirmMenuModal.classList.remove('hidden'); this.confirmMenuModal.classList.add('flex'); }
    hideConfirmMenu() { this.confirmMenuModal.classList.add('hidden'); this.confirmMenuModal.classList.remove('flex'); }
    bindConfirmMenuActions(handlers) { this.btnConfirmCustom.addEventListener('click', handlers.onCustom); this.btnConfirmEgg.addEventListener('click', handlers.onEgg); this.btnConfirmLedger.addEventListener('click', handlers.onLedger); this.btnConfirmCash.addEventListener('click', handlers.onCash); this.btnCloseConfirm.addEventListener('click', handlers.onCancel); }

    // ==========================================
    // 每日查帳與賒帳本渲染
    // ==========================================
    // 🚀 升級：加入 dateStr 參數以顯示目前的查詢日期
    renderAuditList(orders, dateStr = '今日') {
        this.auditListContainer.innerHTML = '';
        let dailyTotal = 0;
        if (orders.length === 0) {
            this.auditListContainer.innerHTML = `<div class="col-span-full text-center text-4xl text-gray-400 mt-20">${dateStr} 尚無交易紀錄</div>`;
            this.auditTotalSales.textContent = `${dateStr} 總計: $0`;
            return;
        }
        orders.forEach(order => {
            dailyTotal += order.totalAmount;
            const itemsHTML = order.items.map(item => `<div class="flex justify-between text-xl text-gray-700 border-b border-gray-100 py-2"><span>${item.name} <span class="text-gray-400">x${item.qty}</span></span><span class="font-bold text-gray-600">$${item.price * item.qty}</span></div>`).join('');
            const isCash = order.type === 'CASH';
            const badgeText = isCash ? '現金' : `掛帳 (${order.customerName || '未知'})`;

            const cardHTML = `<div class="bg-white rounded-2xl shadow-md p-6 border-l-8 ${isCash ? 'border-success' : 'border-warning'}">
                <div class="flex justify-between items-center mb-4 border-b-2 border-gray-200 pb-3">
                    <span class="text-2xl font-bold text-gray-800">${order.displayTime.split(' ')[1]}</span>
                    <span class="text-xl font-bold px-4 py-1 rounded-full ${isCash ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${badgeText}</span>
                </div>
                <div class="mb-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">${itemsHTML}</div>
                <div class="flex justify-between items-end mt-4 pt-4 border-t-2 border-gray-200 bg-gray-50 -mx-6 px-6 -mb-6 pb-6 rounded-b-2xl">
                    <span class="text-2xl font-bold text-gray-500">總計</span><span class="text-4xl font-black text-danger">$${order.totalAmount}</span>
                </div></div>`;
            this.auditListContainer.insertAdjacentHTML('beforeend', cardHTML);
        });
        this.auditTotalSales.textContent = `${dateStr} 總計: $${dailyTotal}`;
    }

    // 🚀 新增：綁定查帳過濾器按鈕
    bindAuditFilterActions(handlerToday, handlerYesterday, handlerCustomDate) {
        this.btnAuditToday.addEventListener('click', handlerToday);
        this.btnAuditYesterday.addEventListener('click', handlerYesterday);
        this.inputAuditDate.addEventListener('change', (e) => handlerCustomDate(e.target.value));
    }

    // 🚀 升級：更新 Date Input 的數值，並設定可選取的極限範圍 (20天限制)
    setAuditDateInput(dateStr, minDateStr = null, maxDateStr = null) {
        this.inputAuditDate.value = dateStr;
        if (minDateStr) this.inputAuditDate.min = minDateStr;
        if (maxDateStr) this.inputAuditDate.max = maxDateStr;
    }
    // 🚀 新增：綁定賒帳本內的新增顧客行為
    bindAddCustomerLedgerAction(handler) {
        if (this.btnAddCustomerLedger) {
            this.btnAddCustomerLedger.addEventListener('click', handler);
        }
    }

  // 🚀 Phase 7 升級：支援編輯與軟刪除的顧客卡片渲染
    renderLedgerList(ledgers) {
        this.ledgerListContainer.innerHTML = '';
        if (ledgers.length === 0) {
            this.ledgerListContainer.innerHTML = '<div class="col-span-full text-center text-4xl text-gray-400 mt-20">目前無任何欠款或顧客紀錄</div>'; 
            return;
        }
        ledgers.forEach(ledger => {
            const dateObj = new Date(ledger.lastUpdate);
            const lastUpdateStr = isNaN(dateObj.getTime()) ? '無紀錄' : dateObj.toLocaleString('zh-TW', { hour12: false });

            // 💡 UX 強化：標示有欠款與已結清狀態，並加入編輯/刪除按鈕
            const cardHTML = `
                <div class="bg-white border-l-8 ${ledger.debt > 0 ? 'border-warning' : 'border-gray-300'} rounded-2xl shadow-md p-6 flex flex-col justify-between h-72 relative group">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <h2 class="text-4xl font-extrabold text-gray-800 tracking-tight">${ledger.name}</h2>
                            <!-- 🚀 CRM 操作按鈕區 -->
                            <div class="flex space-x-2">
                                <button class="btn-edit-customer text-2xl text-blue-500 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors" data-id="${ledger.id}" data-name="${ledger.name}" title="編輯姓名">✏️</button>
                                <button class="btn-delete-customer text-2xl text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" data-id="${ledger.id}" data-name="${ledger.name}" data-debt="${ledger.debt}" title="隱藏顧客">🗑️</button>
                            </div>
                        </div>
                        <p class="text-xl text-gray-400 font-medium">最後動作: ${lastUpdateStr}</p>
                    </div>
                    <div class="mt-2 flex justify-between items-end border-b-2 border-gray-100 pb-3">
                        <span class="text-xl font-bold text-gray-600">總欠款：</span>
                        <span class="text-5xl font-black ${ledger.debt > 0 ? 'text-danger' : 'text-success'}">$${ledger.debt}</span>
                    </div>
                    <div class="mt-4 flex space-x-3">
                        <button class="btn-open-history flex-1 bg-indigo-100 text-indigo-700 border-2 border-indigo-200 py-3 rounded-xl text-xl font-bold hover:bg-indigo-200 active:scale-95 transition-transform" data-id="${ledger.id}">
                            📄 明細
                        </button>
                        <button class="btn-open-repay flex-1 bg-brand text-white py-3 rounded-xl text-xl font-bold hover:bg-blue-600 active:scale-95 transition-transform shadow-sm" data-id="${ledger.id}" data-name="${ledger.name}" data-debt="${ledger.debt}">
                            💰 還款
                        </button>
                    </div>
                </div>
            `;
            this.ledgerListContainer.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    // 🚀 Phase 7 新增：綁定顧客卡片上的 CRM 管理按鈕 (編輯/刪除)
    bindCustomerCRMActions(handlerEdit, handlerDelete) {
        this.ledgerListContainer.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit-customer');
            const btnDelete = e.target.closest('.btn-delete-customer');

            if (btnEdit) {
                handlerEdit(btnEdit.dataset.id, btnEdit.dataset.name);
            } else if (btnDelete) {
                handlerDelete(btnDelete.dataset.id, btnDelete.dataset.name, parseInt(btnDelete.dataset.debt, 10));
            }
        });
    }

    // ==========================================
    // 顧客掛帳選單 (Customer Modal) 
    // ==========================================
    showCustomerModal(customers) {
        this.customerListContainer.innerHTML = '';
        customers.forEach(customer => {
            const btnHTML = `<button class="btn-select-customer bg-yellow-50 p-6 rounded-xl border-2 border-warning shadow-sm hover:bg-yellow-100 active:bg-yellow-200 active:scale-95 text-3xl font-extrabold text-gray-800" data-id="${customer.id}" data-name="${customer.name}">${customer.name}</button>`;
            this.customerListContainer.insertAdjacentHTML('beforeend', btnHTML);
        });
        this.customerModal.classList.remove('hidden');
        this.customerModal.classList.add('flex');
    }

    // 🚀 [修復關鍵] 確保此函式存在於類別中
    hideCustomerModal() {
        this.customerModal.classList.add('hidden');
        this.customerModal.classList.remove('flex');
    }

    bindCustomerModalActions(handlerSelect, handlerCancel, handlerAdd) {
        this.customerListContainer.onclick = (e) => {
            const btn = e.target.closest('.btn-select-customer');
            if (btn) handlerSelect({ id: btn.dataset.id, name: btn.dataset.name });
        };
        this.btnCloseCustomer.onclick = handlerCancel;
        this.btnAddCustomer.onclick = handlerAdd;
    }

    // ==========================================
    // 還款作業選單 (Repay Modal)
    // ==========================================
    bindOpenRepayAction(handler) {
        this.ledgerListContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-open-repay');
            if (btn) handler(btn.dataset);
        });
    }

    showRepayModal(customerData) {
        this.repayCustomerName.textContent = customerData.name;
        this.repayCurrentDebt.textContent = `$${customerData.maxDebt}`;
        this.renderRepayNumpad('');
        this.repayModal.classList.remove('hidden');
        this.repayModal.classList.add('flex');
    }

    hideRepayModal() {
        this.repayModal.classList.add('hidden');
        this.repayModal.classList.remove('flex');
    }

    renderRepayNumpad(val) { this.repayInputDisplay.textContent = val ? `$${val}` : ''; }

    bindRepayActions(handlers) {
        this.repayNumpadBtns.forEach(btn => { btn.addEventListener('click', (e) => handlers.onNumpad(e.target.textContent.trim())); });
        this.btnRepayFull.addEventListener('click', handlers.onFullRepay);
        this.btnCloseRepay.addEventListener('click', handlers.onCancel);
        this.btnConfirmRepay.addEventListener('click', handlers.onConfirm);
    }

    // ==========================================
    // 顧客歷史明細選單 (History Modal)
    // ==========================================
    bindOpenHistoryAction(handler) {
        this.ledgerListContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-open-history');
            if (btn) handler(btn.dataset.id);
        });
        this.btnCloseHistory.addEventListener('click', () => this.hideHistoryModal());
    }

    showHistoryModal(ledgerRecord) {
        this.historyCustomerName.textContent = ledgerRecord.name;
        this.historyTotalDebt.textContent = `$${ledgerRecord.totalDebt}`; // 這裡維持 totalDebt 是因為 Model 在回傳前有做聚合轉換
        this.historyListContainer.innerHTML = '';

        if (!ledgerRecord.history || ledgerRecord.history.length === 0) {
            this.historyListContainer.innerHTML = '<div class="text-center text-2xl text-gray-400 mt-10">尚無詳細歷史紀錄</div>';
        } else {
            const sortedHistory = [...ledgerRecord.history].sort((a, b) => b.timestamp - a.timestamp);

            sortedHistory.forEach(record => {
                const isCredit = record.type === 'CREDIT';
                const actionText = isCredit ? '📝 新增掛帳' : '✅ 顧客還款';
                const amountColor = isCredit ? 'text-danger' : 'text-success';
                const sign = isCredit ? '+' : '-';
                const bgClass = isCredit ? 'bg-white' : 'bg-green-50';

                // 🚀 修復：採用 record.displayTime 而非 record.time
                const rowHTML = `
                    <div class="flex justify-between items-center p-4 rounded-xl border-2 border-gray-200 shadow-sm ${bgClass}">
                        <div>
                            <span class="text-2xl font-bold text-gray-800 block">${actionText}</span>
                            <span class="text-lg text-gray-500">${record.displayTime || ''}</span>
                        </div>
                        <div class="text-4xl font-black ${amountColor}">
                            ${sign}$${record.amount}
                        </div>
                    </div>
                `;
                this.historyListContainer.insertAdjacentHTML('beforeend', rowHTML);
            });
        }

        this.historyModal.classList.remove('hidden');
        this.historyModal.classList.add('flex');
        
    }

    // 🚀 修復：補回遺失的明細關閉函式
    hideHistoryModal() {
        if (this.historyModal) {
            this.historyModal.classList.add('hidden');
            this.historyModal.classList.remove('flex');
        }
    }

    // ==========================================
    // 📦 商品建檔 Modal UI 控制 (終極整合版)
    // ==========================================

    showProductManager(barcode = '') {
        this._clearProductForm();
        if (barcode) {
            this.inputProdBarcode.value = barcode;
        }
        this.modalProductManager.classList.remove('hidden');
        this.modalProductManager.classList.add('flex');
        this.inputProdBarcode.focus();
        // 🛑 核心防呆：開啟 Modal 時，設定標記阻擋全域條碼掃描器
        this.isModalOpen = true;
    }

    hideProductManager() {
        this.modalProductManager.classList.add('hidden');
        this.modalProductManager.classList.remove('flex');
        this.isModalOpen = false;
    }

    _clearProductForm() {
        if (this.inputProdBarcode) this.inputProdBarcode.value = '';
        if (this.inputProdName) this.inputProdName.value = '';
        if (this.inputProdSupplier) this.inputProdSupplier.value = '';
        if (this.inputProdCost) this.inputProdCost.value = '';
        if (this.inputProdPrice) this.inputProdPrice.value = '';
        if (this.selectPromo1Type) this.selectPromo1Type.value = 'NONE';
        if (this.inputPromo1Qty) this.inputPromo1Qty.value = '';
        if (this.inputPromo1Val) this.inputPromo1Val.value = '';
        if (this.selectPromo2Type) this.selectPromo2Type.value = 'NONE';
        if (this.inputPromo2Qty) this.inputPromo2Qty.value = '';
        if (this.inputPromo2Val) this.inputPromo2Val.value = '';

        // 🚀 綁定與清空策略選單
        this.selectPromoStrategy = document.getElementById('select-promo-strategy');
        if (this.selectPromoStrategy) this.selectPromoStrategy.value = 'BEST';
    }

    fillProductForm(product) {
        this.inputProdName.value = product.name || '';
        this.inputProdSupplier.value = product.supplierName || '';
        this.inputProdCost.value = product.costPrice || '';
        this.inputProdPrice.value = product.price || '';

        this.selectPromoStrategy = document.getElementById('select-promo-strategy');
        if (this.selectPromoStrategy) this.selectPromoStrategy.value = product.promoStrategy || 'BEST';

        if (product.promotions && product.promotions.length > 0) {
            const p1 = product.promotions[0];
            if (p1) {
                this.selectPromo1Type.value = p1.type || 'NONE';
                this.inputPromo1Qty.value = p1.qty || '';
                this.inputPromo1Val.value = p1.val || '';
            }
            const p2 = product.promotions[1];
            if (p2) {
                this.selectPromo2Type.value = p2.type || 'NONE';
                this.inputPromo2Qty.value = p2.qty || '';
                this.inputPromo2Val.value = p2.val || '';
            }
        }
    }

    // 🚀 修復：收集表單資料，並將促銷設定打包進陣列
    getProductFormData() {
        this.selectPromoStrategy = document.getElementById('select-promo-strategy');
        return {
            barcode: (this.inputProdBarcode.value || '').trim(),
            name: (this.inputProdName.value || '').trim(),
            supplierName: (this.inputProdSupplier.value || '').trim(),
            costPrice: parseFloat(this.inputProdCost.value) || 0,
            price: parseFloat(this.inputProdPrice.value) || 0,
            promoStrategy: this.selectPromoStrategy ? this.selectPromoStrategy.value : 'BEST',
            promotions: [
                {
                    type: this.selectPromo1Type ? this.selectPromo1Type.value : 'NONE',
                    qty: parseInt(this.inputPromo1Qty ? this.inputPromo1Qty.value : 0) || 0,
                    val: parseFloat(this.inputPromo1Val ? this.inputPromo1Val.value : 0) || 0
                },
                {
                    type: this.selectPromo2Type ? this.selectPromo2Type.value : 'NONE',
                    qty: parseInt(this.inputPromo2Qty ? this.inputPromo2Qty.value : 0) || 0,
                    val: parseFloat(this.inputPromo2Val ? this.inputPromo2Val.value : 0) || 0
                }
            ]
        };
    }

    // 🚀 終極整合版：支援搜尋、儲存、同步，以及相機預留孔位
    bindProductManagerActions(handlerSearch, handlerSave, handlerSync, handlerCameraStart = null, handlerCameraStop = null) {
        if (this.btnOpenProductManager) this.btnOpenProductManager.onclick = () => this.showProductManager();
        const closeModal = () => this.hideProductManager();
        if (this.btnCloseProductManager) this.btnCloseProductManager.onclick = closeModal;
        if (this.btnCancelProduct) this.btnCancelProduct.onclick = closeModal;

        if (this.btnSearchProduct) {
            this.btnSearchProduct.onclick = () => {
                const barcode = this.inputProdBarcode.value.trim();
                if (barcode) handlerSearch(barcode);
            };
        }
        
        if (this.btnSaveProduct) {
            this.btnSaveProduct.onclick = () => {
                const data = this.getProductFormData();
                handlerSave(data, closeModal);
            };
        }

        // 🚀 Phase 8.1 雲端同步綁定
        if (this.btnSyncCloud) {
            this.btnSyncCloud.onclick = async () => {
                // UI 狀態切換，防止長輩重複狂點
                this.btnSyncCloud.disabled = true;
                this.btnSyncCloud.classList.replace('bg-blue-600', 'bg-gray-400');
                if (this.syncIcon) this.syncIcon.textContent = '⏳';
                
                // 執行 Controller 傳來的同步邏輯
                await handlerSync();
                
                // 恢復 UI
                this.btnSyncCloud.disabled = false;
                this.btnSyncCloud.classList.replace('bg-gray-400', 'bg-blue-600');
                if (this.syncIcon) this.syncIcon.textContent = '☁️';
            };
        }

        // 📷 相機掃描綁定 (若有實作)
        if (this.btnCameraScan && handlerCameraStart) {
            this.btnCameraScan.onclick = () => {
                if(this.cameraReaderContainer) {
                    this.cameraReaderContainer.classList.remove('hidden');
                    this.cameraReaderContainer.classList.add('flex');
                }
                handlerCameraStart();
            };
        }
        if (this.btnStopCamera && handlerCameraStop) {
            this.btnStopCamera.onclick = () => {
                if(this.cameraReaderContainer) {
                    this.cameraReaderContainer.classList.add('hidden');
                    this.cameraReaderContainer.classList.remove('flex');
                }
                handlerCameraStop();
            };
        }
    }
}