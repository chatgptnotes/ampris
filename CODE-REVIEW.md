# GridVision SCADA - Code Review Report

**Date:** 2026-03-04
**Reviewer:** BK (AI Agent)
**Scope:** Full codebase review - apps/web, apps/server, apps/electron, packages/shared, prisma

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 12 |
| MEDIUM | 15 |
| LOW | 10 |
| **Total** | **44** |

---

## CRITICAL Findings

### [CRITICAL] SQL Injection via String Interpolation in Historian Service
**File:** apps/server/src/services/historian.service.ts:292
**Description:** The `getSOEEvents` method interpolates the `limit` parameter directly into SQL via template literal. While `limit` defaults to 500, it is passed from user input via `parseInt(limit as string)` in the controller. This pattern is dangerous - any future changes could introduce injection.
**Current code:** `` query += ` ORDER BY s.time DESC LIMIT ${limit}`; ``
**Suggested fix:** Use parameterized query: `` query += ` ORDER BY s.time DESC LIMIT $${params.length + 1}`; params.push(limit); ``

### [CRITICAL] Open Registration Endpoint on SCADA System
**File:** apps/server/src/routes/auth.routes.ts:10
**Description:** The `/api/auth/register` endpoint has NO authentication and NO rate limiting. Anyone can create accounts on a SCADA system. New users get VIEWER role which grants access to SLD views, dashboards, trends, and alarms.
**Current code:** `router.post('/register', authCtrl.register);`
**Suggested fix:** Either remove public registration entirely, require ADMIN authentication, or add an invite-code mechanism. At minimum, add rate limiting.

### [CRITICAL] Gemini AI Routes Have No Authentication
**File:** apps/server/src/routes/gemini.routes.ts:27-29
**Description:** All Gemini AI endpoints (content generation, infographic generation/deletion) have rate limiting but NO authentication. Anyone can consume the Gemini API quota.
**Current code:** `router.post('/generate-content', geminiLimiter, handleGenerateContent);`
**Suggested fix:** Add `authenticate` middleware to all Gemini routes.

### [CRITICAL] dangerouslySetInnerHTML with User-Provided SVG Code (XSS)
**File:** apps/web/src/pages/MimicEditor.tsx:2218, MimicViewer.tsx:825, CustomComponentCreator.tsx:228
**Description:** SVG code from user-created custom components is rendered via `dangerouslySetInnerHTML` without sanitization. Malicious SVG can contain `<script>` tags, `onload` handlers, or `<foreignObject>` with arbitrary HTML, enabling stored XSS. Since this is a multi-user SCADA system with project sharing, this is critical.
**Current code:** `<div dangerouslySetInnerHTML={{ __html: el.properties.svgCode }} />`
**Suggested fix:** Sanitize with DOMPurify: `<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(el.properties.svgCode) }} />`

### [CRITICAL] JWT Secret Has Insecure Default Fallback
**File:** apps/server/src/config/environment.ts:10
**Description:** JWT_SECRET falls back to `'dev-secret-change-in-production'` if env var is not set. If deployed without setting JWT_SECRET, all tokens are signed with a known secret, allowing token forgery.
**Current code:** `JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',`
**Suggested fix:** Throw error in production: `JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET required'); })() : 'dev-secret-only'),`

### [CRITICAL] ExternalDevice Model Stores Passwords in Plaintext
**File:** prisma/schema.prisma:292
**Description:** The `ExternalDevice` model has a `password` field stored as plain `VarChar(200)`. OPC UA and other device credentials are stored unencrypted in the database.
**Current code:** `password String? @db.VarChar(200)`
**Suggested fix:** Encrypt device passwords at rest using AES-256-GCM with a key from environment variables.

### [CRITICAL] updateUser Endpoint Has No Input Validation
**File:** apps/server/src/controllers/auth.controller.ts:145-157
**Description:** The PATCH /api/auth/users/:id endpoint accepts `name, email, role, isActive` without any Zod validation. The `role` field is not validated against the enum - arbitrary strings could be injected.
**Current code:** `const { name, email, role, isActive } = req.body;`
**Suggested fix:** Add Zod schema validation matching the `createUserSchema` pattern.

---

## HIGH Findings

### [HIGH] Electron Navigation Uses Hash Routing but App Uses BrowserRouter
**File:** apps/electron/src/main.ts:237
**Description:** The Electron app navigates via `window.location.hash` but the web app uses `createBrowserRouter` (history-based routing). Electron menu navigation (Dashboard, Alarms, SLD, etc.) will NOT work.
**Current code:** `` window.location.hash = '${routePath}' ``
**Suggested fix:** Use `window.location.pathname` or switch to `createHashRouter` for Electron builds.

### [HIGH] WebSocket Redis Subscriber Never Handles Errors
**File:** apps/server/src/websocket/handlers.ts:5-18
**Description:** The Redis subscriber has no error handler, no reconnection logic, and `subscribe()` is not awaited. If Redis disconnects, all real-time updates silently stop with no recovery.
**Current code:** `const subscriber = redis.duplicate(); subscriber.subscribe(...);`
**Suggested fix:** Add error handling, await subscribe, implement reconnection logic.

### [HIGH] Token Stored in localStorage (XSS Token Theft)
**File:** apps/web/src/stores/authStore.ts, apps/web/src/pages/MimicEditor.tsx:3680
**Description:** Auth tokens persisted in localStorage. Combined with the SVG XSS vulnerability, attackers could steal JWT tokens. MimicEditor also directly reads `localStorage.getItem('token')` bypassing the store.
**Suggested fix:** Use httpOnly cookies, or at minimum use the auth store consistently.

### [HIGH] Tag Engine Loads ALL Tags Into Memory Without Limit
**File:** apps/server/src/services/tag-engine.service.ts:23
**Description:** On initialization, `prisma.tag.findMany()` loads ALL tags with no limit. Large installations with thousands of tags could cause memory issues.
**Suggested fix:** Add batch loading with pagination.

### [HIGH] Unvalidated Date Parsing in Controllers
**File:** apps/server/src/controllers/trend.controller.ts:44-45
**Description:** Date strings from query parameters passed directly to `new Date()` without validation. Invalid dates produce `Invalid Date` objects causing undefined behavior.
**Suggested fix:** Validate with Zod or check `isNaN(date.getTime())`.

### [HIGH] Protocol Adapters Silently Fall Back to Simulation as 'CONNECTED'
**File:** apps/server/src/protocol/DNP3Adapter.ts:75-80, IEC61850Adapter.ts:60-65
**Description:** When real connections fail, DNP3 and IEC61850 adapters switch to simulation mode but report status as 'CONNECTED'. Operators would see simulated values thinking they're real - extremely dangerous for SCADA.
**Current code:** `this.status = 'CONNECTED'; // After connection failure`
**Suggested fix:** Use a distinct 'SIMULATED' status and display prominently in UI.

### [HIGH] No RBAC on Control Routes
**File:** apps/server/src/routes/control.routes.ts
**Description:** Control routes (SBO, Execute, Cancel) likely only check authentication, not role permissions. VIEWERs should not operate breakers.
**Suggested fix:** Add `requireRole('OPERATOR', 'ADMIN')` middleware.

### [HIGH] No Global Rate Limiting on Most API Routes
**File:** apps/server/src/app.ts
**Description:** Rate limiting only on `/api/auth/login` and Gemini routes. All other endpoints vulnerable to abuse.
**Suggested fix:** Add global rate limiter for authenticated users.

### [HIGH] Missing Error Boundary in App
**File:** apps/web/src/App.tsx
**Description:** No React Error Boundary. Any render error crashes the entire SCADA monitoring application with a white screen.
**Suggested fix:** Add ErrorBoundary with fallback UI.

### [HIGH] No Pagination on getUsers
**File:** apps/server/src/controllers/auth.controller.ts:72-78
**Description:** Returns ALL users with no pagination.
**Suggested fix:** Add `take` and `skip` parameters.

### [HIGH] Historian Ring Buffer Unbounded Memory
**File:** apps/server/src/services/historian.service.ts:55-70
**Description:** Ring buffer allows 3600 samples per tag with no global limit. Thousands of tags = unbounded memory growth.
**Suggested fix:** Add global sample count limit or LRU eviction.

### [HIGH] ProtectedRoute Only Checks Client-Side State
**File:** apps/web/src/routes/ProtectedRoute.tsx
**Description:** Only checks `isAuthenticated` from Zustand store. Expired tokens in localStorage bypass protection until an API call fails.
**Suggested fix:** Check token expiry client-side on route load.

---

## MEDIUM Findings

### [MEDIUM] Excessive Use of `any` Type (30+ instances)
**Files:** MimicEditor.tsx, TagTestPanel.tsx, ReportDesigner.tsx, InterlockManager.tsx, SBOManager.tsx, HistorianManager.tsx, CommDiagnostics.tsx
**Suggested fix:** Define proper interfaces for each data structure.

### [MEDIUM] Missing `key` Props on SVG Elements
**File:** apps/web/src/pages/ReportDesigner.tsx:119
**Suggested fix:** Add `key={si}` prop to mapped `<path>` elements.

### [MEDIUM] Unicode Characters Used Instead of Lucide Icons
**File:** MimicEditor.tsx:4014,4202,4255, DemoTrendsPage.tsx:110,166
**Description:** `✕` character used as close button instead of Lucide `<X />` icon.

### [MEDIUM] Console.log Instead of Winston Logger in Server
**Files:** All server services and protocol adapters
**Description:** Production server uses console.log directly instead of the Winston logger dependency.

### [MEDIUM] Missing Database Index on AlarmLog.raisedAt
**File:** prisma/schema.prisma (AlarmLog model)

### [MEDIUM] Missing Database Index on AuditTrail.timestamp
**File:** prisma/schema.prisma (AuditTrail model)

### [MEDIUM] SLD Generation Route Uses optionalAuth
**File:** apps/server/src/routes/sld-generation.routes.ts:17
**Description:** File upload + OpenAI API call with only optional authentication.

### [MEDIUM] lazyRetry Could Cause Infinite Reload Loop
**File:** apps/web/src/routes/index.tsx:28-31
**Suggested fix:** Track retry count in sessionStorage, bail after 2-3 attempts.

### [MEDIUM] CommandExecution Has No Foreign Key Relations
**File:** prisma/schema.prisma (CommandExecution model)
**Description:** `projectId` and `sequenceId` have no `@relation`, allowing orphaned records.

### [MEDIUM] Redis Subscriber Uses Unverified Pattern
**File:** apps/server/src/websocket/handlers.ts:15
**Description:** `subscribe()` not awaited, no error handling.

### [MEDIUM] No HTTPS Enforcement in Production
**File:** apps/server/src/app.ts
**Description:** No HSTS headers or HTTPS redirect for SCADA control traffic.

### [MEDIUM] No Prisma Connection Pool Configuration
**File:** apps/server/src/config/database.ts

### [MEDIUM] ControlService Pending Commands Not Shared Across Instances
**File:** apps/server/src/services/control.service.ts:8
**Description:** In-memory Map for SBO pending commands won't work in clustered deployments. Use Redis.

### [MEDIUM] No CSRF Protection
**File:** apps/server/src/app.ts
**Description:** No CSRF tokens, especially concerning for control endpoints.

### [MEDIUM] Zustand Stores May Cause Unnecessary Re-renders
**Files:** apps/web/src/stores/*.ts
**Description:** Ensure components use selective subscriptions.

---

## LOW Findings

### [LOW] TypeScript Strict Mode Partially Disabled
**File:** apps/web/tsconfig.json:13-14 - `noUnusedLocals` and `noUnusedParameters` are false.

### [LOW] recharts Duplicated in Root and Web Package.json
**File:** package.json:28, apps/web/package.json:16

### [LOW] @types/dotenv is Deprecated and Unnecessary
**File:** apps/server/package.json

### [LOW] JWT Access Token Default Expiry Too Long (24h)
**File:** apps/server/src/config/environment.ts:11 - Should be 15-30 minutes.

### [LOW] Inconsistent Unused Parameter Naming (_req vs req)
**File:** Various controller files.

### [LOW] Express Request Type Augmentation in Middleware File
**File:** apps/server/src/middleware/auth.middleware.ts:5-11 - Should be in dedicated .d.ts.

### [LOW] Vite envDir Points to Monorepo Root
**File:** apps/web/vite.config.ts:7 - Fragile, could leak env vars.

### [LOW] No robots.txt or security.txt
**File:** apps/web/public/ - Missing for public-facing pages.

### [LOW] Modbus Uses require() Instead of ES Import
**File:** apps/server/src/protocol/ModbusAdapter.ts:22 - Bypasses TypeScript checking.

### [LOW] Verify .env is in .gitignore
**File:** Project root

---

## Architecture Notes (Non-Issues)

1. **Protocol adapters are functional** - Modbus, DNP3, and IEC61850 all have real TCP connection code. Modbus is most production-ready.
2. **Prisma schema is well-structured** - Good snake_case mapping, cascade deletes, unique constraints.
3. **Frontend routing well-organized** - Good lazy loading with Suspense fallbacks.
4. **Authentication flow is solid** - Zod validation, bcrypt, JWT with refresh tokens.
5. **SBO pattern correctly implemented** - Two-step confirmation with timeout for safety-critical operations.
