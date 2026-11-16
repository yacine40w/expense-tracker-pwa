document.addEventListener('DOMContentLoaded', async () => {
    let currentFilter = 'today';
    const dateInput = document.getElementById('date');
    dateInput.value = new Date().toISOString().split('T')[0];

    await ExpenseDB.init();
    await refreshApp();

    // مزامنة فورية عند فتح التطبيق
    SyncManager.syncNow(refreshApp);

    // مزامنة تلقائية بمجرد عودة الإنترنت
    window.addEventListener('online', () => SyncManager.syncNow(refreshApp));
    window.addEventListener('offline', () => SyncManager.updateStatusUI('غير متصل (محلي)', false));

    // أزرار الفئات
    const catButtons = document.querySelectorAll('.cat-btn');
    const selectedCatInput = document.getElementById('selected-category');
    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            catButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCatInput.value = btn.dataset.category;
        });
    });

    // أزرار التصفية
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            await refreshApp();
        });
    });

    // إضافة مصروف ومزامنته فوراً
    const form = document.getElementById('expense-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amountInput = document.getElementById('amount');
        const noteInput = document.getElementById('note');

        if (!amountInput.value || parseFloat(amountInput.value) <= 0) return;

        await ExpenseDB.addExpense({
            amount: amountInput.value,
            category: selectedCatInput.value,
            note: noteInput.value,
            date: dateInput.value
        });

        amountInput.value = '';
        noteInput.value = '';
        amountInput.focus();

        await refreshApp();
        SyncManager.syncNow(refreshApp);
    });

    // حذف مصروف ومزامنته فوراً
    document.getElementById('expense-list').addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const id = e.target.dataset.id;
            await ExpenseDB.softDeleteExpense(id);
            await refreshApp();
            SyncManager.syncNow(refreshApp);
        }
    });

    async function refreshApp() {
        const expenses = await ExpenseDB.getActiveExpenses();
        UI.updateSummaries(expenses);
        UI.renderExpenses(expenses, currentFilter);
    }
});