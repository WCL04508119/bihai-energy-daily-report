import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  FileText,
  Calendar,
  BarChart3,
  PieChart,
  Menu,
  Archive,
  ClipboardList,
  LayoutDashboard,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserDisplay } from '@/components/business-ui/user-display';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';
import { useDataScope } from '@/hooks/use-data-scope';
import type { DataScopeFeatures } from '@shared/api.interface';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { OPEN_AI_EMPLOYEE_EVENT } from '@/lib/ai-draft';
import { AiAssistant } from '@/components/brand/AiAssistant';
import { AiEmployeeDrawer } from '@/components/ai-employee/AiEmployeeDrawer';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: typeof FileText;
  permission?: (features: DataScopeFeatures) => boolean;
}

const navItems: NavItem[] = [
  { path: '/daily-report', label: '日报管理', icon: FileText },
  { path: '/weekly-report', label: '周报管理', icon: Calendar },
  { path: '/monthly-report', label: '月报管理', icon: BarChart3 },
  {
    path: '/manager-dashboard',
    label: '管理者看板',
    icon: LayoutDashboard,
    permission: (features: DataScopeFeatures) =>
      features.canViewManagerDashboard,
  },
  {
    path: '/stats',
    label: '统计看板',
    icon: PieChart,
    permission: (features: DataScopeFeatures) => features.canViewStats,
  },
  { path: '/report-archive', label: '报告归档', icon: Archive },
  { path: '/task-pool', label: '任务池管理', icon: ClipboardList },
];

const NavLinks = ({
  onNavigate,
  items = navItems,
}: {
  onNavigate?: () => void;
  items?: NavItem[];
}) => (
  <nav className="flex flex-col gap-1">
    <p className="px-3 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
      工作台
    </p>
    {items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
              isActive
                ? 'bg-primary/[0.07] font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(178_34_34_0.10)]'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-primary group-hover:shadow-sm',
                )}
              >
                <Icon className="size-4" />
              </span>
              {item.label}
            </>
          )}
        </NavLink>
      );
    })}
  </nav>
);

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const user = useCurrentUserProfile();
  const { data: scope, isLoading: scopeLoading } = useDataScope();
  const features: DataScopeFeatures | undefined = scope?.features;

  const visibleNavItems: NavItem[] = navItems.filter((item: NavItem) => {
    if (!item.permission) return true;
    if (scopeLoading || !features) return false;
    return item.permission(features);
  });

  useEffect(() => {
    const openFromEvent = (): void => setAiOpen(true);
    window.addEventListener(OPEN_AI_EMPLOYEE_EVENT, openFromEvent);
    return () => {
      window.removeEventListener(OPEN_AI_EMPLOYEE_EVENT, openFromEvent);
    };
  }, []);

  const openAiEmployee = () => {
    setAiOpen(true);
  };

  const openAiEmployeeFromMobile = () => {
    setMobileOpen(false);
    window.setTimeout(() => setAiOpen(true), 220);
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="z-30 flex h-20 shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-md lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="打开菜单"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
              <div className="flex h-20 items-center border-b border-slate-100 px-4">
                <BrandLogo height={48} />
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <NavLinks
                  items={visibleNavItems}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
              <div className="border-t border-slate-100 p-3">
                <AiAssistant onOpen={openAiEmployeeFromMobile} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo height={60} className="shrink-0" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 py-1 pl-1 pr-3 sm:flex">
            {user?.user_id ? (
              <UserDisplay userId={user.user_id} size="small" />
            ) : (
              <span className="mx-1 flex items-center gap-2" aria-hidden>
                <span className="size-6 animate-pulse rounded-full bg-slate-200" />
                <span className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
              </span>
            )}
          </div>
          <div className="sm:hidden">
            {user?.user_id ? (
              <UserDisplay userId={user.user_id} size="small" />
            ) : (
              <span
                className="block size-7 animate-pulse rounded-full bg-slate-200"
                aria-hidden
              />
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white md:flex">
          <div className="flex-1 overflow-y-auto p-3">
            <NavLinks items={visibleNavItems} />
          </div>
          <div className="border-t border-slate-100 p-3">
            <AiAssistant onOpen={openAiEmployee} />
          </div>
        </aside>

        <main className="relative flex-1 overflow-auto">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary/[0.05] via-primary/[0.02] to-transparent" />
          <div className="relative mx-auto max-w-[1240px] p-5 lg:p-7">
            <Outlet />
          </div>
        </main>
      </div>

      <AiEmployeeDrawer open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
};

export default Layout;
