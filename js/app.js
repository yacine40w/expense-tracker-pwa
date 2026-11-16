document.addEventListener('DOMContentLoaded', async () => {
    let currentFilter = 'today';

    // 1. تعيين تاريخ اليوم تلقائياً في حقل التاريخ
    const dateInput = document.getElementById('date');
    dateInput.value = new Date().toISOString().split('T')[0];

    // 2. تشغيل قاعدة البيانات المحلية وجلب البيانات الأولية
    await ExpenseDB.init();
    await refreshApp();

    // 3. تفعيل أزرار اختيار الفئة
    const catButtons = document.querySelectorAll('.cat-btn');
    const selectedCatInput = document.getElementById('selected-category');

    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            catButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCatInput.value = btn.dataset.category;
        });
    });

    // 4. تفعيل أزرار التصفية (اليوم / الشهر / الكل)
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            await refreshApp();
        });
    });

    // 5. معالجة إرسال النموذج (إضافة مصروف)
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

        // تفريغ حقل المبلغ والملاحظة بعد الحفظ
        amountInput.value = '';
        noteInput.value = '';
        amountInput.focus();

        await refreshApp();
    });

    // 6. معالجة حذف مصروف
    document.getElementById('expense-list').addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const id = e.target.dataset.id;
            await ExpenseDB.deleteExpense(id);
            await refreshApp();
        }
    });

    // دالة تحديث الواجهة بالكامل
    async function refreshApp() {
        const expenses = await ExpenseDB.getAllExpenses();
        UI.updateSummaries(expenses);
        UI.renderExpenses(expenses, currentFilter);
    }
});