import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Expense } from '@/types';
import { formatDate } from '@/types';
import { Button, useToast, LoadingSpinner } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useYjs } from '@/sync';
import { haptic } from '@/lib/utils';
import { canDeleteExpense } from '@/lib/policies';
import * as db from '@/db/operations';

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const allExpenses = useExpenseStore(s => s.allExpenses);
  const deleteExpense = useExpenseStore(s => s.deleteExpense);
  const getPersonName = usePeopleStore(s => s.getPersonName);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const isSynced = useSyncStore(s => s.isSynced);
  const isConnected = useSyncStore(s => s.isConnected);
  const requestImage = useYjs().requestImage;
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const deviceId = useSyncStore(s => s.deviceId);
  const canDelete = canDeleteExpense(currentAccount, deviceId);
  
  // Prefer store (Yjs source of truth); fallback to DB for legacy or before sync
  const expenseFromStore = id ? allExpenses.find(e => e.id === id) ?? null : null;
  const [expenseFromDb, setExpenseFromDb] = useState<Expense | null>(null);
  const [dbFetched, setDbFetched] = useState(false);
  const effectiveExpense = expenseFromStore ?? expenseFromDb;
  
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const imageUrlRef = useRef<string | null>(null);

  // Fallback: load from IndexedDB (e.g. before Yjs has synced or legacy data)
  useEffect(() => {
    if (!id) return;
    
    const loadFromDb = async () => {
      try {
        const exp = await db.getExpense(id);
        setExpenseFromDb(exp ?? null);
      } catch (e) {
        console.error('Failed to load expense from DB:', e);
      } finally {
        setDbFetched(true);
      }
    };
    
    loadFromDb();
  }, [id]);

  // Load image from IndexedDB; if missing and shared+connected, request from peers
  useEffect(() => {
    if (!effectiveExpense?.imageId) return;
    const imageId = effectiveExpense.imageId;
    let revoked = false;

    const setUrlFromImage = (image: Awaited<ReturnType<typeof db.getImage>>) => {
      if (revoked || !image?.data) return;
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      const url = URL.createObjectURL(image.data);
      imageUrlRef.current = url;
      setImageUrl(url);
      setImageLoading(false);
    };

    void db.getImage(imageId).then((image) => {
      if (revoked) return;
      if (image?.data) {
        setUrlFromImage(image);
        return;
      }
      if (isSharedMode && isConnected) {
        setImageLoading(true);
        void requestImage(imageId)
          .then(() => db.getImage(imageId))
          .then((image2) => {
            if (!revoked) setUrlFromImage(image2);
          })
          .catch(() => {
            if (!revoked) setImageLoading(false);
          })
          .finally(() => {
            if (!revoked) setImageLoading((prev) => (prev ? false : prev));
          });
      }
    });

    return () => {
      revoked = true;
      setImageLoading(false);
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [effectiveExpense?.imageId, isSharedMode, isConnected, requestImage]);

  // Loading: wait for either expense to appear (store or DB) or for sync + DB result
  const loading = Boolean(
    id && !effectiveExpense && (!dbFetched || !isSynced)
  );

  const handleDelete = async () => {
    if (!effectiveExpense) return;
    
    try {
      await deleteExpense(effectiveExpense.id);
      haptic('success');
      showSuccess(isConnected ? 'Expense deleted · synced' : 'Expense deleted');
      navigate('/');
    } catch (e) {
      console.error('Failed to delete:', e);
      showError('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg)]">
        <div className="flex-shrink-0 bg-[var(--bg)] safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
          <button onClick={() => navigate(-1)} className="text-[var(--teal-green)] text-[17px] font-medium">
            ‹ Back
          </button>
          <span className="text-[17px] font-semibold">Expense</span>
          <div className="w-[60px]" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!effectiveExpense) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg)]">
        <div className="flex-shrink-0 bg-[var(--bg)] safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
          <button onClick={() => navigate(-1)} className="text-[var(--teal-green)] text-[17px] font-medium">
            ‹ Back
          </button>
          <span className="text-[17px] font-semibold">Expense</span>
          <div className="w-[60px]" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-2">Expense not found</h3>
          <p className="text-[var(--text-secondary)] text-center mb-6">
            This expense may have been deleted
          </p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const payerName = isSharedMode && effectiveExpense.payerId ? getPersonName(effectiveExpense.payerId) : '';
  const initial = effectiveExpense.description?.trim().charAt(0)?.toUpperCase() || '•';

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 bg-[var(--bg)] safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
        <button 
          onClick={() => navigate(-1)} 
          className="text-[var(--teal-green)] text-[17px] font-medium px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
        >
          ‹ Back
        </button>
        <span className="text-[17px] font-semibold">Expense</span>
        <button 
          onClick={() => navigate(`/expense/${effectiveExpense.id}/edit`)}
          className="text-[var(--teal-green)] text-[17px] font-medium px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
        >
          Edit
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-safe">
        {/* Image Preview */}
        {effectiveExpense.imageId && (
          <div className="w-full aspect-video bg-[var(--border)] flex items-center justify-center">
            {imageLoading ? (
              <div className="flex flex-col items-center gap-2 text-[var(--text-secondary)]">
                <div className="w-10 h-10 border-2 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px]">Loading receipt…</span>
              </div>
            ) : imageUrl ? (
              <button
                onClick={() => setShowFullImage(true)}
                className="w-full h-full flex items-center justify-center"
              >
                <img
                  src={imageUrl}
                  alt="Receipt"
                  className="max-w-full max-h-full object-contain"
                />
              </button>
            ) : null}
          </div>
        )}

        {/* Amount Hero */}
        <div className="bg-gradient-to-br from-[var(--teal-green)] to-[var(--primary)] text-white px-6 py-8 text-center">
          <div className="text-5xl font-bold mb-2">
            {formatAmount(effectiveExpense.amount)}
          </div>
          <div className="text-white/80">
            {formatDate(effectiveExpense.date)}
          </div>
        </div>

        {/* Details */}
        <div className="bg-[var(--white)] divide-y divide-[var(--border)]">
          {/* Description */}
          <div className="px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg)] flex items-center justify-center text-base font-semibold text-[var(--text-secondary)]">
              {initial}
            </div>
            <div className="flex-1">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Description</div>
              <div className="font-medium">{effectiveExpense.description}</div>
            </div>
          </div>

          {/* Payer */}
          {payerName && (
            <div className="px-4 py-4">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">Paid By</div>
              <div className="font-medium">{payerName}</div>
            </div>
          )}

          {/* Tags */}
          {effectiveExpense.tags && (
            <div className="px-4 py-4">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">Tags</div>
              <div className="font-medium">{effectiveExpense.tags}</div>
            </div>
          )}

          {/* Notes */}
          {effectiveExpense.notes && (
            <div className="px-4 py-4">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">Notes</div>
              <div className="text-[var(--text-secondary)]">{effectiveExpense.notes}</div>
            </div>
          )}

          {/* Recurring */}
          {effectiveExpense.recurring && (
            <div className="px-4 py-4 flex items-center gap-2">
              <span className="text-xl">🔄</span>
              <span className="text-[var(--text-secondary)]">Recurring expense</span>
            </div>
          )}
        </div>

        {/* Delete Button (only group creator in shared groups) */}
        <div className="px-4 py-6">
          {canDelete ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 bg-[var(--danger)]/10 text-[var(--danger)] rounded-xl font-medium active:bg-[var(--danger)]/20"
            >
              Delete Expense
            </button>
          ) : (
            <p className="text-[13px] text-[var(--text-secondary)] text-center py-2">
              Only the group creator can delete expenses.
            </p>
          )}
        </div>
      </div>

      {/* Full Image Modal */}
      {showFullImage && imageUrl && (
        <div 
          className="fixed inset-0 z-[1000] bg-black flex items-center justify-center"
          onClick={() => setShowFullImage(false)}
        >
          <button 
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center text-xl safe-top"
            onClick={() => setShowFullImage(false)}
          >
            ✕
          </button>
          <img 
            src={imageUrl} 
            alt="Receipt" 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Expense"
      >
        <div className="p-6 text-center">
          <div className="text-5xl mb-4">🗑️</div>
          <p className="text-[var(--text-secondary)] mb-6">
            Are you sure you want to delete this expense? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[var(--danger)]"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
