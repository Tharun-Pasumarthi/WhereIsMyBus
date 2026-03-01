'use client';

import { Bus, LogOut, Bell, BellOff, BellRing, User, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePush } from '@/hooks/use-push';

interface NavProps {
  user: { name: string; role: string; email: string; avatar_url?: string | null };
  unreadAlerts?: number;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  driver: 'Driver',
  admin: 'Admin',
  transport_head: 'Transport Head',
  parent: 'Parent',
};

const ROLE_COLORS: Record<string, string> = {
  student: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30',
  driver: 'bg-[#0ea5e9]/15 text-[#0ea5e9] border-[#0ea5e9]/30',
  admin: 'bg-primary/15 text-primary border-primary/30',
  transport_head: 'bg-orange-400/15 text-orange-400 border-orange-400/30',
  parent: 'bg-purple-400/15 text-purple-400 border-purple-400/30',
};

export default function DashboardNav({ user, unreadAlerts = 0 }: NavProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { state: pushState, subscribe, unsubscribe } = usePush();

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-md bg-background/90">
      <div className="px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bus className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-base hidden sm:block" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Where Is My Bus
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Push notification toggle */}
          {pushState !== 'unsupported' && (
            <button
              onClick={pushState === 'subscribed' ? unsubscribe : subscribe}
              disabled={pushState === 'loading' || pushState === 'denied'}
              className="relative p-1.5 rounded-lg hover:bg-muted transition-colors"
              title={pushState === 'subscribed' ? 'Disable push notifications' : pushState === 'denied' ? 'Notifications blocked in browser' : 'Enable push notifications'}
              aria-label="Toggle push notifications"
            >
              {pushState === 'loading' && <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin block text-muted-foreground" />}
              {pushState === 'subscribed' && <BellRing className="w-4 h-4 text-primary" />}
              {pushState === 'unsubscribed' && <Bell className="w-4 h-4 text-muted-foreground" />}
              {pushState === 'denied' && <BellOff className="w-4 h-4 text-red-400" />}
              {unreadAlerts > 0 && pushState === 'subscribed' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                  {unreadAlerts > 9 ? '9+' : unreadAlerts}
                </span>
              )}
            </button>
          )}
          {unreadAlerts > 0 && pushState === 'unsupported' && (
            <div className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                {unreadAlerts > 9 ? '9+' : unreadAlerts}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-border/50">
            <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                : <User className="w-4 h-4 text-muted-foreground" />
              }
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-foreground leading-none">{user.name}</div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROLE_COLORS[user.role] || 'bg-muted text-muted-foreground border-border'}`}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>

            <button
              onClick={() => router.push('/profile')}
              className="ml-1 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Profile & Settings"
              aria-label="Profile & Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              {loggingOut
                ? <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin block" />
                : <LogOut className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
