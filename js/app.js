document.addEventListener('DOMContentLoaded', async () => {
    let currentFilter = 'today';
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const authScreen = document.getElementById('auth-screen');
    const loginForm = document.getElementById('login-form');
    const authError = document.getElementById('auth-error');
    const logoutBtn = document.getElementById('btn-logout');

    // 1. ربط أزرار الفئات فوراً
    const catButtons = document.querySelectorAll('.cat-btn');
    const selectedCatInput = document.getElementById('selected-category');
    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            catButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCatInput.value = btn.dataset.category;
        });
    });

    // 2. ربط أزرار التصفية فوراً
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            await refreshApp();
        });
    });

    // 3. ربط نموذج إضافة المصروف
    const form = document.getElementById('expense-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amountInput = document.getElementById('amount');
            const noteInput = document.getElementById('note');
            const amountVal = parseFloat(amountInput.value);

            if (!amountVal || amountVal <= 0) return;

            try {
                await ExpenseDB.addExpense({
                    amount: amountVal,
                    category: selectedCatInput.value,
                    note: noteInput.value,
                    date: dateInput.value
                });

                amountInput.value = '';
                noteInput.value = '';
                amountInput.focus();

                await refreshApp();
                triggerSync();
            } catch (err) {
                alert('حدث خطأ أثناء الحفظ: ' + err.message);
                console.error(err);
            }
        });
    }

    // 4. ربط الحذف
    const expenseList = document.getElementById('expense-list');
    if (expenseList) {
        expenseList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-delete')) {
                const id = e.target.dataset.id;
                await ExpenseDB.softDeleteExpense(id);
                await refreshApp();
                triggerSync();
            }
        });
    }

    // 5. ربط نموذج تسجيل الدخول وزر الخروج
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

    // 6. تهيئة قاعدة البيانات وفحص الجلسة
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
        } else {
            console.warn('window.AppSync غير متوفر - تأكد من تحديث ملف js/sync.js');
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
        const expenses = await ExpenseDB.getActiveExpenses();
        UI.updateSummaries(expenses);
        UI.renderExpenses(expenses, currentFilter);
    }
});