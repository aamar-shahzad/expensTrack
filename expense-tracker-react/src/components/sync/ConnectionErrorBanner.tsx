import { useSyncStore } from '@/stores/syncStore';
import { useSyncActions } from '@/contexts/SyncActionsContext';

export function ConnectionErrorBanner() {
  const connectionError = useSyncStore((s) => s.connectionError);
  const syncActions = useSyncActions();

  if (!connectionError) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 safe-top">
      <span className="text-sm font-medium truncate flex-1">Connection failed</span>
      <button
        type="button"
        onClick={() => syncActions?.retryConnection()}
        className="flex-shrink-0 px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium active:bg-white/30"
      >
        Retry
      </button>
    </div>
  );
}
