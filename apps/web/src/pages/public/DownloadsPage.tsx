import { Monitor, Container, Code, FileText, Server } from 'lucide-react';
import DownloadCard from '@/components/public/DownloadCard';
import CodeBlock from '@/components/public/CodeBlock';

const dockerCompose = `version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
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

  web:
    build: ./apps/web
    ports:
      - "5173:80"
    depends_on:
      - server

volumes:
  pgdata:`;

const sysRequirements = [
  { component: 'CPU', minimum: '2 cores', recommended: '4+ cores' },
  { component: 'RAM', minimum: '4 GB', recommended: '8+ GB' },
  { component: 'Disk', minimum: '20 GB', recommended: '50+ GB (SSD)' },
  { component: 'OS', minimum: 'Windows 10 / Ubuntu 20.04', recommended: 'Ubuntu 22.04 LTS' },
  { component: 'Node.js', minimum: 'v18.0', recommended: 'v20 LTS' },
  { component: 'Docker', minimum: 'v20.0', recommended: 'v24+ with Compose v2' },
  { component: 'PostgreSQL', minimum: '14', recommended: '16 with TimescaleDB' },
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
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
            icon={Monitor}
            title="Windows Installer"
            description="Standalone Windows installer with built-in Node.js runtime and database."
            version="1.0.0"
            size="~180 MB"
          />
          <DownloadCard
            icon={Code}
            title="Source Code"
            description="Clone from GitHub and build from source. Full monorepo with all packages."
            version="1.0.0"
            available
            href="https://github.com/gridvision/gridvision-scada"
          />
          <DownloadCard
            icon={FileText}
            title="Documentation PDF"
            description="Complete offline documentation including installation guide, user manual, and API reference."
            version="1.0.0"
            size="~15 MB"
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

        {/* System Requirements */}
        <div>
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
      </div>
    </div>
  );
}
