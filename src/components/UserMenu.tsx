import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, ChevronDown } from 'lucide-react';

export function UserMenu() {
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getInitials = (email: string) =>
    email.substring(0, 2).toUpperCase();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  if (!currentUser) return null;

  const initials = getInitials(currentUser.email ?? 'U?');
  const username = currentUser.email?.split('@')[0] ?? 'User';

  return (
    <div className="relative" ref={ref}>
      <button
        id="user-menu-btn"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted transition-colors cursor-pointer"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-soft shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-foreground leading-none">{username}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">{currentUser.email}</p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-card border border-border shadow-elegant z-50 p-1.5 animate-fade-in-up">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-border/60 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{username}</p>
                <p className="text-[10px] text-muted-foreground truncate">{currentUser.email}</p>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-sm transition-colors cursor-pointer font-medium"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
