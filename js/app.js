document.addEventListener('DOMContentLoaded', async () => {
    let currentFilter = 'today';
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // 1. ربط أزرار الفئات فوراً (قبل قاعدة البيانات)
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

    // 3. ربط النموذج ومنع تحديث الصفحة مهما حدث
    const form = document.getElementById('expense-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // يمنع تحديث الصفحة دائماً

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
            if (typeof SyncManager !== 'undefined') {
                SyncManager.syncNow(refreshApp);
            }
        } catch (err) {
            alert('حدث خطأ أثناء الحفظ: ' + err.message);
            console.error(err);
        }
    });

    // 4. ربط الحذف
    document.getElementById('expense-list').addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const id = e.target.dataset.id;
            await ExpenseDB.softDeleteExpense(id);
            await refreshApp();
            if (typeof SyncManager !== 'undefined') {
                SyncManager.syncNow(refreshApp);
            }
        }
    });

    // 5. تشغيل قاعدة البيانات والمزامنة
    try {
        await ExpenseDB.init();
        await refreshApp();
        if (typeof SyncManager !== 'undefined') {
            SyncManager.syncNow(refreshApp);
        }
    } catch (err) {
        console.error('فشل تهيئة قاعدة البيانات:', err);
    }

    async function refreshApp() {
        const expenses = await ExpenseDB.getActiveExpenses();
        UI.updateSummaries(expenses);
        UI.renderExpenses(expenses, currentFilter);
    }
});