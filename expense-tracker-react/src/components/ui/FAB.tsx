import { useNavigate, useLocation } from 'react-router-dom';
import { cn, haptic } from '@/lib/utils';

export function FAB() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Only show on home page
  if (location.pathname !== '/') return null;

  const handleClick = () => {
    haptic('light');
    navigate('/add');
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Add new expense"
      className={cn(
        'fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-[99]',
        'w-14 h-14 rounded-2xl bg-[var(--teal-green)] text-white',
        'flex items-center justify-center',
        'shadow-[0_2px_8px_rgba(0,168,132,0.4)]',
        'transition-transform duration-150 active:scale-[0.88]',
        'animate-pop'
      )}
    >
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}
