import { useState, useRef, useEffect } from 'react';
import type { Expense } from '@/types';
import { getCategoryIcon, formatDate } from '@/types';
import { cn, haptic } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';

interface ExpenseItemProps {
  expense: Expense;
  onTap: () => void;
  onDoubleTap: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isNew?: boolean;
}

export function ExpenseItem({ 
  expense, 
  onTap, 
  onDoubleTap, 
  onLongPress,
  onDelete,
  onDuplicate,
  isNew 
}: ExpenseItemProps) {
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const getPersonName = usePeopleStore(s => s.getPersonName);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  
  const [swiped, setSwiped] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const lastTap = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const icon = getCategoryIcon(expense.description);
  const payerName = isSharedMode && expense.payerId ? getPersonName(expense.payerId) : '';

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
    
    // Only handle horizontal swipes
    if (isHorizontal.current && diffX < 0) {
      setTranslateX(Math.max(diffX * 0.8, -150));
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (isHorizontal.current && translateX < -60) {
      setTranslateX(-150);
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
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button
          onClick={() => { onDuplicate(); setSwiped(false); setTranslateX(0); }}
          className="w-[75px] flex flex-col items-center justify-center gap-1 bg-[var(--teal-green)] text-white text-[11px] font-medium active:opacity-85"
        >
          <span className="text-[22px]">📋</span>
          <span>Copy</span>
        </button>
        <button
          onClick={() => { onDelete(); setSwiped(false); setTranslateX(0); }}
          className="w-[75px] flex flex-col items-center justify-center gap-1 bg-[var(--danger)] text-white text-[11px] font-medium active:opacity-85"
        >
          <span className="text-[22px]">🗑️</span>
          <span>Delete</span>
        </button>
      </div>
      
      {/* Main content */}
      <div
        className={cn(
          'flex items-center gap-3 p-3 px-4 min-h-[72px] bg-[var(--white)]',
          'border-b border-[var(--border)]/50',
          'transition-transform duration-200 ease-out',
          'select-none touch-pan-y'
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {/* Icon */}
        <div className="w-11 h-11 rounded-xl bg-[var(--bg)] flex items-center justify-center text-xl flex-shrink-0">
          {icon}
        </div>
        
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
