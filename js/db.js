
const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 3;
const STORE_NAME = 'expenses';
const CAT_STORE = 'categories';

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
                if (!db.objectStoreNames.contains(CAT_STORE)) {
                    db.createObjectStore(CAT_STORE, { keyPath: 'id' });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.seedDefaultCategories();
                resolve(this.db);
            };

            request.onerror = (event) => reject(event.target.error);
        });
    },

    // زرع فئات افتراضية عند التشغيل الأول فقط
    async seedDefaultCategories() {
        const existing = await this.getAllCategoriesRaw();
        if (existing.length > 0) return;

        const defaults = [
            { name: 'طعام', icon: '🍔', subs: ['مطاعم', 'مقاهي', 'مشتريات البيت'] },
            { name: 'نقل', icon: '🚗', subs: ['وقود', 'نقل عمومي', 'صيانة'] },
            { name: 'فواتير', icon: '💡', subs: ['كهرباء وغاز', 'إنترنت وهاتف', 'ماء'] },
            { name: 'تسوق', icon: '🛍️', subs: ['ملابس', 'إلكترونيات'] },
            { name: 'صحة', icon: '🏥', subs: ['أدوية', 'طبيب'] },
            { name: 'أخرى', icon: '📦', subs: [] }
        ];

        for (const cat of defaults) {
            const parent = await this.saveCategory({ name: cat.name, icon: cat.icon, parent_id: null });
            for (const subName of cat.subs) {
                await this.saveCategory({ name: subName, icon: '•', parent_id: parent.id });
            }
        }
    },

    // --- دوال الفئات (Categories) ---
    getAllCategoriesRaw() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CAT_STORE], 'readonly');
            const req = tx.objectStore(CAT_STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async getActiveCategories() {
        const all = await this.getAllCategoriesRaw();
        return all.filter(c => !c.is_deleted);
    },

    saveCategory({ id = null, name, icon = '📁', parent_id = null }) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CAT_STORE], 'readwrite');
            const store = tx.objectStore(CAT_STORE);
            const record = {
                id: id || crypto.randomUUID(),
                name: name.trim(),
                icon: icon.trim() || '📁',
                parent_id: parent_id || null,
                updated_at: new Date().toISOString(),
                is_deleted: false,
                is_synced: false
            };
            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    softDeleteCategory(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CAT_STORE], 'readwrite');
            const store = tx.objectStore(CAT_STORE);
            const req = store.getAll();

            req.onsuccess = () => {
                const now = new Date().toISOString();
                // حذف الفئة وأي فروع تابعة لها منطقياً
                req.result.forEach(item => {
                    if (item.id === id || item.parent_id === id) {
                        item.is_deleted = true;
                        item.updated_at = now;
                        item.is_synced = false;
                        store.put(item);
                    }
                });
            };
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    async getUnsyncedCategories() {
        const all = await this.getAllCategoriesRaw();
        return all.filter(c => !c.is_synced);
    },

    upsertCategoriesFromCloud(records) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CAT_STORE], 'readwrite');
            const store = tx.objectStore(CAT_STORE);
            records.forEach(cloudItem => {
                const getReq = store.get(cloudItem.id);
                getReq.onsuccess = () => {
                    const localItem = getReq.result;
                    if (!localItem || new Date(cloudItem.updated_at) >= new Date(localItem.updated_at)) {
                        store.put({ ...cloudItem, is_synced: true });
                    }
                };
            });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    // --- دوال المصاريف (مع دعم subcategory) ---
    addExpense(expense) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const record = {
                id: crypto.randomUUID(),
                amount: parseFloat(expense.amount),
                category: expense.category,
                subcategory: expense.subcategory || '',
                note: expense.note.trim(),
                date: expense.date,
                updated_at: new Date().toISOString(),
                is_deleted: false,
                is_synced: false
            };
            const req = tx.objectStore(STORE_NAME).add(record);
            req.onsuccess = () => resolve(record);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    updateExpense(id, updatedFields) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (!record) return reject(new Error('السجل غير موجود'));
                record.amount = parseFloat(updatedFields.amount);
                record.category = updatedFields.category;
                record.subcategory = updatedFields.subcategory || '';
                record.note = updatedFields.note.trim();
                record.date = updatedFields.date;
                record.updated_at = new Date().toISOString();
                record.is_synced = false;
                const putReq = store.put(record);
                putReq.onsuccess = () => resolve(record);
                putReq.onerror = (e) => reject(e.target.error);
            };
        });
    },

    // (أبقِ دوال getActiveExpenses, getExpenseById, softDeleteExpense, getUnsyncedRecords, upsertFromCloud كما هي)
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
};