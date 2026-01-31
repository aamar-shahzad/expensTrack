import { useState, useRef, useEffect, useCallback } from 'react';
import type { Expense } from '@/types';
import { formatDate } from '@/types';
import { cn, haptic } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSyncStore } from '@/stores/syncStore';
import { useYjs } from '@/sync';
import * as db from '@/db/operations';

interface ExpenseItemProps {
  expense: Expense;
  onTap: () => void;
  onDoubleTap: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isNew?: boolean;
  /** Only group creator can delete in shared groups; when false, hide delete action */
  canDelete?: boolean;
}

export function ExpenseItem({ 
  expense, 
  onTap, 
  onDoubleTap, 
  onLongPress,
  onDelete,
  onDuplicate,
  isNew,
  canDelete = true
}: ExpenseItemProps) {
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const getPersonName = usePeopleStore(s => s.getPersonName);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  const isConnected = useSyncStore(s => s.isConnected);
  const requestImage = useYjs().requestImage;
  
  const [swiped, setSwiped] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const lastTap = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const thumbnailUrlRef = useRef<string | null>(null);

  const payerName = isSharedMode && expense.payerId ? getPersonName(expense.payerId) : '';
  const initial = expense.description?.trim().charAt(0)?.toUpperCase() || '•';

  // Load thumbnail for expenses with images; if missing and shared+connected, request from peers
  const loadThumbnail = useCallback(async () => {
    if (!expense.imageId) return;
    const imageId = expense.imageId;
    try {
      let image = await db.getImage(imageId);
      if (!image?.thumbnail && isSharedMode && isConnected) {
        setThumbnailLoading(true);
        await requestImage(imageId);
        image = await db.getImage(imageId);
      }
      if (image?.thumbnail) {
        if (thumbnailUrlRef.current) URL.revokeObjectURL(thumbnailUrlRef.current);
        const url = URL.createObjectURL(image.thumbnail);
        thumbnailUrlRef.current = url;
        setThumbnailUrl(url);
      }
    } catch (e) {
      console.error('Failed to load thumbnail:', e);
    } finally {
      setThumbnailLoading(false);
    }
  }, [expense.imageId, isSharedMode, isConnected, requestImage]);

  useEffect(() => {
    loadThumbnail();
    
    // Cleanup on unmount
    return () => {
      if (thumbnailUrlRef.current) {
        URL.revokeObjectURL(thumbnailUrlRef.current);
      }
    };
  }, [loadThumbnail]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isHorizontal.current = null;
    
    // Long press detection
    longPressTimer.current = setTimeout(() => {
      if (isDragging.current && !swiped) {
        haptic('medium');
        onLongPress();
        isDragging.current = false;
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    
    clearTimeout(longPressTimer.current);
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;
    
    // Determine direction
    if (isHorizontal.current === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isHorizontal.current = Math.abs(diffX) > Math.abs(diffY);
    }
    
    // Only handle horizontal swipes (max = one or two 75px buttons)
    const maxSwipe = canDelete ? -150 : -75;
    if (isHorizontal.current && diffX < 0) {
      setTranslateX(Math.max(diffX * 0.8, maxSwipe));
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    
    if (!isDragging.current) return;
    isDragging.current = false;
    
    const maxSwipe = canDelete ? -150 : -75;
    if (isHorizontal.current && translateX < -60) {
      setTranslateX(maxSwipe);
      setSwiped(true);
      haptic('light');
    } else {
      setTranslateX(0);
      setSwiped(false);
    }
    
    isHorizontal.current = null;
  };

  const handleClick = () => {
    if (swiped) {
      setTranslateX(0);
      setSwiped(false);
      return;
    }
    
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      haptic('light');
      onDoubleTap();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current !== 0) {
          onTap();
          lastTap.current = 0;
        }
      }, 300);
    }
  };

  // Keyboard support for swipe actions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    } else if (canDelete && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      onDelete();
    } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onDuplicate();
    }
  };

  // Close swipe when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (swiped && itemRef.current && !itemRef.current.contains(e.target as Node)) {
        setTranslateX(0);
        setSwiped(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [swiped]);

  return (
    <div 
      ref={itemRef}
      className={cn(
        'relative overflow-hidden bg-[var(--white)]',
        isNew && 'animate-slideDown'
      )}
    >
      {/* Swipe actions */}
      <div className="absolute right-0 top-0 bottom-0 flex" role="group" aria-label="Expense actions">
        <button
          onClick={() => { onDuplicate(); setSwiped(false); setTranslateX(0); }}
          aria-label={`Duplicate expense: ${expense.description}`}
          className="w-[75px] flex flex-col items-center justify-center gap-1 bg-[var(--teal-green)] text-white text-[11px] font-medium active:opacity-85 min-h-[44px]"
        >
          <span className="text-[22px]" aria-hidden="true">📋</span>
          <span>Copy</span>
        </button>
        {canDelete && (
          <button
            onClick={() => { onDelete(); setSwiped(false); setTranslateX(0); }}
            aria-label={`Delete expense: ${expense.description}`}
            className="w-[75px] flex flex-col items-center justify-center gap-1 bg-[var(--danger)] text-white text-[11px] font-medium active:opacity-85 min-h-[44px]"
          >
            <span className="text-[22px]" aria-hidden="true">🗑️</span>
            <span>Delete</span>
          </button>
        )}
      </div>
      
      {/* Main content */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${expense.description}, ${formatAmount(expense.amount)}, ${formatDate(expense.date)}${payerName ? `, paid by ${payerName}` : ''}`}
        className={cn(
          'flex items-center gap-3 p-3 px-4 min-h-[72px] bg-[var(--white)]',
          'border-b border-[var(--border)]/50',
          'transition-transform duration-200 ease-out',
          'select-none touch-pan-y',
          'focus:outline-none focus:ring-2 focus:ring-[var(--teal-green)] focus:ring-inset'
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Icon / Thumbnail */}
        {thumbnailLoading ? (
          <div className="w-11 h-11 rounded-xl bg-[var(--bg)] flex items-center justify-center flex-shrink-0">
            <div className="w-5 h-5 border-2 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : thumbnailUrl ? (
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
            <img 
              src={thumbnailUrl} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-xl bg-[var(--bg)] flex items-center justify-center text-lg font-semibold text-[var(--text-secondary)] flex-shrink-0">
            {initial}
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[16px] truncate">
            {expense.description}
          </div>
          <div className="text-[14px] text-[var(--text-secondary)] truncate">
            {payerName && `${payerName} • `}
            {formatDate(expense.date)}
            {expense.recurring && ' • 🔄'}
            {expense.imageId && ' • 📎'}
          </div>
        </div>
        
        {/* Amount */}
        <div className="font-semibold text-[16px] flex-shrink-0">
          {formatAmount(expense.amount)}
        </div>
        
        {/* Sync indicator */}
        {isSharedMode && (
          <div className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            expense.syncStatus === 'synced' ? 'bg-[var(--teal-green)]' : 'bg-orange-400'
          )} />
        )}
      </div>
    </div>
  );
}
