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
    // تحديث بطاقات الملخص وشريط الميزانية الشهرية
    updateSummaries(expenses) {
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonthStr = todayStr.slice(0, 7);

        let todayTotal = 0;
        let monthTotal = 0;

        expenses.forEach(item => {
            if (item.date === todayStr) todayTotal += item.amount;
            if (item.date.startsWith(currentMonthStr)) monthTotal += item.amount;
        });

        document.getElementById('today-total').textContent = this.formatCurrency(todayTotal);
        document.getElementById('month-total').textContent = this.formatCurrency(monthTotal);

        this.updateBudgetUI(monthTotal);
    },

    // حساب وتحديث شريط الميزانية والتنبيهات
    updateBudgetUI(monthTotal) {
        const budgetLimit = parseFloat(localStorage.getItem('monthly_budget_limit')) || 0;
        const container = document.getElementById('budget-container');
        if (!container) return;

        if (budgetLimit <= 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        const rawPercent = (monthTotal / budgetLimit) * 100;
        const clampedPercent = Math.min(rawPercent, 100);

        const bar = document.getElementById('budget-progress-bar');
        const percentText = document.getElementById('budget-percentage');
        const limitText = document.getElementById('budget-limit-text');
        const alertBox = document.getElementById('budget-alert');

        bar.style.width = `${clampedPercent}%`;
        bar.classList.remove('warning', 'danger');
        alertBox.classList.remove('warning', 'danger');

        percentText.textContent = `${Math.round(rawPercent)}%`;
        limitText.textContent = `من ${this.formatCurrency(budgetLimit)} د.ج`;

        if (rawPercent >= 100) {
            bar.classList.add('danger');
            alertBox.classList.add('danger');
            const over = monthTotal - budgetLimit;
            alertBox.textContent = `⚠️ تجاوزت الميزانية بـ ${this.formatCurrency(over)} د.ج`;
            alertBox.style.display = 'block';
        } else if (rawPercent >= 80) {
            bar.classList.add('warning');
            alertBox.classList.add('warning');
            const remaining = budgetLimit - monthTotal;
            alertBox.textContent = `🔔 اقتربت من الحد (المتبقي: ${this.formatCurrency(remaining)} د.ج)`;
            alertBox.style.display = 'block';
        } else {
            alertBox.style.display = 'none';
        }
    },

    // رسم قائمة المصاريف مع زر التعديل وزر الحذف
    renderExpenses(expenses, filter = 'today', editingId = '') {
        const listEl = document.getElementById('expense-list');
        const countEl = document.getElementById('records-count');
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonthStr = todayStr.slice(0, 7);

        const filtered = expenses.filter(item => {
            if (filter === 'today') return item.date === todayStr;
            if (filter === 'month') return item.date.startsWith(currentMonthStr);
            return true;
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
            li.className = `expense-item ${item.id === editingId ? 'editing' : ''}`;
            li.innerHTML = `
                <div class="expense-info">
                    <span class="expense-title">${title}</span>
                    <span class="expense-meta">${item.category} • ${item.date}</span>
                </div>
                <div class="expense-actions">
                    <span class="expense-amount">-${this.formatCurrency(item.amount)} د.ج</span>
                    <button type="button" class="btn-edit" data-id="${item.id}" title="تعديل">✎</button>
                    <button type="button" class="btn-delete" data-id="${item.id}" title="حذف">✕</button>
                </div>
            `;
            listEl.appendChild(li);
        });
    }
};