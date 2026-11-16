const SUPABASE_URL = 'https://dowsmxhjixjbnhqcpius.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3NteGhqaXhqYm5ocWNwaXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NDk5ODYsImV4cCI6MjExMDQyNTk4Nn0.FlkGJOxSCRHk5jS3iTlCpvlSjEIRrpS154u1gzWzk8k';

window.AppSync = {
    client: null,
    isSyncing: false,

    init() {
        try {
            if (window.supabase && SUPABASE_URL.startsWith('http')) {
                this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
        } catch (e) {
            console.warn('تعذر تهيئة Supabase، سيتم العمل محلياً:', e.message);
        }
    },

    // التحقق من وجود جلسة نشطة (تعمل محلياً حتى بدون إنترنت)
    async getSession() {
        if (!this.client) this.init();
        if (!this.client) return null;
        const { data } = await this.client.auth.getSession();
        return data.session;
    },

    // تسجيل الدخول بالبريد وكلمة المرور
    async signIn(email, password) {
        if (!this.client) this.init();
        const { data, error } = await this.client.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        if (error) throw error;
        return data.session;
    },

    // تسجيل الخروج
    async signOut() {
        if (!this.client) return;
        await this.client.auth.signOut();
    },

    updateStatusUI(statusText, isOnline) {
        const badge = document.getElementById('connection-status');
        if (!badge) return;
        badge.textContent = statusText;
        badge.style.background = isOnline ? '#dcfce7' : '#e2e8f0';
        badge.style.color = isOnline ? '#166534' : '#64748b';
    },

    async syncNow(onDataUpdated) {
        if (!this.client) this.init();

        if (!this.client) {
            this.updateStatusUI('وضع محلي', false);
            return;
        }
        if (!navigator.onLine) {
            this.updateStatusUI('غير متصل (محلي)', false);
            return;
        }
        if (this.isSyncing) return;

        // التأكد من وجود جلسة مصادقة نشطة قبل المزامنة
        const session = await this.getSession();
        if (!session) {
            this.updateStatusUI('بانتظار الدخول', false);
            return;
        }

        this.isSyncing = true;
        this.updateStatusUI('جاري المزامنة...', true);

        try {
            // 0. مزامنة الفئات (رفع ثم جلب)
            const unsyncedCats = await ExpenseDB.getUnsyncedCategories();
            if (unsyncedCats.length > 0) {
                // نرفع الفئات الرئيسية أولاً ثم الفرعية لتجنب تعارض المفتاح الأجنبي parent_id
                const sortedCats = unsyncedCats.sort((a, b) => (a.parent_id ? 1 : -1));
                const catPayload = sortedCats.map(({ is_synced, user_id, ...rest }) => rest);
                const { error: catPushErr } = await this.client
                    .from('categories')
                    .upsert(catPayload, { onConflict: 'id' });
                if (catPushErr) throw catPushErr;

                await ExpenseDB.upsertCategoriesFromCloud(
                    unsyncedCats.map(c => ({ ...c, is_synced: true }))
                );
            }

            const lastCatSync = localStorage.getItem('last_cat_sync_time') || '1970-01-01T00:00:00.000Z';
            const { data: cloudCats, error: catPullErr } = await this.client
                .from('categories')
                .select('*')
                .gt('updated_at', lastCatSync);
            if (catPullErr) throw catPullErr;

            if (cloudCats && cloudCats.length > 0) {
                await ExpenseDB.upsertCategoriesFromCloud(cloudCats);
            }
            localStorage.setItem('last_cat_sync_time', new Date().toISOString());
            
            // 1. رفع السجلات المحلية غير المتزامنة
            const unsynced = await ExpenseDB.getUnsyncedRecords();
            if (unsynced.length > 0) {
                const payload = unsynced.map(({ is_synced, user_id, ...rest }) => rest);
                const { error: pushError } = await this.client
                    .from('expenses')
                    .upsert(payload, { onConflict: 'id' });

                if (pushError) throw pushError;

                await ExpenseDB.upsertFromCloud(
                    unsynced.map(item => ({ ...item, is_synced: true }))
                );
            }

            // 2. جلب التحديثات الجديدة من السحابة
            const lastSync = localStorage.getItem('last_sync_time') || '1970-01-01T00:00:00.000Z';
            const { data: cloudRecords, error: pullError } = await this.client
                .from('expenses')
                .select('*')
                .gt('updated_at', lastSync);

            if (pullError) throw pullError;

            if (cloudRecords && cloudRecords.length > 0) {
                await ExpenseDB.upsertFromCloud(cloudRecords);
            }

            localStorage.setItem('last_sync_time', new Date().toISOString());
            this.updateStatusUI('متزامن ✓', true);

            if (typeof onDataUpdated === 'function') {
                await onDataUpdated();
            }
        } catch (err) {
            console.error('فشل المزامنة:', err.message);
            this.updateStatusUI('خطأ مزامنة', false);
        } finally {
            this.isSyncing = false;
        }
    }
};