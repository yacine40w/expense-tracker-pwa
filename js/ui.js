const CategoryIcons = {
    'طعام': '🍔',
    'نقل': '🚗',
    'فواتير': '💡',
    'تسوق': '🛒',
    'صحة': '💊',
    'أخرى': '📦'
};

const UI = {
    // تنسيق الأرقام (مثلاً: 1,500.00)
    formatCurrency(num) {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    // تحديث بطاقات الملخص (اليوم والشهر)
    updateSummaries(expenses) {
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

        let todayTotal = 0;
        let monthTotal = 0;

        expenses.forEach(item => {
            if (item.date === todayStr) {
                todayTotal += item.amount;
            }
            if (item.date.startsWith(currentMonthStr)) {
                monthTotal += item.amount;
            }
        });

        document.getElementById('today-total').textContent = this.formatCurrency(todayTotal);
        document.getElementById('month-total').textContent = this.formatCurrency(monthTotal);
    },

    // رسم قائمة المصاريف حسب الفلتر المختار
    renderExpenses(expenses, filter = 'today') {
        const listEl = document.getElementById('expense-list');
        const countEl = document.getElementById('records-count');
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonthStr = todayStr.slice(0, 7);

        const filtered = expenses.filter(item => {
            if (filter === 'today') return item.date === todayStr;
            if (filter === 'month') return item.date.startsWith(currentMonthStr);
            return true; // 'all'
        });

        countEl.textContent = filtered.length;
        listEl.innerHTML = '';

        if (filtered.length === 0) {
            listEl.innerHTML = '<li class="empty-state">لا توجد مصاريف مسجلة في هذه الفترة</li>';
            return;
        }

        filtered.forEach(item => {
            const icon = CategoryIcons[item.category] || '📦';
            const title = item.note ? `${icon} ${item.note}` : `${icon} ${item.category}`;
            
            const li = document.createElement('li');
            li.className = 'expense-item';
            li.innerHTML = `
                <div class="expense-info">
                    <span class="expense-title">${title}</span>
                    <span class="expense-meta">${item.category} • ${item.date}</span>
                </div>
                <div class="expense-actions">
                    <span class="expense-amount">-${this.formatCurrency(item.amount)} د.ج</span>
                    <button type="button" class="btn-delete" data-id="${item.id}" title="حذف">✕</button>
                </div>
            `;
            listEl.appendChild(li);
        });
    }
};