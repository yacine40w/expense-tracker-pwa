<<<<<<< HEAD
const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 2;
const STORE_NAME = 'expenses';

const ExpenseDB = {
    db: null,

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

            request.onerror = (event) => reject(event.target.error);
        });
    },

    // إضافة مصروف محلياً
    addExpense(expense) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const record = {
                id: crypto.randomUUID(),
                amount: parseFloat(expense.amount),
                category: expense.category,
                note: expense.note.trim(),
                date: expense.date,
                updated_at: new Date().toISOString(),
                is_deleted: false,
                is_synced: false
            };

            const request = store.add(record);
            request.onsuccess = () => resolve(record);
            request.onerror = (e) => reject(e.target.error);
        });
    },
// جلب مصروف واحد للتعديل
    getExpenseById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // تعديل مصروف موجود مع تحديث طابع المزامنة
    updateExpense(id, updatedFields) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const record = getReq.result;
                if (!record) return reject(new Error('السجل غير موجود'));

                record.amount = parseFloat(updatedFields.amount);
                record.category = updatedFields.category;
                record.note = updatedFields.note.trim();
                record.date = updatedFields.date;
                record.updated_at = new Date().toISOString();
                record.is_synced = false; // سيُرفع التعديل للسحابة تلقائياً

                const putReq = store.put(record);
                putReq.onsuccess = () => resolve(record);
                putReq.onerror = (e) => reject(e.target.error);
            };
            getReq.onerror = (e) => reject(e.target.error);
        });
    },
    // جلب المصاريف النشطة فقط للعرض في الواجهة
    getActiveExpenses() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const active = request.result
                    .filter(item => !item.is_deleted)
                    .sort((a, b) => {
                        if (b.date !== a.date) return b.date.localeCompare(a.date);
                        return b.updated_at.localeCompare(a.updated_at);
                    });
                resolve(active);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // حذف منطقي (يُعلّم كمحذوف ليتم حذفه في السحابة أيضاً)
    softDeleteExpense(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const record = getReq.result;
                if (!record) return resolve();

                record.is_deleted = true;
                record.updated_at = new Date().toISOString();
                record.is_synced = false;

                const putReq = store.put(record);
                putReq.onsuccess = () => resolve(record);
                putReq.onerror = (e) => reject(e.target.error);
            };
        });
    },

    // جلب السجلات غير المتزامنة لرفعها إلى Supabase
    getUnsyncedRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result.filter(item => !item.is_synced));
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // دمج السجلات القادمة من السحابة مع القاعدة المحلية
    upsertFromCloud(records) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            records.forEach(cloudItem => {
                const getReq = store.get(cloudItem.id);
                getReq.onsuccess = () => {
                    const localItem = getReq.result;
                    // نحدّث المحلي فقط إذا كان سجل السحابة أحدث أو غير موجود محلياً
                    if (!localItem || new Date(cloudItem.updated_at) >= new Date(localItem.updated_at)) {
                        store.put({
                            ...cloudItem,
                            amount: parseFloat(cloudItem.amount),
                            is_synced: true
                        });
                    }
                };
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }
=======
const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 2;
const STORE_NAME = 'expenses';

const ExpenseDB = {
    db: null,

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

            request.onerror = (event) => reject(event.target.error);
        });
    },

    // إضافة مصروف محلياً
    addExpense(expense) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const record = {
                id: crypto.randomUUID(),
                amount: parseFloat(expense.amount),
                category: expense.category,
                note: expense.note.trim(),
                date: expense.date,
                updated_at: new Date().toISOString(),
                is_deleted: false,
                is_synced: false
            };

            const request = store.add(record);
            request.onsuccess = () => resolve(record);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // جلب المصاريف النشطة فقط للعرض في الواجهة
    getActiveExpenses() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const active = request.result
                    .filter(item => !item.is_deleted)
                    .sort((a, b) => {
                        if (b.date !== a.date) return b.date.localeCompare(a.date);
                        return b.updated_at.localeCompare(a.updated_at);
                    });
                resolve(active);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // حذف منطقي (يُعلّم كمحذوف ليتم حذفه في السحابة أيضاً)
    softDeleteExpense(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const record = getReq.result;
                if (!record) return resolve();

                record.is_deleted = true;
                record.updated_at = new Date().toISOString();
                record.is_synced = false;

                const putReq = store.put(record);
                putReq.onsuccess = () => resolve(record);
                putReq.onerror = (e) => reject(e.target.error);
            };
        });
    },

    // جلب السجلات غير المتزامنة لرفعها إلى Supabase
    getUnsyncedRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result.filter(item => !item.is_synced));
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // دمج السجلات القادمة من السحابة مع القاعدة المحلية
    upsertFromCloud(records) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            records.forEach(cloudItem => {
                const getReq = store.get(cloudItem.id);
                getReq.onsuccess = () => {
                    const localItem = getReq.result;
                    // نحدّث المحلي فقط إذا كان سجل السحابة أحدث أو غير موجود محلياً
                    if (!localItem || new Date(cloudItem.updated_at) >= new Date(localItem.updated_at)) {
                        store.put({
                            ...cloudItem,
                            amount: parseFloat(cloudItem.amount),
                            is_synced: true
                        });
                    }
                };
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }
>>>>>>> 21455ab932638ef50d4a512ba0666eeabc63808d
};