# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BiteBase, please report it privately.

**Do not disclose the issue publicly** until we have had a chance to address it.

### How to report

1. **Email**: Send details to the project maintainer directly
2. **GitHub Issues**: If you have a fix, open a standard issue but do **not** include exploit details in the title or description — use the label `security` and explain that it's a security concern

We aim to respond within **48 hours** and release a fix within **7 days** depending on severity.

## What to include

- A clear description of the vulnerability
- Steps to reproduce (proof of concept is helpful but not required)
- Impact assessment (what an attacker could achieve)
- Suggested fix (if you have one)

## Scope

The following areas are in scope:
- Authentication bypass or session hijacking
- Unauthorized access to user data (prevented by ownership checks)
- SQL injection, XSS, or code execution (prevented by parameterized queries and Zod validation)
- Privilege escalation (prevented by horizontal privilege escalation tests)
- Dependency vulnerabilities with known CVEs (mitigated via Dependabot)

## Out of scope

- Reports about TLS configuration (we use standard settings)
- Missing security headers that don't result in a direct exploit
- Self-XSS (attacks that require the user to paste malicious code)
- Rate limiting concerns without demonstrated impact

## Security practices

BiteBase follows these security practices:
- All database queries use Drizzle ORM parameterized queries (no raw SQL) ✅
- Session tokens are HTTP-only, secure, same-site cookies ✅
- All API inputs are validated with Zod schemas ✅
- Markdown rendering uses react-markdown (no dangerouslySetInnerHTML) ✅
- Dependencies are audited weekly via Dependabot ✅
- Docker images are pinned to specific versions for reproducibility ✅
- **Horizontal privilege escalation tests** in `packages/api/tests/course.integration.test.ts` ✅
- **Secure session management** with Better Auth ✅
- **No secrets in codebase or Docker layers** ✅

Thank you for helping keep BiteBase safe!
