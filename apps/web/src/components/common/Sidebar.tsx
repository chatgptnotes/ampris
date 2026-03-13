import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  Upload,
  Workflow,
  FileBarChart,
  HardDriveDownload,
  Terminal,
  MousePointerClick,
  Radio,
  Database,
  ChevronDown,
  ChevronRight,
  Lock,
  Copy,
  KeyRound,
  Wifi,
  ClipboardList,
  Box,
} from 'lucide-react';
import { useAlarmStore } from '@/stores/alarmStore';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  permission?: string;
  requiresProject?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: '',
    defaultOpen: true,
    items: [
      { path: '/app/projects', icon: FolderOpen, label: 'Projects' },
      { path: '/app', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'MONITORING',
    defaultOpen: true,
    items: [
      { path: '/app/sld', icon: Network, label: 'SLD' },
      { path: '/app/alarms', icon: Bell, label: 'Alarms' },
      { path: '/app/trends', icon: TrendingUp, label: 'Trends' },
      { path: '/app/events', icon: List, label: 'Events' },
      { path: '/app/reports', icon: FileText, label: 'Reports' },
      { path: '/app/analytics', icon: Activity, label: 'Analytics' },
    ],
  },
  {
    title: 'ENGINEERING',
    defaultOpen: false,
    items: [
      { path: '/app/tags', icon: Tag, label: 'Tags' },
      { path: '/app/devices', icon: Server, label: 'Devices' },
      { path: '/app/relay-explorer', icon: Radio, label: 'Relay Explorer' },
      { path: '/app/site-survey', icon: ClipboardList, label: 'Site Survey' },
      { path: '/app/connections', icon: Cable, label: 'Connections' },
      { path: '/app/components', icon: BookOpen, label: 'Components' },
      { path: '/app/tag-test', icon: TestTube2, label: 'Testing' },
    ],
  },
  {
    title: 'PROJECT TOOLS',
    defaultOpen: false,
    items: [
      { path: '/app/projects/_/import', icon: Upload, label: 'Import', requiresProject: true },
      { path: '/app/projects/_/export', icon: HardDriveDownload, label: 'Export', requiresProject: true },
      { path: '/app/report-designer', icon: FileBarChart, label: 'Report Designer' },
      { path: '/app/projects/_/recipes', icon: Workflow, label: 'Recipes', requiresProject: true },
      { path: '/app/projects/_/commands', icon: Terminal, label: 'Commands', requiresProject: true },
      { path: '/app/projects/_/interlocks', icon: Lock, label: 'Interlocks', requiresProject: true },
      { path: '/app/projects/_/sbo', icon: MousePointerClick, label: 'SBO', requiresProject: true },
      { path: '/app/projects/_/authority', icon: KeyRound, label: 'Authority', requiresProject: true },
    ],
  },
  {
    title: 'DATA & COMMS',
    defaultOpen: false,
    items: [
      { path: '/app/projects/_/polling', icon: Radio, label: 'Polling', requiresProject: true },
      { path: '/app/projects/_/historian', icon: Database, label: 'Historian', requiresProject: true },
      { path: '/app/projects/_/redundancy', icon: Copy, label: 'Redundancy', requiresProject: true },
      { path: '/app/projects/_/diagnostics', icon: Wifi, label: 'Comm Diag', requiresProject: true },
    ],
  },
  {
    title: 'AI/ML',
    defaultOpen: false,
    items: [
      { path: '/app/ai/load-forecast', icon: TrendingUp, label: 'AI Forecast' },
      { path: '/app/ai/equipment-health', icon: Activity, label: 'AI Health' },
      { path: '/app/ai/maintenance', icon: Wrench, label: 'AI Maint.' },
      { path: '/app/ai/power-quality', icon: Zap, label: 'AI Power' },
      { path: '/app/ai/ops-center', icon: BrainCircuit, label: 'AI Ops' },
      { path: '/app/digital-twin', icon: Box, label: 'Digital Twin' },
    ],
  },
  {
    title: 'ADMIN',
    defaultOpen: false,
    items: [
      { path: '/app/control', icon: SlidersHorizontal, label: 'Control', permission: 'control:operate' },
      { path: '/app/audit', icon: ClipboardList, label: 'Audit', permission: 'view:audit' },
      { path: '/app/setup', icon: Wrench, label: 'Setup', permission: 'manage:settings' },
      { path: '/app/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const alarmTotal = useAlarmStore((s) => s.summary.total);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const navigate = useNavigate();

  const [lastProjectId, setLastProjectId] = useState(() =>
    localStorage.getItem('ampris-last-project') || ''
  );

  // Listen for storage changes (when project is opened elsewhere)
  useEffect(() => {
    const handler = () => setLastProjectId(localStorage.getItem('ampris-last-project') || '');
    window.addEventListener('storage', handler);
    // Also poll periodically for same-tab changes
    const interval = setInterval(handler, 1000);
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const set = new Set<string>();
    NAV_GROUPS.forEach((g) => { if (g.defaultOpen || !g.title) set.add(g.title); });
    return set;
  });

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const resolveItem = (item: NavItem): { path: string; disabled: boolean } => {
    if (!item.requiresProject) return { path: item.path, disabled: false };
    if (!lastProjectId) return { path: item.path, disabled: true };
    return { path: item.path.replace('/_/', `/${lastProjectId}/`), disabled: false };
  };

  const renderItem = (item: NavItem) => {
    if (item.permission && !hasPermission(item.permission)) return null;
    const { path, disabled } = resolveItem(item);

    if (disabled) {
      return (
        <div
          key={item.path}
          onClick={() => navigate('/app/projects')}
          title="Open a project first"
          className={clsx(
            'relative flex items-center justify-center rounded-lg text-xs gap-0.5 transition-colors opacity-40 cursor-pointer',
            !mobileOpen && 'flex-col w-12 h-12',
            mobileOpen && 'w-full px-3 py-2 gap-3 flex-row justify-start',
            'text-gray-500 hover:text-gray-400',
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {mobileOpen ? (
            <span className="text-sm">{item.label}</span>
          ) : (
            <span className="text-[10px] leading-none">{item.label}</span>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={path}
        end={path === '/app'}
        onClick={onClose}
        className={({ isActive }) =>
          clsx(
            'relative flex items-center justify-center rounded-lg text-xs gap-0.5 transition-colors',
            !mobileOpen && 'flex-col w-12 h-12',
            mobileOpen && 'w-full px-3 py-2 gap-3 flex-row justify-start',
            isActive
              ? 'bg-scada-accent/20 text-scada-accent'
              : 'text-gray-400 hover:text-white hover:bg-scada-border/30',
          )
        }
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {mobileOpen ? (
          <span className="text-sm">{item.label}</span>
        ) : (
          <span className="text-[10px] leading-none">{item.label}</span>
        )}
        {path === '/app/alarms' && alarmTotal > 0 && (
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
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'bg-scada-panel border-r border-scada-border flex flex-col py-2 gap-0 shrink-0 z-50 transition-transform duration-200 overflow-y-auto',
          'hidden md:flex w-16 items-center',
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

        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          );
          if (visibleItems.length === 0) return null;

          // No-title group (Projects, Dashboard) — always expanded, no header
          if (!group.title) {
            return (
              <div key="top" className="w-full">
                {visibleItems.map(renderItem)}
              </div>
            );
          }

          const isExpanded = expandedGroups.has(group.title);

          return (
            <div key={group.title} className="w-full">
              {/* Group header */}
              {mobileOpen ? (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex items-center gap-1 w-full px-3 py-1.5 mt-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {group.title}
                </button>
              ) : (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-12 flex items-center justify-center py-1 mt-1"
                  title={group.title}
                >
                  <div className="w-8 border-t border-gray-600" />
                </button>
              )}

              {/* Group items */}
              {isExpanded && visibleItems.map(renderItem)}
            </div>
          );
        })}
      </aside>
    </>
  );
}
