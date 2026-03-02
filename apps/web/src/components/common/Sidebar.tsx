import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Bell,
  TrendingUp,
  List,
  FileText,
  Settings,
  Activity,
  Shield,
  SlidersHorizontal,
  Cable,
  Wrench,
  BookOpen,
  FolderOpen,
  X,
  Tag,
  TestTube2,
  BrainCircuit,
  Zap,
  Server,
} from 'lucide-react';
import { useAlarmStore } from '@/stores/alarmStore';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  permission?: string;
}

const navItems: NavItem[] = [
  { path: '/app/projects', icon: FolderOpen, label: 'Projects' },
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/app/sld', icon: Network, label: 'SLD' },
  { path: '/app/alarms', icon: Bell, label: 'Alarms' },
  { path: '/app/trends', icon: TrendingUp, label: 'Trends' },
  { path: '/app/events', icon: List, label: 'Events' },
  { path: '/app/reports', icon: FileText, label: 'Reports' },
  { path: '/app/analytics', icon: Activity, label: 'Analytics' },
  { path: '/app/control', icon: SlidersHorizontal, label: 'Control', permission: 'control:operate' },
  { path: '/app/audit', icon: Shield, label: 'Audit', permission: 'view:audit' },
  { path: '/app/connections', icon: Cable, label: 'Connections' },
  { path: '/app/components', icon: BookOpen, label: 'Components' },
  { path: '/app/tags', icon: Tag, label: 'Tags' },
  { path: '/app/devices', icon: Server, label: 'Devices' },
  { path: '/app/tag-test', icon: TestTube2, label: 'Testing' },
  { path: '/app/ai/load-forecast', icon: TrendingUp, label: 'AI Forecast' },
  { path: '/app/ai/equipment-health', icon: Activity, label: 'AI Health' },
  { path: '/app/ai/maintenance', icon: Wrench, label: 'AI Maint.' },
  { path: '/app/ai/power-quality', icon: Zap, label: 'AI Power' },
  { path: '/app/ai/ops-center', icon: BrainCircuit, label: 'AI Ops' },
  { path: '/app/setup', icon: Wrench, label: 'Setup', permission: 'manage:settings' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const alarmTotal = useAlarmStore((s) => s.summary.total);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'bg-scada-panel border-r border-scada-border flex flex-col items-center py-3 gap-1 shrink-0 z-50 transition-transform duration-200',
          // Desktop: always visible, compact
          'hidden md:flex w-16',
          // Mobile: slide-in overlay
          mobileOpen && '!flex fixed top-0 left-0 h-full w-56 items-start px-2',
        )}
      >
        {/* Mobile close button */}
        {mobileOpen && (
          <div className="flex items-center justify-between w-full px-2 py-2 mb-2 md:hidden">
            <span className="text-sm font-semibold text-scada-accent">Navigation</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-scada-border/50 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/app'}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'relative flex items-center justify-center rounded-lg text-xs gap-0.5 transition-colors',
                // Desktop: icon-only, centered
                !mobileOpen && 'flex-col w-12 h-12',
                // Mobile: full width with labels
                mobileOpen && 'w-full px-3 py-2.5 gap-3 flex-row justify-start',
                isActive
                  ? 'bg-scada-accent/20 text-scada-accent'
                  : 'text-gray-400 hover:text-white hover:bg-scada-border/30',
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {mobileOpen ? (
              <span className="text-sm">{item.label}</span>
            ) : (
              <span className="text-[10px] leading-none">{item.label}</span>
            )}
            {item.path === '/app/alarms' && alarmTotal > 0 && (
              <span
                className={clsx(
                  'bg-scada-danger text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold',
                  mobileOpen ? 'ml-auto' : 'absolute -top-0.5 -right-0.5',
                )}
              >
                {alarmTotal > 9 ? '9+' : alarmTotal}
              </span>
            )}
          </NavLink>
        ))}
      </aside>
    </>
  );
}
