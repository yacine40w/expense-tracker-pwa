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

    // رسم أزرار الفئات الرئيسية والفروع في نموذج الإضافة
    renderCategorySelectors(categories, selectedCatName, selectedSubName) {
        const grid = document.getElementById('category-grid');
        const subSection = document.getElementById('subcategory-section');
        const subGrid = document.getElementById('subcategory-grid');
        const catInput = document.getElementById('selected-category');
        const subInput = document.getElementById('selected-subcategory');

        const parents = categories.filter(c => !c.parent_id);
        if (parents.length === 0) {
            grid.innerHTML = '<small>لا توجد فئات، أضف فئة من زر الإدارة</small>';
            subSection.style.display = 'none';
            return;
        }

        const activeParent = parents.find(p => p.name === selectedCatName) || parents[0];
        catInput.value = activeParent.name;

        grid.innerHTML = parents.map(p => `
            <button type="button" class="cat-btn ${p.id === activeParent.id ? 'active' : ''}" 
                data-id="${p.id}" data-name="${p.name}">
                ${p.icon} ${p.name}
            </button>
        `).join('');

        const children = categories.filter(c => c.parent_id === activeParent.id);
        if (children.length > 0) {
            subSection.style.display = 'block';
            const activeSub = children.find(s => s.name === selectedSubName);
            subInput.value = activeSub ? activeSub.name : '';

            subGrid.innerHTML = children.map(s => `
                <button type="button" class="subcat-btn ${s.name === subInput.value ? 'active' : ''}" 
                    data-name="${s.name}">
                    ${s.name}
                </button>
            `).join('');
        } else {
            subSection.style.display = 'none';
            subInput.value = '';
        }
    },

    // رسم شجرة الفئات داخل نافذة الإدارة + قائمة الآباء في <select>
    renderCategoryManager(categories) {
        const list = document.getElementById('cat-manage-list');
        const parentSelect = document.getElementById('cat-parent-select');
        const parents = categories.filter(c => !c.parent_id);

        parentSelect.innerHTML = '<option value="">-- فئة رئيسية (بدون أب) --</option>' +
            parents.map(p => `<option value="${p.id}">${p.icon} ${p.name}</option>`).join('');

        list.innerHTML = parents.map(p => {
            const children = categories.filter(c => c.parent_id === p.id);
            const childrenHtml = children.length ? `
                <ul class="cat-tree-children">
                    ${children.map(ch => `
                        <li class="cat-tree-child">
                            <span>${ch.icon} ${ch.name}</span>
                            <div>
                                <button type="button" class="btn-edit" data-cat-id="${ch.id}">✎</button>
                                <button type="button" class="btn-delete" data-cat-id="${ch.id}">✕</button>
                            </div>
                        </li>
                    `).join('')}
                </ul>` : '';

            return `
                <li class="cat-tree-parent">
                    <div class="cat-tree-row">
                        <strong>${p.icon} ${p.name}</strong>
                        <div>
                            <button type="button" class="btn-edit" data-cat-id="${p.id}">✎</button>
                            <button type="button" class="btn-delete" data-cat-id="${p.id}">✕</button>
                        </div>
                    </div>
                    ${childrenHtml}
                </li>
            `;
        }).join('');
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
            const catLabel = item.subcategory ? `${item.category} › ${item.subcategory}` : item.category;
            const li = document.createElement('li');
            li.className = `expense-item ${item.id === editingId ? 'editing' : ''}`;
            li.innerHTML = `
                <div class="expense-info">
                    <span class="expense-title">${title}</span>
                    <span class="expense-meta">${catLabel} • ${item.date}</span>
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