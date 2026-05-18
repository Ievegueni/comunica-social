import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  Share2,
  ImageIcon,
  FileText,
  CalendarDays,
  Sparkles,
  CheckCircle,
  Inbox,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['OWNER', 'ADMIN', 'EDITOR', 'APPROVER', 'VIEWER'],
  },
  { name: 'Posts', href: '/posts', icon: FileText, roles: ['OWNER', 'ADMIN', 'EDITOR'] },
  {
    name: 'Calendario',
    href: '/calendar',
    icon: CalendarDays,
    roles: ['OWNER', 'ADMIN', 'EDITOR', 'APPROVER', 'VIEWER'],
  },
  { name: 'Gerar IA', href: '/ai', icon: Sparkles, roles: ['OWNER', 'ADMIN', 'EDITOR'] },
  {
    name: 'Aprovacoes',
    href: '/approvals',
    icon: CheckCircle,
    roles: ['OWNER', 'ADMIN', 'APPROVER'],
  },
  { name: 'Inbox', href: '/inbox', icon: Inbox, roles: ['OWNER', 'ADMIN', 'EDITOR'] },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'],
  },
  { name: 'Media', href: '/media', icon: ImageIcon, roles: ['OWNER', 'ADMIN', 'EDITOR'] },
  { name: 'Contas Sociais', href: '/social-accounts', icon: Share2, roles: ['OWNER', 'ADMIN'] },
  { name: 'Utilizadores', href: '/users', icon: Users, roles: ['OWNER', 'ADMIN'] },
];

export function Layout() {
  const { user, tenant, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    logout();
    navigate('/login');
  };

  const filteredNav = navigation.filter((item) => user && item.roles.includes(user.role));

  // Add admin link for super admins
  if (user?.isSuperAdmin) {
    filteredNav.push({ name: 'Backoffice', href: '/admin', icon: Shield, roles: [] });
  }

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-screen bg-muted/40">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card border-r transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b px-6">
          <span className="bg-brand-logo flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm">
            CS
          </span>
          <h1 className="text-base font-bold tracking-tight">
            COMUNICA <span className="text-brand">Social</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {filteredNav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-4">
          <div className="mb-3 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tenant?.name}
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-brand-logo flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Terminar sessao"
              className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
            className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent lg:hidden"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="bg-brand-logo flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white">
              CS
            </span>
            <span className="text-sm font-bold">
              COMUNICA <span className="text-brand">Social</span>
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
