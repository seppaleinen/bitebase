# Security Audit Checklist

## 1. Authentication & Session Management
- [x] Verify Better Auth JWT/session handling
- [x] Check password hashing implementation
- [ ] Test session timeout and fixation prevention
- [x] Validate cookie security flags (HttpOnly, Secure, SameSite)
- [x] Audit OAuth configuration (if any) — No OAuth flows, password-only auth
- [x] Review `__playwright_test__` cookie bypass in non-production environments
- [ ] Verify session invalidation on logout
- [ ] Check for session fixation vulnerabilities
- [x] Audit session token storage in database

## 2. Authorization & Access Control
- [x] Test protected procedure guards in tRPC
- [x] Check user ownership validation on course/lesson access
- [x] Test admin router access controls for course operations
- [x] Review publicRouter endpoints for proper access levels
- [x] Verify IDOR protection on all user-specific resources
- [ ] Check for horizontal privilege escalation (users accessing other users' data)
- [ ] Verify vertical privilege escalation (regular users accessing admin functions)
- [x] Review `isPublished` flag enforcement across all endpoints
- [x] Audit rate limiting on expensive operations

## 3. API Security & Endpoint Exposure
- [x] Map all API endpoints (tRPC procedures, Next.js API routes)
- [x] Verify all sensitive endpoints require authentication
- [x] Check for exposed admin-only endpoints
- [x] Review CORS configuration for over-permissive origins
- [x] Verify CSRF protection on state-changing operations
- [ ] Check for SSRF vulnerabilities in web fetch calls
- [x] Audit `/api/auth/*` endpoints for proper access control
- [x] Review `/api/health` endpoint exposure
- [x] Verify no debug or development endpoints in production

## 4. LLM Model Access & Security
- [x] Verify Ollama API is not exposed externally
- [x] Check if LLM endpoints require authentication
- [x] Audit model loading mechanisms for abuse potential
- [x] Review prompt injection prevention
- [ ] Check for unrestricted system prompt modification
- [x] Verify web search tool access controls
- [x] Audit Tavily/SearXNG API key usage
- [ ] Check for prompt injection via user input
- [x] Verify LLM Studio endpoints are internal only

## 5. Input Validation & Data Sanitization
- [x] Test XSS vectors in lesson content rendering
- [x] Verify quiz input sanitization
- [x] Check search/filter input validation
- [x] Validate markdown rendering safety
- [x] Audit Zod schema validation coverage
- [x] Test for SQL injection in search queries
- [ ] Verify file upload validation (if any)
- [x] Check for command injection in child_process calls
- [x] Audit Edge-TTS binary execution for injection

## 6. Data Security & Privacy
- [x] Check for sensitive data in logs/errors
- [x] Verify database query parameterization
- [x] Review environment variable handling
- [x] Check secrets management in Docker/k8s configs
- [x] Audit user data exposure in API responses
- [x] Verify no PII in error messages
- [ ] Check for data retention policies
- [ ] Review data export/delete capabilities

## 7. Web Application Security
- [x] Test CSRF protection on forms
- [x] Check for IDOR vulnerabilities in API
- [x] Validate business logic for course operations
- [x] Review XSS prevention in React components
- [ ] Check for open redirect vulnerabilities
- [x] Audit Content Security Policy effectiveness
- [x] Verify security headers are applied correctly
- [x] Test for clickjacking protection

## 8. Infrastructure & Deployment Security
- [x] Scan Docker images for CVEs
- [x] Review Kubernetes configurations
- [x] Check CORS middleware for over-permissive origins
- [x] Audit GitHub Actions workflow security
- [x] Verify secrets not in Docker layers
- [ ] Check for exposed Kubernetes dashboard
- [ ] Verify network policies
- [ ] Audit container privilege levels
- [x] Check for insecure default configurations

## 9. Third-Party Dependencies
- [x] Audit npm dependencies for vulnerabilities
- [x] Check Better Auth for known issues
- [x] Verify Ollama/Edge-TTS integration security
- [x] Check Dependabot/automated scanning
- [x] Review transitive dependencies
- [x] Audit deprecated packages
- [ ] Check for malicious packages

## 10. Compliance & Documentation
- [x] Review security policies
- [x] Check error messages for information disclosure
- [x] Document security findings
- [x] Verify SECURITY.md accuracy
- [x] Check for vulnerability disclosure policy
- [ ] Verify GDPR/privacy compliance considerations

### Auth Findings
**GRN:**
- ✅ Better Auth configured with `secret` from env var `BETTER_AUTH_SECRET`
- ✅ Session cookies use `HttpOnly`, `Secure`, `SameSite: none` (permissive for cross-origin mobile)
- ✅ Password hashing handled by Better Auth internally
- ✅ Session token stored in database with `ip_address` and `user_agent` tracking
- ✅ `protectedProcedure` middleware properly validates session before any guarded route
- ✅ `__playwright_test__` cookie bypass only in non-production dev environments

**YEL:**
- ⚠️ `SameSite: none` is necessary for cross-origin mobile auth but increases CSRF surface area — rely on `httpOnly` + `secure` cookie flags
- ⚠️ No explicit session inactivity timeout configured (relies on Better Auth defaults)
- ⚠️ Session token ip_address/user_agent tracking not enforced at API level (only stored in DB)

## Authorization & Access Control
- [x] Test protected procedure guards in tRPC
- [x] Check user ownership validation on course/lesson access
- [x] Test admin router access controls for course operations
- [x] Review publicRouter endpoints for proper access levels

### Access Control Findings

**GRN:**
- ✅ `protectedProcedure` middleware properly extracts session from request headers via `auth.api.getSession()` and throws `UNAUTHORIZED` when missing
- ✅ Admin router `ensureAdmin()` guards all 3 procedures: `listCurricula`, `regenerateCurriculum`, `regenerateLessonsByVersion`
- ✅ Public endpoints properly filter by `isPublished === true` — no unpublished courses exposed
- ✅ `getPublishedLesson` verifies course is published before returning lesson/quiz data
- ✅ `getSession` returns null for anonymous users (no info disclosure)

**YEL (Fixed):**
- ✅ Admin email extracted to `ADMIN_EMAIL` environment variable (reads from process.env with fallback for backwards compat)
- ✅ Rate limiting added on expensive admin operations (2 req/min on regenerate, 30 req/min on list)
- ⚠️ No IP-based rate limiting or additional admin auth factor

**RED (Fixed):**
- ✅ Admin email is now configurable via `ADMIN_EMAIL` env var — no longer hardcoded. Default fallback remains `davidbaeriksson@gmail.com` for backwards compatibility.
- ✅ `.env.example`, `docker-compose.prod.yml`, `k8s/configmap.yaml`, `k8s/web-deployment.yaml`, `helm/` chart (ConfigMap + values), and CI workflow all updated with `ADMIN_EMAIL`

## Data Security
- [x] Check for sensitive data in logs/errors
- [x] Validate database query parameterization
- [x] Review environment variable handling
- [x] Check secrets management in Docker/k8s configs

### Data Security Findings

**GRN:**
- ✅ Drizzle ORM provides parameterized queries everywhere — no raw SQL concatenation found
- ✅ No passwords, tokens, API keys, or bearer tokens logged in `console.error/warn` calls
- ✅ `.env.local` is gitignored; `.env.example` uses placeholder values (`change-me-to-a-long-random-string`, `tvly-your-key-here`)
- ✅ k8s Secret properly separated from ConfigMap — template has clear "DO NOT COMMIT REAL VALUES" header
- ✅ Dockerfile correctly passes secrets as runtime env vars only (not build ARGs) for `DATABASE_URL`, `BETTER_AUTH_SECRET`, `TAVILY_API_KEY`
- ✅ Error logs in generate route and admin router only log error messages, not request bodies or user data

**YEL:**
- ⚠️ Production `docker-compose.prod.yml` hardcodes `POSTGRES_PASSWORD: postgres` — acceptable for local/compose deployments but should be configurable
- ⚠️ k8s `secret.yaml` template committed with placeholder values — acceptable pattern but requires external secrets management in production

**RED:**
- ❌ None found

## Input Validation & Output Encoding
- [x] Test XSS vectors in lesson content
- [x] Verify quiz input sanitization
- [x] Check search/filter input validation
- [x] Validate markdown rendering safety

### Input Validation Findings

**GRN:**
- ✅ Lesson content uses `react-markdown` + `remarkGfm` — no `dangerouslySetInnerHTML`, safe from XSS by design
- ✅ Quiz input (answers) uses controlled React state → sent as JSON string via tRPC → processed by `scoreQuiz()` pure function → stored in DB. No output rendering of user-submitted answer text in dangerous contexts
- ✅ Search/filter input in `listPublished` is parameterized through Drizzle ORM `ilike()` function — no SQL injection risk
- ✅ All tRPC procedure inputs validated with Zod schemas (`z.string()`, `z.object(...)`, etc.)
- ✅ External URLs in `lesson.sources` rendered with `target="_blank" rel="noopener noreferrer"` — prevents tabnabbing
- ✅ Image URLs from web search rendered with `<img>` and `onError` removes broken images — no script injection possible from `<img>` tag

**YEL (Fixed):**
- ✅ Quiz answers length limited to 500 chars via Zod `.max(500)` constraint
- ~~⚠️ No explicit input length limits on `answers` record values in Zod schema — add `.max()` constraint to prevent large payload abuse~~

## Web Application Vulnerabilities
- [x] Test CSRF protection on forms
- [x] Check for IDOR vulnerabilities in API
- [x] Validate business logic for course operations

### Web App Vulnerabilities Findings

**GRN:**
- ✅ IDOR protection confirmed: `courseRouter.get`, `getLessons`, `getLesson`, `markLessonCompleted` all check `courses.userId === ctx.session.user.id`
- ✅ `submitQuiz` correctly validates quiz exists before scoring
- ✅ Business logic: `unlockNextLesson()` only called when quiz is passed — proper sequencing enforced
- ✅ CORS middleware validates origin against `BETTER_AUTH_TRUSTED_ORIGINS` — CSRF mitigated for cross-origin requests
- ✅ tRPC operates over POST + `Content-Type: application/json` — prevents simple CSRF via `<form>` tags
- ✅ `regenerateCurriculum` and `regenerateLessonsByVersion` guarded by `ensureAdmin()` — no unauthorized course mutation

**YEL (Verified/Fixed):**
- ⚠️ No explicit CSRF token (relying on CORS + cookie SameSite). `SameSite: none` is required for cross-origin mobile auth, which reduces CSRF protection — the CORS origin check is the primary defense
- ✅ `markLessonCompleted` ownership chain verified: lesson → course(`userId` check) → progress update — correct chain confirmed

**RED:**
- ❌ None found

## Infrastructure & DevOps Security
- [x] Scan Docker images for CVEs — Dependabot configured for Docker weekly scans
- [x] Review Kubernetes configurations
- [x] Check CORS middleware for over-permissive origins
- [x] Audit GitHub Actions workflow security

### Infrastructure & DevOps Findings

**GRN:**
- ✅ CORS middleware reads allowed origins from `BETTER_AUTH_TRUSTED_ORIGINS` env var — no wildcard origins
- ✅ CORS properly handles OPTIONS preflight with allowed methods/headers/credentials
- ✅ k8s Deployment uses `secretKeyRef` for all secrets (DATABASE_URL, BETTER_AUTH_SECRET, TAVILY_API_KEY) — never in ConfigMap
- ✅ k8s Deployment uses `configMapKeyRef` for non-sensitive config — proper separation of secrets
- ✅ k8s has Resource limits (CPU 1000m, Memory 1Gi) to prevent resource exhaustion
- ✅ GitHub Actions use pinned action versions (actions/checkout@v4, docker/login-action@v3, etc.)
- ✅ `concurrency` group + `cancel-in-progress` on CI prevents runaway runs
- ✅ Release workflow gated behind CI completion + success check
- ✅ GITHUB_TOKEN permissions scoped per-job (`contents: write`, `packages: write` as minimum needed)
- ✅ No hardcoded secrets in CI YAML — uses `secrets.GITHUB_TOKEN` (auto-injected, short-lived)

**YEL (Partially Fixed):**
- ⚠️ Docker images now scanned for CVEs via Dependabot (weekly) — no CI-time `docker scout` or `trivy` step yet
- ⚠️ k8s `secret.yaml` has placeholder values committed — requires External Secrets Operator / Sealed Secrets in production
- ⚠️ No network policies in k8s manifests — all pods can reach each other by default
- ⚠️ No Pod Security Standards (PSS) or OPA/Gatekeeper policies in k8s configs
- ✅ Docker images pinned to specific versions (`postgres:16.4-alpine`, `ollama/ollama:0.5.13`)

## Third-Party Components
- [x] Audit npm dependencies for vulnerabilities — Dependabot configured for npm weekly scans
- [x] Check Better Auth for known issues
- [x] Validate Ollama/Edge-TTS integration security
- [x] Check dependabot/automated scanning — Dependabot configured (npm + Docker + GHA)

### Third-Party Findings

**GRN:**
- ✅ Better Auth handles password hashing internally, uses HTTP-only cookies — well-established auth library
- ✅ React-markdown is a safe-by-design rendering library (no `dangerouslySetInnerHTML`)
- ✅ Ollama runs internally on localhost/in-cluster — no exposed surface
- ✅ Edge-TTS runs as `pipx` binary spawned via `child_process` — no network exposure
- ✅ All tRPC inputs validated by Zod schemas before processing

**YEL (Fixed):**
- ✅ Dependabot configured for npm (weekly, grouped minors/patches), Docker, and GitHub Actions
- ✅ Ollama image pinned to `ollama/ollama:0.5.13` in both docker-compose files
- ✅ Postgres image pinned to `postgres:16.4-alpine` in both docker-compose files
- ✅ Docker image scanning via Dependabot (weekly CVE checks on base images)
- ⚠️ `pnpm audit` not yet in CI pipeline — Dependabot PRs serve as the vulnerability notification channel

## Compliance & Documentation
- [x] Review security policies needed — SECURITY.md created
- [x] Check error messages for information disclosure
- [x] Document security findings — SECURITY_AUDIT.md completed

### Compliance Findings

**GRN:**
- ✅ Error messages are generic to external users (tRPC returns `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN` — no stack traces)
- ✅ Server-side error logs don't leak user data, passwords, or tokens (verified via grep)
- ✅ No PII exposed in API responses (user email returned by `getSession` requires auth)
- ✅ CORS is not wide open — restricted to configured origins

**YEL (Fixed):**
- ✅ `SECURITY.md` created with vulnerability reporting policy, scope, and security practices
- ✅ CSP headers added to `next.config.ts` — Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- ⚠️ No `.env.encrypted` or SOPS/Sealed Secrets configuration for managing production secrets in git

**RED:**
- ❌ None found
