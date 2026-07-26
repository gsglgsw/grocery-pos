/**
 * 雙螢幕顧客顯示端邏輯 (Customer Display Receiver)
 * 透過 BroadcastChannel 接收主 POS 系統的廣播
 */

document.addEventListener('DOMContentLoaded', () => {
    // 建立與主系統相同名稱的廣播頻道
    const posChannel = new BroadcastChannel('pos_sync_channel');

    const cartList = document.getElementById('customer-cart-list');
    const totalLabel = document.getElementById('customer-total-label');
    const totalAmount = document.getElementById('customer-total-amount');
    const changeModal = document.getElementById('customer-change-modal');

    // 監聽來自主要 POS 的廣播訊息
    posChannel.onmessage = (event) => {
        const payload = event.data;

        if (payload.action === 'UPDATE_CART') {
            renderCart(payload.data);
            changeModal.classList.add('hidden'); // 更新購物車時，隱藏找零畫面
        } 
        else if (payload.action === 'SHOW_CHANGE') {
            showChange(payload.data.change);
        }
        else if (payload.action === 'CLEAR_SCREEN') {
            clearScreen();
        }
    };

    // 渲染購物車畫面 (與主畫面邏輯相似，但移除按鈕)
    function renderCart(cartReport) {
        if (cartReport.evaluatedItems.length === 0) {
            clearScreen();
            return;
        }

        cartList.innerHTML = '';
        cartReport.evaluatedItems.forEach(item => {
            const bgClass = item.isNegative ? 'bg-red-50 border-red-200' : 'bg-white border-gray-300';
            const textClass = item.isNegative ? 'text-red-700' : 'text-gray-900';
            const priceClass = item.isNegative ? 'text-red-500' : 'text-gray-600';

            // 處理促銷標籤
            let promoBadges = '';
            if (item.appliedPromos && item.appliedPromos.length > 0) {
                item.appliedPromos.forEach(p => {
                    promoBadges += `<div class="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold border border-green-300 shadow-sm mr-2">${p.text} (-$${p.discount})</div>`;
                });
            }

            const rowTotalHTML = item.itemDiscount > 0 
                ? `<span class="text-xl text-gray-400 line-through block mb-1">$${item.originalTotal}</span><span class="text-4xl font-black text-red-500">$${item.itemFinalTotal}</span>`
                : `<span class="text-4xl font-black text-red-500">$${item.itemFinalTotal}</span>`;

            const itemHTML = `
            <div class="flex items-center justify-between ${bgClass} border-2 p-4 rounded-2xl shadow-sm mb-3">
                <div class="flex-1">
                    <h2 class="text-3xl font-extrabold ${textClass}">${item.name}</h2>
                    ${promoBadges}
                </div>
                <div class="flex items-center mx-6">
                    <span class="text-3xl font-bold ${priceClass}">$${item.price}</span>
                    <span class="text-2xl text-gray-400 mx-3">x</span>
                    <span class="text-4xl font-black text-blue-700">${item.qty}</span>
                </div>
                <div class="w-32 text-right flex flex-col items-end justify-center">
                    ${rowTotalHTML}
                </div>
            </div>`;
            cartList.insertAdjacentHTML('beforeend', itemHTML);
        });

        // 自動滾動到底部
        cartList.scrollTop = cartList.scrollHeight;

        // 更新總計
        totalAmount.textContent = `$${cartReport.totalAmount}`;
        if (cartReport.totalDiscount > 0) {
            totalLabel.innerHTML = `應付總額 <span class="text-xl text-green-600 font-bold ml-2">(為您省下 $${cartReport.totalDiscount})</span>`;
        } else {
            totalLabel.innerHTML = `應付總額`;
        }
    }

    // 顯示找零大畫面
    function showChange(changeAmount) {
        document.getElementById('customer-change-amount').textContent = `$${changeAmount}`;
        changeModal.classList.remove('hidden');
    }

    // 恢復預設歡迎畫面
    function clearScreen() {
        cartList.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                <svg class="w-48 h-48 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                <p class="text-4xl font-bold">請將商品交給櫃檯人員</p>
            </div>
        `;
        totalAmount.textContent = '$0';
        totalLabel.innerHTML = `應付總額`;
        changeModal.classList.add('hidden');
    }
});