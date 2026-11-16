document.addEventListener('DOMContentLoaded', async () => {
    let currentFilter = 'today';

    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const authScreen = document.getElementById('auth-screen');
    const loginForm = document.getElementById('login-form');
    const authError = document.getElementById('auth-error');
    const logoutBtn = document.getElementById('btn-logout');

    const form = document.getElementById('expense-form');
    const editIdInput = document.getElementById('edit-expense-id');
    const submitBtn = document.getElementById('btn-submit-expense');
    const cancelEditBtn = document.getElementById('btn-cancel-edit');
    const setBudgetBtn = document.getElementById('btn-set-budget');
    const expenseList = document.getElementById('expense-list');

    // 1. Category selection buttons
    const catButtons = document.querySelectorAll('.cat-btn');
    const selectedCatInput = document.getElementById('selected-category');
    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            catButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCatInput.value = btn.dataset.category;
        });
    });

    // 2. Filter buttons (Today / Month / All)
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            await refreshApp();
        });
    });

    // 3. Monthly budget setup
    if (setBudgetBtn) {
        setBudgetBtn.addEventListener('click', async () => {
            const current = localStorage.getItem('monthly_budget_limit') || '';
            const input = prompt('أدخل سقف الميزانية الشهرية بالدينار (أو 0 لإخفاء الشريط):', current);
            if (input === null) return;

            const value = parseFloat(input);
            if (!isNaN(value) && value >= 0) {
                localStorage.setItem('monthly_budget_limit', value.toString());
                await refreshApp();
            }
        });
    }

    // 4. Reset form from Edit Mode back to Add Mode
    function resetFormMode() {
        if (editIdInput) editIdInput.value = '';
        const amountInput = document.getElementById('amount');
        const noteInput = document.getElementById('note');
        if (amountInput) amountInput.value = '';
        if (noteInput) noteInput.value = '';
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        if (submitBtn) submitBtn.textContent = '＋ إضافة المصروف';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', async () => {
            resetFormMode();
            await refreshApp();
        });
    }

    // 5. Add or Update expense form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amountInput = document.getElementById('amount');
            const noteInput = document.getElementById('note');
            const amountVal = parseFloat(amountInput.value);

            if (!amountVal || amountVal <= 0) return;

            try {
                const payload = {
                    amount: amountVal,
                    category: selectedCatInput.value,
                    note: noteInput.value,
                    date: dateInput.value
                };

                if (editIdInput && editIdInput.value) {
                    await ExpenseDB.updateExpense(editIdInput.value, payload);
                } else {
                    await ExpenseDB.addExpense(payload);
                }

                resetFormMode();
                amountInput.focus();
                await refreshApp();
                triggerSync();
            } catch (err) {
                alert('حدث خطأ أثناء الحفظ: ' + err.message);
                console.error(err);
            }
        });
    }

    // 6. Edit or Delete expense from the list
    if (expenseList) {
        expenseList.addEventListener('click', async (e) => {
            const targetBtn = e.target.closest('button');
            if (!targetBtn) return;

            const id = targetBtn.dataset.id;
            if (!id) return;

            if (targetBtn.classList.contains('btn-delete')) {
                if (editIdInput && editIdInput.value === id) resetFormMode();
                await ExpenseDB.softDeleteExpense(id);
                await refreshApp();
                triggerSync();
            } else if (targetBtn.classList.contains('btn-edit')) {
                const record = await ExpenseDB.getExpenseById(id);
                if (!record) return;

                if (editIdInput) editIdInput.value = record.id;
                document.getElementById('amount').value = record.amount;
                document.getElementById('note').value = record.note;
                if (dateInput) dateInput.value = record.date;

                catButtons.forEach(b => {
                    b.classList.toggle('active', b.dataset.category === record.category);
                });
                selectedCatInput.value = record.category;

                if (submitBtn) submitBtn.textContent = '✓ حفظ التعديلات';
                if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
                document.getElementById('amount').focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                await refreshApp();
            }
        });
    }

    // 7. Authentication (Login & Logout)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!window.AppSync) {
                authError.textContent = 'ملف المزامنة sync.js غير محمّل بعد';
                return;
            }
            authError.textContent = '';
            const btn = document.getElementById('btn-login');
            btn.disabled = true;
            btn.textContent = 'جاري الدخول...';

            try {
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                await window.AppSync.signIn(email, password);

                if (authScreen) authScreen.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'inline-block';
                triggerSync();
            } catch (err) {
                authError.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
                console.error(err);
            } finally {
                btn.disabled = false;
                btn.textContent = 'دخول';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (window.AppSync) await window.AppSync.signOut();
            logoutBtn.style.display = 'none';
            if (authScreen) authScreen.style.display = 'flex';
        });
    }

    // 8. Initialize IndexedDB, check auth session, and sync
    try {
        await ExpenseDB.init();
        await refreshApp();

        if (window.AppSync && typeof window.AppSync.getSession === 'function') {
            const session = await window.AppSync.getSession();
            if (!session) {
                if (authScreen) authScreen.style.display = 'flex';
            } else {
                if (authScreen) authScreen.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'inline-block';
                triggerSync();
            }
        }
    } catch (err) {
        console.error('فشل التهيئة:', err);
    }

    window.addEventListener('online', triggerSync);

    function triggerSync() {
        if (window.AppSync && typeof window.AppSync.syncNow === 'function') {
            window.AppSync.syncNow(refreshApp);
        }
    }

async function refreshApp() {
        const [expenses, categories] = await Promise.all([
            ExpenseDB.getActiveExpenses(),
            ExpenseDB.getActiveCategories()
        ]);
        UI.renderCategorySelectors(categories, selectedCatInput.value, selectedSubInput.value);
        UI.renderCategoryManager(categories);
        UI.updateSummaries(expenses);
        UI.renderExpenses(expenses, currentFilter, editIdInput ? editIdInput.value : '');
    }
    // تفاعل اختيار الفئة الرئيسية والفرعية ديناميكياً
    const catGrid = document.getElementById('category-grid');
    const subGrid = document.getElementById('subcategory-grid');
    const selectedSubInput = document.getElementById('selected-subcategory');

    catGrid.addEventListener('click', async (e) => {
        const btn = e.target.closest('.cat-btn');
        if (!btn) return;
        selectedCatInput.value = btn.dataset.name;
        selectedSubInput.value = '';
        const cats = await ExpenseDB.getActiveCategories();
        UI.renderCategorySelectors(cats, selectedCatInput.value, '');
    });

    subGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.subcat-btn');
        if (!btn) return;
        // النقر مرة ثانية يلغي تحديد الفرع (اختياري)
        const isSame = selectedSubInput.value === btn.dataset.name;
        selectedSubInput.value = isSame ? '' : btn.dataset.name;
        subGrid.querySelectorAll('.subcat-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.name === selectedSubInput.value);
        });
    });

    // إدارة الفئات (فتح/إغلاق النافذة، حفظ، تعديل، حذف)
    const catModal = document.getElementById('cat-modal');
    const catForm = document.getElementById('cat-manage-form');
    const catManageList = document.getElementById('cat-manage-list');

    document.getElementById('btn-manage-cats').addEventListener('click', async () => {
        const cats = await ExpenseDB.getActiveCategories();
        UI.renderCategoryManager(cats);
        catModal.style.display = 'flex';
    });

    document.getElementById('btn-close-cat-modal').addEventListener('click', () => {
        catModal.style.display = 'none';
    });

    catForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-cat-id').value || null;
        const name = document.getElementById('cat-name-input').value;
        const icon = document.getElementById('cat-icon-input').value;
        const parent_id = document.getElementById('cat-parent-select').value || null;

        await ExpenseDB.saveCategory({ id, name, icon, parent_id });
        document.getElementById('edit-cat-id').value = '';
        document.getElementById('cat-name-input').value = '';
        document.getElementById('cat-icon-input').value = '📁';
        document.getElementById('cat-parent-select').value = '';
        document.getElementById('btn-cancel-cat-edit').style.display = 'none';

        await refreshApp();
        triggerSync();
    });

    catManageList.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const catId = btn.dataset.catId;
        const cats = await ExpenseDB.getActiveCategories();

        if (btn.classList.contains('btn-delete')) {
            if (!confirm('سيتم حذف هذه الفئة وفروعها (تبقى المصاريف السابقة محفوظة). هل أنت متأكد؟')) return;
            await ExpenseDB.softDeleteCategory(catId);
            await refreshApp();
            triggerSync();
        } else if (btn.classList.contains('btn-edit')) {
            const cat = cats.find(c => c.id === catId);
            if (!cat) return;
            document.getElementById('edit-cat-id').value = cat.id;
            document.getElementById('cat-name-input').value = cat.name;
            document.getElementById('cat-icon-input').value = cat.icon;
            document.getElementById('cat-parent-select').value = cat.parent_id || '';
            document.getElementById('btn-cancel-cat-edit').style.display = 'inline-block';
        }
    });

    document.getElementById('btn-cancel-cat-edit').addEventListener('click', () => {
        document.getElementById('edit-cat-id').value = '';
        document.getElementById('cat-name-input').value = '';
        document.getElementById('cat-icon-input').value = '📁';
        document.getElementById('cat-parent-select').value = '';
        document.getElementById('btn-cancel-cat-edit').style.display = 'none';
    });
});