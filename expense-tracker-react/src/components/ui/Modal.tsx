import { type ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showHandle?: boolean;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, showHandle = true, className }: ModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className={cn(
          'w-full max-h-[90vh] bg-[var(--white)] rounded-t-xl overflow-hidden animate-slideUp',
          'shadow-[0_-4px_20px_rgba(0,0,0,0.15)]',
          className
        )}
      >
        {showHandle && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-9 h-1 bg-black/15 dark:bg-white/20 rounded-full" />
          </div>
        )}
        
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] sticky top-0 bg-[var(--white)] z-10">
            <button 
              onClick={onClose}
              className="text-[var(--teal-green)] text-[17px] px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
            >
              Cancel
            </button>
            <span className="text-[17px] font-semibold">{title}</span>
            <div className="w-[60px]" />
          </div>
        )}
        
        <div className="overflow-y-auto overscroll-contain pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}

// Sheet variant for bottom sheets
export function Sheet({ isOpen, onClose, title, children, actions }: ModalProps & { actions?: ReactNode }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-h-[85vh] bg-[var(--white)] rounded-t-xl overflow-hidden animate-slideUp shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-9 h-1 bg-black/15 dark:bg-white/20 rounded-full" />
        </div>
        
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <button 
            onClick={onClose}
            className="text-[var(--teal-green)] text-[17px] px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
          >
            Cancel
          </button>
          <span className="text-[17px] font-semibold">{title}</span>
          {actions || <div className="w-[60px]" />}
        </div>
        
        <div className="overflow-y-auto overscroll-contain max-h-[calc(85vh-60px)] pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
