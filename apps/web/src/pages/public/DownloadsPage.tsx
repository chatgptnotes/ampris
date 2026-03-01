import { Monitor, Container, Code, FileText, Server, Terminal } from 'lucide-react';
import DownloadCard from '@/components/public/DownloadCard';
import CodeBlock from '@/components/public/CodeBlock';

const dockerCompose = `services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_DB: gridvision_scada
      POSTGRES_USER: gridvision
      POSTGRES_PASSWORD: gridvision_pass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  server:
    build: ./apps/server
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    env_file: .env
    environment:
      DATABASE_URL: postgresql://gridvision:gridvision_pass@postgres:5432/gridvision_scada
      REDIS_URL: redis://redis:6379
      JWT_SECRET: \${JWT_SECRET}
      PORT: "3001"

  web:
    build: ./apps/web
    ports:
      - "5173:80"
    depends_on:
      - server
    env_file: .env

volumes:
  pgdata:`;

const envTemplate = `# GridVision SCADA Environment Configuration
DATABASE_URL=postgresql://gridvision:gridvision_pass@postgres:5432/gridvision_scada
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key-change-in-production
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=production

# Optional: Gemini AI Integration
GEMINI_API_KEY=your-gemini-api-key

# Optional: Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password`;

const sysRequirements = [
  { component: 'CPU', minimum: '2 cores', recommended: '4+ cores' },
  { component: 'RAM', minimum: '4 GB', recommended: '8+ GB' },
  { component: 'Disk', minimum: '20 GB', recommended: '50+ GB (SSD)' },
  { component: 'OS', minimum: 'Windows 10 / Ubuntu 20.04', recommended: 'Ubuntu 22.04 LTS' },
  { component: 'Node.js', minimum: 'v18.0', recommended: 'v20 LTS' },
  { component: 'Docker', minimum: 'v20.0', recommended: 'v24+ with Compose v2' },
  { component: 'PostgreSQL', minimum: '14', recommended: '16 with TimescaleDB' },
];

const installSteps = [
  { cmd: 'git clone https://github.com/chatgptnotes/GridVision.git', label: 'Clone the repository' },
  { cmd: 'cp .env.example .env', label: 'Copy environment file' },
  { cmd: 'nano .env', label: 'Edit .env with your settings' },
  { cmd: 'docker compose up -d', label: 'Start with Docker' },
  { cmd: 'http://localhost:5173', label: 'Open browser' },
  { cmd: 'admin@gridvision.local / admin123', label: 'Default login' },
];

const releaseNotes = [
  'Initial release',
  'Real-time SCADA monitoring for 33/11kV substations',
  'Protocol support: Modbus TCP, IEC 61850, DNP3',
  'Advanced analytics & reporting',
  'Role-based access control (Operator/Supervisor/Admin/Viewer)',
  'Alarm management with priorities & escalation',
  'Audit logging',
  'Mobile responsive design',
  'Single Line Diagram with live overlays',
];

export default function DownloadsPage() {
  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Downloads</h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Get GridVision SCADA for your platform. Docker is the recommended
            deployment method for production environments.
          </p>
        </div>

        {/* Download cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <DownloadCard
            icon={Container}
            title="Docker (Recommended)"
            description="Complete stack with PostgreSQL, Redis, and TimescaleDB. One-command deployment."
            version="1.0.0"
            size="~500 MB"
            available
            href="#docker-compose"
          />
          <DownloadCard
            icon={Terminal}
            title="Linux Installer"
            description="Automated shell script for Ubuntu/Debian. Installs Node.js, PostgreSQL, Redis, and creates systemd service."
            version="1.0.0"
            size="~8 KB"
            available
            href="https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/linux/install.sh"
            downloadFile
            buttonLabel="Download install.sh"
          />
          <DownloadCard
            icon={Monitor}
            title="Windows Installer"
            description="PowerShell installer script. Installs prerequisites, clones repo, builds app, creates shortcuts and auto-start."
            version="1.0.0"
            size="~10 KB"
            available
            href="https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/windows/windows-setup.ps1"
            downloadFile
            buttonLabel="Download .ps1"
          />
          <DownloadCard
            icon={Code}
            title="Source Code"
            description="Clone from GitHub and build from source. Full monorepo with all packages."
            version="1.0.0"
            available
            href="https://github.com/chatgptnotes/GridVision"
          />
          <DownloadCard
            icon={Monitor}
            title="Desktop App (Electron)"
            description="Cross-platform desktop application with system tray, native notifications, offline detection, and auto-updater."
            version="1.0.0"
            size="~200 MB"
            available
            href="https://github.com/chatgptnotes/GridVision/tree/main/apps/electron"
            buttonLabel="Build Instructions"
          />
          <DownloadCard
            icon={FileText}
            title="Documentation"
            description="Complete documentation: user manual, installation guide, API reference, and protocol integration guide."
            version="1.0.0"
            available
            href="https://github.com/chatgptnotes/GridVision/tree/main/docs"
            buttonLabel="View Docs"
          />
        </div>

        {/* Docker Compose */}
        <div id="docker-compose" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start with Docker</h2>
          <p className="text-gray-600 mb-6">
            Copy this <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">docker-compose.yml</code> to get started in minutes:
          </p>
          <CodeBlock code={dockerCompose} language="yaml" title="docker-compose.yml" />
        </div>

        {/* Environment Variables */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Environment Variables</h2>
          <p className="text-gray-600 mb-6">
            Create a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file in the project root with the following configuration:
          </p>
          <CodeBlock code={envTemplate} language="bash" title=".env" />
        </div>

        {/* Installation Steps */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Installation Steps</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {installSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-4 px-6 py-4">
                <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 mb-1">{step.label}</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 break-all">{step.cmd}</code>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Requirements */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">System Requirements</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-semibold text-gray-900">Component</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-900">Minimum</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-900">
                    <div className="flex items-center gap-1">
                      <Server className="w-4 h-4" />
                      Recommended
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sysRequirements.map((req) => (
                  <tr key={req.component} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{req.component}</td>
                    <td className="px-6 py-3 text-gray-600">{req.minimum}</td>
                    <td className="px-6 py-3 text-gray-600">{req.recommended}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Release Notes */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Release Notes</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full">v1.0.0</span>
              <span className="text-sm text-gray-500">March 2026</span>
            </div>
            <ul className="space-y-2">
              {releaseNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-1.5 shrink-0">&#8226;</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
