import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/accountStore';

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/people', label: 'People', icon: PeopleIcon, sharedOnly: true },
  { path: '/stats', label: 'Stats', icon: StatsIcon },
  { path: '/settle', label: 'Settle', icon: SettleIcon, sharedOnly: true },
  { path: '/sync', label: 'Sync', icon: SyncIcon, sharedOnly: true },
  { path: '/settings', label: 'Settings', icon: SettingsIcon }
];

export function BottomNav() {
  const location = useLocation();
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  
  // Hide nav on add, camera, expense detail, and person detail pages
  if (location.pathname === '/add' || 
      location.pathname === '/camera' || 
      location.pathname.startsWith('/expense/') ||
      (location.pathname.startsWith('/people/') && location.pathname !== '/people')) return null;

  const visibleItems = navItems.filter(item => !item.sharedOnly || isSharedMode);

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-[var(--white)]/85 backdrop-blur-xl border-t-[0.5px] border-[var(--border)] z-[100] pb-safe"
      aria-label="Main navigation"
      role="navigation"
    >
      <div className="flex px-1 py-1.5">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            aria-label={item.label}
            className={({ isActive }) => cn(
              'flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 min-h-[50px]',
              'text-[10px] font-medium tracking-wide transition-colors duration-150',
              'active:scale-[0.92]',
              isActive ? 'text-[var(--teal-green)]' : 'text-[var(--text-secondary)]'
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('w-6 h-6 transition-transform', isActive && 'scale-110')} aria-hidden="true" />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

// Icon props type
interface IconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

// Icons
function HomeIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={ariaHidden}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PeopleIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={ariaHidden}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function StatsIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={ariaHidden}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function SettleIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={ariaHidden}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function SyncIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={ariaHidden}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function SettingsIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={ariaHidden}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
