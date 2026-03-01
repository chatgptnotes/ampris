import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute from './ProtectedRoute';
import AppShell from '@/components/common/AppShell';
import PublicLayout from '@/components/public/PublicLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import SLDView from '@/pages/SLDView';
import Alarms from '@/pages/Alarms';
import Trends from '@/pages/Trends';
import Events from '@/pages/Events';
import Reports from '@/pages/Reports';
import Analytics from '@/pages/Analytics';
import AuditLog from '@/pages/AuditLog';
import Settings from '@/pages/Settings';
import ControlPanel from '@/pages/ControlPanel';
import SetupWizard from '@/pages/SetupWizard';
import ConnectionManager from '@/pages/ConnectionManager';
import ComponentLibrary from '@/pages/ComponentLibrary';
import SLDGenerator from '@/pages/SLDGenerator';
import ProjectHub from '@/pages/ProjectHub';
import ProjectMembers from '@/pages/ProjectMembers';

// Lazy-loaded heavy pages
// Auto-retry on chunk load failure (stale cache after deploy)
function lazyRetry(fn: () => Promise<any>) {
  return lazy(() => fn().catch(() => {
    window.location.reload();
    return fn();
  }));
}

const MimicEditor = lazyRetry(() => import('@/pages/MimicEditor'));
const MimicViewer = lazyRetry(() => import('@/pages/MimicViewer'));
const TagManager = lazyRetry(() => import('@/pages/TagManager'));
const TagTestPanel = lazyRetry(() => import('@/pages/TagTestPanel'));
const AILoadForecasting = lazyRetry(() => import('@/pages/AILoadForecasting'));
const AIEquipmentHealth = lazyRetry(() => import('@/pages/AIEquipmentHealth'));
const AIPredictiveMaintenance = lazyRetry(() => import('@/pages/AIPredictiveMaintenance'));
const AIPowerQuality = lazyRetry(() => import('@/pages/AIPowerQuality'));
const AIOperationsCenter = lazyRetry(() => import('@/pages/AIOperationsCenter'));

const LazyFallback = () => <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
import HomePage from '@/pages/public/HomePage';
import FeaturesPage from '@/pages/public/FeaturesPage';
import DemoPage from '@/pages/public/DemoPage';
import DownloadsPage from '@/pages/public/DownloadsPage';
import DocumentationPage from '@/pages/public/DocumentationPage';
import ContactPage from '@/pages/public/ContactPage';

export const router = createBrowserRouter([
  // Public pages with light theme
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/features', element: <FeaturesPage /> },
      { path: '/demo', element: <DemoPage /> },
      { path: '/downloads', element: <DownloadsPage /> },
      { path: '/docs', element: <DocumentationPage /> },
      { path: '/contact', element: <ContactPage /> },
    ],
  },
  // Standalone pages (dark theme, no public layout)
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/generate',
    element: <SLDGenerator />,
  },
  // Protected SCADA app pages (dark theme)
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'projects', element: <ProjectHub /> },
          { path: 'projects/:projectId', element: <Suspense fallback={<LazyFallback />}><MimicViewer /></Suspense> },
          { path: 'projects/:projectId/edit', element: <Suspense fallback={<LazyFallback />}><MimicEditor /></Suspense> },
          { path: 'projects/:projectId/edit/:pageId', element: <Suspense fallback={<LazyFallback />}><MimicEditor /></Suspense> },
          { path: 'projects/:projectId/members', element: <ProjectMembers /> },
          { path: 'sld', element: <SLDView /> },
          { path: 'sld/:substationId', element: <SLDView /> },
          { path: 'alarms', element: <Alarms /> },
          { path: 'trends', element: <Trends /> },
          { path: 'events', element: <Events /> },
          { path: 'reports', element: <Reports /> },
          { path: 'analytics', element: <Analytics /> },
          { path: 'control', element: <ControlPanel /> },
          { path: 'audit', element: <AuditLog /> },
          { path: 'settings', element: <Settings /> },
          { path: 'setup', element: <SetupWizard /> },
          { path: 'connections', element: <ConnectionManager /> },
          { path: 'components', element: <ComponentLibrary /> },
          { path: 'tags', element: <Suspense fallback={<LazyFallback />}><TagManager /></Suspense> },
          { path: 'tag-test', element: <Suspense fallback={<LazyFallback />}><TagTestPanel /></Suspense> },
          { path: 'ai/load-forecast', element: <Suspense fallback={<LazyFallback />}><AILoadForecasting /></Suspense> },
          { path: 'ai/equipment-health', element: <Suspense fallback={<LazyFallback />}><AIEquipmentHealth /></Suspense> },
          { path: 'ai/maintenance', element: <Suspense fallback={<LazyFallback />}><AIPredictiveMaintenance /></Suspense> },
          { path: 'ai/power-quality', element: <Suspense fallback={<LazyFallback />}><AIPowerQuality /></Suspense> },
          { path: 'ai/ops-center', element: <Suspense fallback={<LazyFallback />}><AIOperationsCenter /></Suspense> },
        ],
      },
    ],
  },
]);
