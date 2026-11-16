const SUPABASE_URL = 'https://dowsmxhjixjbnhqcpius.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3NteGhqaXhqYm5ocWNwaXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NDk5ODYsImV4cCI6MjExMDQyNTk4Nn0.FlkGJOxSCRHk5jS3iTlCpvlSjEIRrpS154u1gzWzk8k';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SyncManager = {
    isSyncing: false,

    // تحديث شارة الحالة في الشريط العلوي
    updateStatusUI(statusText, isOnline) {
        const badge = document.getElementById('connection-status');
        if (!badge) return;
        badge.textContent = statusText;
        badge.style.background = isOnline ? '#dcfce7' : '#e2e8f0';
        badge.style.color = isOnline ? '#166534' : '#64748b';
    },

    async syncNow(onDataUpdated) {
        if (!navigator.onLine) {
            this.updateStatusUI('غير متصل (محلي)', false);
            return;
        }

        if (this.isSyncing) return;
        this.isSyncing = true;
        this.updateStatusUI('جاري المزامنة...', true);

        try {
            // 1. رفع التغييرات المحلية غير المتزامنة (Push)
            const unsynced = await ExpenseDB.getUnsyncedRecords();
            if (unsynced.length > 0) {
                const payload = unsynced.map(({ is_synced, ...rest }) => rest);
                const { error: pushError } = await supabaseClient
                    .from('expenses')
                    .upsert(payload, { onConflict: 'id' });

                if (pushError) throw pushError;
            }

            // 2. جلب أحدث التغييرات من السحابة (Pull)
            const lastSync = localStorage.getItem('last_sync_time') || '1970-01-01T00:00:00.000Z';
            const { data: cloudRecords, error: pullError } = await supabaseClient
                .from('expenses')
                .select('*')
                .gt('updated_at', lastSync);

            if (pullError) throw pullError;

            if (cloudRecords && cloudRecords.length > 0) {
                await ExpenseDB.upsertFromCloud(cloudRecords);
            }

            // 3. تحديث طابع آخر مزامنة ناجحة
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