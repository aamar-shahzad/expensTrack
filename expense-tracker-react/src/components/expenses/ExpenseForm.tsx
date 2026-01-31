import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Expense, Template } from '@/types';
import { getToday } from '@/types';
import { Button, useToast } from '@/components/ui';
import { Sheet } from '@/components/ui/Modal';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useCamera } from '@/hooks/useCamera';
import { haptic, cn } from '@/lib/utils';
import * as db from '@/db/operations';

interface ExpenseFormProps {
  expense?: Expense;
  onSuccess?: () => void;
}

export function ExpenseForm({ expense, onSuccess }: ExpenseFormProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const addExpense = useExpenseStore(s => s.addExpense);
  const updateExpense = useExpenseStore(s => s.updateExpense);
  const allExpenses = useExpenseStore(s => s.allExpenses);
  const people = usePeopleStore(s => s.people);
  const lastPayerId = usePeopleStore(s => s.lastPayerId);
  const setLastPayer = usePeopleStore(s => s.setLastPayer);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  const currency = useSettingsStore(s => s.currency);
  const isConnected = useSyncStore(s => s.isConnected);
  const { processOCR, saveImage, isProcessing, ocrProgress } = useCamera();

  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount] = useState(expense?.amount?.toString() || '');
  const [date, setDate] = useState(expense?.date || getToday());
  const [payerId, setPayerId] = useState(expense?.payerId || lastPayerId || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [tags, setTags] = useState(expense?.tags || '');
  const [loading, setLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [attachedImage, setAttachedImage] = useState<Blob | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showManageTemplates, setShowManageTemplates] = useState(false);

  // Description suggestions from past expenses (same description, different dates/amounts)
  const [showDescriptionSuggestions, setShowDescriptionSuggestions] = useState(false);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  
  const amountInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Create preview URL when image changes
  const updatePreviewUrl = useCallback((blob: Blob | null) => {
    // Revoke old URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    
    // Create new URL
    if (blob) {
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Sync form state when expense prop changes (e.g. async load for edit)
  useEffect(() => {
    if (!expense) return;
    setDescription(expense.description || '');
    setAmount(expense.amount?.toString() || '');
    setDate(expense.date || getToday());
    setPayerId(expense.payerId || lastPayerId || '');
    setNotes(expense.notes || '');
    setTags(expense.tags || '');
  }, [expense?.id, expense?.description, expense?.amount, expense?.date, expense?.payerId, expense?.notes, expense?.tags, lastPayerId]);

  // Set default payer when adding in shared mode
  useEffect(() => {
    if (isSharedMode && !expense && !payerId && people.length > 0) {
      setPayerId(lastPayerId || people[0].id);
    }
  }, [isSharedMode, expense, people, payerId, lastPayerId]);

  // Focus amount input on mount (add only)
  useEffect(() => {
    if (!expense) setTimeout(() => amountInputRef.current?.focus(), 100);
  }, [expense]);

  // Unique past descriptions, most recent first (same description can have different dates/amounts)
  const descriptionSuggestions = useMemo(() => {
    const byDesc: Record<string, number> = {};
    allExpenses.forEach(e => {
      const d = (e.description ?? '').trim();
      if (!d) return;
      const existing = byDesc[d];
      const t = e.date ? new Date(e.date).getTime() : 0;
      if (existing == null || t > existing) byDesc[d] = t;
    });
    const query = description.trim().toLowerCase();
    return Object.entries(byDesc)
      .filter(([d]) => !query || d.toLowerCase().includes(query))
      .sort((a, b) => b[1] - a[1])
      .map(([d]) => d)
      .slice(0, 8);
  }, [allExpenses, description]);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const t = await db.getTemplates();
      setTemplates(t);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  const applyTemplate = async (template: Template) => {
    haptic('light');
    if (template.amount) setAmount(template.amount.toString());
    setDescription(template.description);
    if (template.payerId) setPayerId(template.payerId);
    
    // Increment use count
    await db.incrementTemplateUse(template.id);
    loadTemplates();
    showSuccess('Template applied');
  };

  const saveAsTemplate = async () => {
    if (!description.trim()) {
      showError('Enter a description first');
      return;
    }
    
    haptic('light');
    try {
      await db.addTemplate({
        description: description.trim(),
        amount: amount ? parseFloat(amount) : undefined,
        payerId: isSharedMode ? payerId : undefined
      });
      showSuccess('Template saved!');
      loadTemplates();
    } catch (e) {
      console.error('Failed to save template:', e);
      showError('Failed to save template');
    }
  };

  const deleteTemplate = async (id: string) => {
    haptic('light');
    try {
      await db.deleteTemplate(id);
      loadTemplates();
      showSuccess('Template deleted');
    } catch (e) {
      console.error('Failed to delete template:', e);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    haptic('light');
    setAttachedImage(file);
    updatePreviewUrl(file);
    
    // Process OCR to extract data
    const result = await processOCR(file);
    
    if (result.amount && !amount) {
      setAmount(result.amount.toString());
    }
    if (result.description && !description) {
      setDescription(result.description);
    }
    if (result.date) {
      setDate(result.date);
    }
    
    if (result.amount) {
      haptic('success');
      showSuccess('Receipt scanned!');
    }
    
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    haptic('light');
    setAttachedImage(null);
    updatePreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    
    // Validation
    if (!amountNum || amountNum <= 0) {
      showError('Enter a valid amount greater than 0');
      haptic('error');
      return;
    }
    if (!description.trim()) {
      showError('Enter a description');
      haptic('error');
      return;
    }
    if (isSharedMode && !payerId) {
      showError('Select who paid');
      haptic('error');
      return;
    }
    // Validate payerId exists in people list
    if (isSharedMode && payerId && !people.find(p => p.id === payerId)) {
      showError('Selected payer no longer exists');
      haptic('error');
      return;
    }

    setLoading(true);
    haptic('light');

    try {
      // Save image if attached
      let imageId: string | undefined;
      if (attachedImage) {
        imageId = await saveImage(attachedImage);
      }

      if (expense) {
        await updateExpense(expense.id, {
          description: description.trim(),
          amount: amountNum,
          date,
          payerId: isSharedMode ? payerId : undefined,
          notes: notes.trim() || undefined,
          tags: tags.trim() || undefined,
          imageId: imageId || expense.imageId
        });
        showSuccess(isConnected ? 'Updated · synced' : 'Updated!');
      } else {
        await addExpense({
          description: description.trim(),
          amount: amountNum,
          date,
          payerId: isSharedMode ? payerId : undefined,
          splitType: 'equal',
          notes: notes.trim() || undefined,
          tags: tags.trim() || undefined,
          imageId
        });

        if (payerId) {
          setLastPayer(payerId);
        }

        showSuccess(isConnected ? 'Saved · synced' : 'Saved!');
      }

      haptic('success');
      onSuccess?.();
      // Let store/observer updates flush before navigating so home shows the new expense
      await new Promise(r => setTimeout(r, 0));
      navigate('/');
    } catch (error) {
      console.error('Failed to save:', error);
      const message = error instanceof Error ? error.message : 'Failed to save expense';
      showError(message);
      haptic('error');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayAmount = (val: string) => {
    if (!val) return '0';
    const num = parseFloat(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <form onSubmit={handleSubmit} className="pb-2">
      {/* Amount Section - Hero */}
      <div className="bg-gradient-to-br from-[var(--teal-green)] to-[var(--primary)] text-white px-6 py-8 text-center">
        <div className="text-sm opacity-80 mb-2">Amount</div>
        <div className="flex items-center justify-center gap-1">
          <span className="text-4xl font-light">{currency}</span>
          <input
            ref={amountInputRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              // Only allow one decimal point
              const parts = val.split('.');
              if (parts.length > 2) return;
              if (parts[1]?.length > 2) return;
              setAmount(val);
            }}
            placeholder="0"
            className="bg-transparent border-none outline-none text-5xl font-bold text-center w-40 placeholder:text-white/40"
          />
        </div>
        {amount && parseFloat(amount) > 0 && (
          <div className="text-sm opacity-70 mt-2">
            {currency}{formatDisplayAmount(amount)}
          </div>
        )}
        {/* Quick amount chips */}
        {!expense && (
          <div className="flex flex-wrap justify-center gap-2 mt-4 px-2">
            {[5, 10, 20, 50, 100, 200].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { haptic('light'); setAmount(prev => (parseFloat(prev || '0') + n).toString()); }}
                className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-white/20 text-white active:bg-white/30"
              >
                +{n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Existing receipt (edit mode) */}
      {expense?.imageId && !attachedImage && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-[var(--white)] border border-[var(--border)] flex items-center gap-3">
          <span className="text-2xl">🧾</span>
          <span className="text-[15px] text-[var(--text-secondary)]">Receipt attached</span>
        </div>
      )}

      {/* Image Preview */}
      {attachedImage && imagePreviewUrl && (
        <div className="relative mx-4 mt-4">
          <div className="relative rounded-xl overflow-hidden bg-[var(--bg)]">
            <img
              src={imagePreviewUrl}
              alt="Receipt"
              className="w-full h-40 object-cover"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-3 border-white border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-white text-sm">Scanning... {ocrProgress}%</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Quick Templates */}
      {templates.length > 0 && (
        <div className="px-4 py-3 bg-[var(--white)] border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Quick Add</span>
            <button
              type="button"
              onClick={() => setShowManageTemplates(true)}
              className="text-xs text-[var(--teal-green)] font-medium"
            >
              Edit
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {templates.slice(0, 5).map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[var(--bg)] rounded-full active:scale-95 transition-transform"
              >
                <span className="text-sm font-medium truncate max-w-[100px]">{template.description}</span>
                {template.amount && (
                  <span className="text-xs text-[var(--teal-green)] font-semibold">
                    {currency}{template.amount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="bg-[var(--white)] divide-y divide-[var(--border)]">
        {/* Description with past-description suggestions */}
        <div className="px-4 py-3 relative">
          <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
            Description
          </label>
          <input
            ref={descriptionInputRef}
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onFocus={() => setShowDescriptionSuggestions(true)}
            onBlur={() => setTimeout(() => setShowDescriptionSuggestions(false), 180)}
            placeholder="What was this for?"
            className="w-full min-h-[48px] py-2 bg-transparent border-none outline-none text-[16px] placeholder:text-[var(--text-secondary)]"
            autoComplete="off"
          />
          {showDescriptionSuggestions && descriptionSuggestions.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-0 z-10 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-lg max-h-48 overflow-y-auto">
              <div className="py-1 text-[11px] text-[var(--text-secondary)] px-3 pt-2">
                Past descriptions — tap to reuse (amount/date can differ)
              </div>
              {descriptionSuggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => {
                    haptic('light');
                    setDescription(s);
                    setShowDescriptionSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-[15px] hover:bg-[var(--bg)] active:bg-[var(--teal-green)]/10 truncate"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date */}
        <div className="px-4 py-3">
          <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full min-h-[48px] bg-transparent border-none outline-none text-[16px] py-2"
          />
        </div>

        {/* Payer (shared mode only) */}
        {isSharedMode && people.length > 0 && (
          <div className="px-4 py-3">
            <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
              Paid By
            </label>
            <select
              value={payerId}
              onChange={e => setPayerId(e.target.value)}
              className="w-full min-h-[48px] pl-3 pr-10 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[16px] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--teal-green)]/50"
              aria-label="Who paid?"
            >
              <option value="">Who paid?</option>
              {people.map(person => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* More Options Toggle */}
      <button
        type="button"
        onClick={() => setShowMoreOptions(!showMoreOptions)}
        className="w-full px-4 py-3 flex items-center justify-between text-[var(--text-secondary)] text-sm bg-[var(--bg)]"
      >
        <span>More options</span>
        <span className={cn('transition-transform', showMoreOptions && 'rotate-180')}>▾</span>
      </button>

      {/* Additional Options */}
      {showMoreOptions && (
        <div className="bg-[var(--white)] divide-y divide-[var(--border)] animate-fadeIn">
          {/* Tags */}
          <div className="px-4 py-3">
            <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g., work, vacation"
              className="w-full bg-transparent border-none outline-none text-[16px] placeholder:text-[var(--text-secondary)]"
            />
          </div>

          {/* Notes */}
          <div className="px-4 py-3">
            <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={3}
              className="w-full bg-transparent border-none outline-none text-[16px] placeholder:text-[var(--text-secondary)] resize-none"
            />
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Image/Camera Options */}
      <div className="px-4 py-4 flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/camera')}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--white)] rounded-xl text-[var(--text-secondary)] active:bg-[var(--bg)] transition-colors"
        >
          <span className="text-xl">📷</span>
          <span className="text-[14px]">Scan receipt</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--white)] rounded-xl text-[var(--text-secondary)] active:bg-[var(--bg)] transition-colors"
        >
          <span className="text-xl">🖼️</span>
          <span className="text-[14px]">Add photo</span>
        </button>
      </div>

      {/* Save as Template Button */}
      {!expense && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={saveAsTemplate}
            className="w-full min-h-[48px] py-3 bg-[var(--white)] rounded-xl text-[var(--text-secondary)] text-sm font-medium active:bg-[var(--bg)] transition-colors border border-[var(--border)]"
          >
            Save as Template
          </button>
        </div>
      )}

      {/* Submit Button */}
      <div className="px-4 pt-4 pb-2">
        <Button
          type="submit"
          loading={loading || isProcessing}
          className="w-full min-h-[52px] text-[17px] font-semibold rounded-2xl shadow-lg shadow-[var(--teal-green)]/30"
        >
          {expense ? 'Update Expense' : 'Save Expense'}
        </Button>
      </div>

      {/* Manage Templates Modal */}
      <Sheet
        isOpen={showManageTemplates}
        onClose={() => setShowManageTemplates(false)}
        title="Manage Templates"
      >
        <div className="divide-y divide-[var(--border)]">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">
              No templates yet.<br />
              Save an expense as a template to get started.
            </div>
          ) : (
            templates.map(template => (
              <div key={template.id} className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{template.description}</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {template.amount ? `${currency}${template.amount}` : 'No amount'}
                    {template.useCount > 0 && ` · Used ${template.useCount}x`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteTemplate(template.id)}
                  className="w-10 h-10 flex items-center justify-center text-[var(--danger)] text-xl rounded-full active:bg-[var(--danger)]/10"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </Sheet>
    </form>
  );
}
