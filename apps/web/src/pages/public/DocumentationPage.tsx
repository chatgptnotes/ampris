import { useState } from 'react';
import CodeBlock from '@/components/public/CodeBlock';
import DocSidebar from '@/components/public/DocSidebar';

const sections = [
  { id: 'prerequisites', label: 'Prerequisites' },
  { id: 'docker-setup', label: 'Docker Setup' },
  { id: 'manual-setup', label: 'Manual Setup' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'first-run', label: 'First Run' },
  { id: 'architecture', label: 'Architecture' },
];

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState('prerequisites');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Documentation</h1>
          <p className="text-gray-600 text-lg mb-6">
            Complete installation and setup guide for GridVision SCADA.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/docs/GridVision-Quick-Start-Guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              📘 Quick Start Guide (28 Chapters)
            </a>
            <a
              href="/docs/GridVision-User-Guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
            >
              📖 User Guide
            </a>
          </div>
        </div>

        <div className="flex gap-10">
          <DocSidebar
            sections={sections}
            activeSection={activeSection}
            onSectionClick={scrollToSection}
          />

          <div className="flex-1 max-w-3xl space-y-16">
            {/* Prerequisites */}
            <section id="prerequisites">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Prerequisites</h2>
              <p className="text-gray-600 mb-4">
                Before installing GridVision, ensure you have the following software installed:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <span><strong>Node.js</strong> v18 or later (v20 LTS recommended)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <span><strong>pnpm</strong> v8+ package manager</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <span><strong>PostgreSQL</strong> 14+ (or Docker for containerized setup)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <span><strong>Redis</strong> 7+ for real-time pub/sub</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <span><strong>Docker & Docker Compose</strong> (optional, for containerized deployment)</span>
                </li>
              </ul>
              <CodeBlock
                code="node --version  # v18.0.0+\npnpm --version  # v8.0.0+\ndocker --version  # v20.0+ (optional)"
                language="bash"
                title="Check versions"
              />
            </section>

            {/* Docker Setup */}
            <section id="docker-setup">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Docker Setup (Recommended)</h2>
              <p className="text-gray-600 mb-4">
                The fastest way to get GridVision running. This spins up PostgreSQL, Redis,
                the API server, and the web frontend in containers.
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">1. Clone the repository</h3>
                  <CodeBlock
                    code="git clone https://github.com/chatgptnotes/GridVision.git\ncd GridVision"
                    language="bash"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">2. Configure environment</h3>
                  <CodeBlock
                    code="cp .env.example .env\n# Edit .env with your settings (JWT secret, API keys, etc.)"
                    language="bash"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">3. Start all services</h3>
                  <CodeBlock
                    code="docker compose up -d\n\n# Check status\ndocker compose ps\n\n# View logs\ndocker compose logs -f server"
                    language="bash"
                  />
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                  <strong>Note:</strong> The web UI will be available at{' '}
                  <code className="bg-blue-100 px-1 rounded">http://localhost:5173</code> and the API
                  at <code className="bg-blue-100 px-1 rounded">http://localhost:3001</code>.
                </div>
              </div>
            </section>

            {/* Manual Setup */}
            <section id="manual-setup">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Manual Setup</h2>
              <p className="text-gray-600 mb-4">
                For development or when you need more control over individual services.
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">1. Install dependencies</h3>
                  <CodeBlock
                    code="pnpm install"
                    language="bash"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">2. Setup database</h3>
                  <CodeBlock
                    code={`# Create PostgreSQL database
createdb gridvision_scada

# Run migrations
pnpm --filter @gridvision/server exec prisma migrate dev

# Seed initial data (admin user, sample substation)
pnpm --filter @gridvision/server exec prisma db seed`}
                    language="bash"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">3. Start development servers</h3>
                  <CodeBlock
                    code={`# Start all services in dev mode (with hot reload)
pnpm dev

# Or start individually:
pnpm --filter @gridvision/server dev   # API server on :3001
pnpm --filter @gridvision/web dev      # Web app on :5173`}
                    language="bash"
                  />
                </div>
              </div>
            </section>

            {/* Configuration */}
            <section id="configuration">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Configuration</h2>
              <p className="text-gray-600 mb-4">
                GridVision is configured via environment variables in the root <code className="bg-gray-100 px-1 rounded">.env</code> file.
              </p>
              <CodeBlock
                code={`# Database
DATABASE_URL=postgresql://gridvision:gridvision_pass@localhost:5432/gridvision_scada

# Redis
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Server
SERVER_PORT=3001
CORS_ORIGIN=http://localhost:5173

# Frontend
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=5

# Optional: Gemini AI API
GEMINI_API_KEY=your-gemini-api-key`}
                language="env"
                title=".env"
              />
              <div className="mt-4 bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
                <strong>Security:</strong> Always change the <code className="bg-amber-100 px-1 rounded">JWT_SECRET</code> in
                production. Never commit API keys to version control.
              </div>
            </section>

            {/* First Run */}
            <section id="first-run">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">First Run</h2>
              <p className="text-gray-600 mb-4">
                After starting all services, follow these steps:
              </p>
              <ol className="space-y-3 text-gray-600">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center shrink-0">1</span>
                  <span>Open <code className="bg-gray-100 px-1 rounded">http://localhost:5173</code> in your browser</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center shrink-0">2</span>
                  <span>Navigate to the Login page via the navbar</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center shrink-0">3</span>
                  <span>Login with default credentials: <code className="bg-gray-100 px-1 rounded">admin / admin123</code></span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center shrink-0">4</span>
                  <span>You'll see the SCADA dashboard with live data (or simulated data if using the simulator adapter)</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center shrink-0">5</span>
                  <span>Navigate to the SLD page to see the substation single-line diagram</span>
                </li>
              </ol>
            </section>

            {/* Architecture */}
            <section id="architecture">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Architecture</h2>
              <p className="text-gray-600 mb-4">
                GridVision uses a modern monorepo architecture with three main packages:
              </p>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900">apps/web</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    React + TypeScript + Vite frontend. Tailwind CSS for styling. Zustand for state management.
                    Socket.IO client for real-time data. SVG-based SLD renderer.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900">apps/server</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Express + TypeScript API server. Socket.IO for WebSocket communication.
                    Prisma ORM for PostgreSQL. Protocol adapters for field devices.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900">packages/shared</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Shared TypeScript types, constants (voltage colors, CB state colors),
                    and utility functions used by both web and server packages.
                  </p>
                </div>
              </div>
              <CodeBlock
                code={`gridvision-scada/
├── apps/
│   ├── web/          # React frontend (Vite)
│   ├── server/       # Express API + WebSocket
│   └── electron/     # Desktop wrapper
├── packages/
│   └── shared/       # Shared types & constants
├── prisma/           # Database schema & migrations
├── simulator/        # Protocol simulator
└── docker-compose.yml`}
                language="text"
                title="Project Structure"
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
