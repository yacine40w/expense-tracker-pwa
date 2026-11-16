const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'expenses';

const ExpenseDB = {
    db: null,

    // فتح أو إنشاء قاعدة البيانات
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('date', 'date', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('خطأ في فتح قاعدة البيانات:', event.target.error);
                reject(event.target.error);
            };
        });
    },

    // إضافة مصروف جديد
    addExpense(expense) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const record = {
                id: crypto.randomUUID(), // معرف فريد عالمي لمنع التضارب مستقبلاً
                amount: parseFloat(expense.amount),
                category: expense.category,
                note: expense.note.trim(),
                date: expense.date,
                updated_at: new Date().toISOString(),
                is_synced: false
            };

            const request = store.add(record);
            request.onsuccess = () => resolve(record);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // جلب جميع المصاريف
    getAllExpenses() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                // ترتيب من الأحدث للأقدم حسب التاريخ ثم وقت التحديث
                const sorted = request.result.sort((a, b) => {
                    if (b.date !== a.date) return b.date.localeCompare(a.date);
                    return b.updated_at.localeCompare(a.updated_at);
                });
                resolve(sorted);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // حذف مصروف
    deleteExpense(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
};