# BSC-Exclusive-POMS Security Architecture

## Overview

This document describes the defense-in-depth security architecture implemented in the BSC-Exclusive-POMS application. The system follows a zero-trust model where every request is validated at multiple layers before reaching business logic.

## Security Layers

```
User Request
    ↓
[Layer 1] HTTP Security Headers (Helmet)
    ↓
[Layer 2] CORS Origin Validation
    ↓
[Layer 3] Rate Limiting (Global + Per-Endpoint)
    ↓
[Layer 4] Request Body Size Limits
    ↓
[Layer 5] Input Sanitization
    ↓
[Layer 6] Suspicious Payload Detection
    ↓
[Layer 7] Security Event Logging Context
    ↓
[Layer 8] Authentication (JWT + Password + CAPTCHA)
    ↓
[Layer 9] Authorization (RBAC + Division/Section Scoping)
    ↓
[Layer 10] Input Validation (Zod Schemas)
    ↓
[Layer 11] Parameterized SQL Queries
    ↓
[Layer 12] Audit Logging
    ↓
[Layer 13] Secure Error Handling
    ↓
Business Logic
```

## 1. Security Headers (Helmet)

The application uses `helmet` middleware to set industry-standard HTTP security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Strict policy (see below) | Prevents XSS, data injection |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `X-Download-Options` | `noopen` | Prevents IE download injection |
| `X-DNS-Prefetch-Control` | `off` | Prevents DNS prefetching |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer info |
| `Permissions-Policy` | Restrictive (no camera, mic, payment, etc.) | Feature restrictions |
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevents cross-origin attacks |
| `X-Permitted-Cross-Domain-Policies` | `none` | Flash/PDF cross-domain |
| `Hide-Powered-By` | (removed) | Hides framework info |

### Content Security Policy

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'self';
form-action 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
img-src 'self' data: blob: https: http:;
media-src 'self' blob: https: http:;
connect-src 'self' ws: wss: https: http:;
```

## 2. CORS Configuration

- Configured via `CORS_ORIGIN` environment variable
- Comma-separated list of allowed origins
- Credentials enabled for token-based auth
- Missing Origin (same-origin, curl) always passes
- Preflight cache: 24 hours

## 3. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Global API | 600 requests | 60 seconds |
| Login | 10 attempts | 5 minutes |
| CAPTCHA | 60 requests | 60 seconds |

Rate limits are per-IP with sliding window implementation. Response headers include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `Retry-After`: Seconds until next request allowed (when exceeded)

## 4. Authentication

### Password Hashing
- Algorithm: bcrypt (cost factor 10)
- Never stores plaintext passwords
- Password complexity requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### JWT Tokens
- **Access Token**: Short-lived (8 hours), type `access`
- **Refresh Token**: Longer-lived (7 days), type `refresh`
- Algorithm: HS256
- Minimum secret length: 32 characters (enforced at boot)
- Token claims include `sub` (user ID), `type`, and `pwChanged` timestamp

### Token Invalidation
- Password changes update `password_changed_at` timestamp
- Tokens issued before the password change are rejected
- This ensures all sessions are invalidated on password change

### Account Lockout
- Account locked after 5 failed attempts
- Lockout duration: 15 minutes
- Counter resets on successful login

### CAPTCHA
- Server-side SVG CAPTCHA with 30-second TTL
- Single-use tokens
- Required in production, optional in demo mode

## 5. Role-Based Access Control (RBAC)

### Roles
| Role | Description |
|------|-------------|
| `super_admin` | Full system access |
| `domain_admin` | Division-level admin |
| `purchase_manager` | PO approval authority |
| `purchase_executive` | PO creation |
| `approver` | Approval workflow |
| `receiving_user` | GRN/receiving |
| `viewer` | Read-only access |
| `auditor` | Audit log access |

### Authorization Layers
1. **Authentication**: JWT token verification
2. **Permission Check**: `requirePermission(code)` middleware
3. **Division Scope**: `scopeDivision(req, divisionId)` - data isolation
4. **Section Scope**: `scopeSection(req, sectionId)` - collection isolation

### Super Admin Bypass
- `isSuperAdmin` flag grants blanket bypass on scope checks
- Permission checks also bypass for super_admin role

## 6. Input Validation

### Zod Schema Validation
All write endpoints use Zod schemas for request validation:

- **Type validation**: Ensures correct data types
- **Length limits**: Prevents excessively large inputs
- **Format validation**: Email, UUID, regex patterns
- **Range validation**: Numeric min/max values
- **Required fields**: Mandatory field enforcement
- **Enum validation**: Allowed value restrictions

### Input Sanitization
All request data is sanitized before processing:

- **Null byte removal**: Prevents path traversal
- **HTML pattern stripping**: Removes `<script>`, `javascript:`, event handlers
- **Suspicious payload detection**: Blocks SQL injection, XSS, path traversal patterns

## 7. SQL Injection Protection

- **Parameterized queries**: All SQL uses `$1`, `$2` placeholders
- **Dynamic WHERE clauses**: Built incrementally with parameterized push
- **No string interpolation**: User input never directly concatenated into SQL
- **Query builder pattern**: Safe dynamic query construction

## 8. XSS Protection

- **CSP**: Strict Content Security Policy prevents script execution
- **React escaping**: Automatic output encoding in JSX
- **Input sanitization**: Strips dangerous HTML patterns
- **No `dangerouslySetInnerHTML`** for user content
- **CAPTCHA SVG**: Server-generated, no user input in SVG

## 9. CSRF Protection

- **Bearer token auth**: Tokens in Authorization header, not cookies
- **CORS**: Origin validation prevents cross-origin requests
- **SameSite**: Cookie attributes configured for security

## 10. File Upload Security

- **Extension blocking**: Dangerous extensions blocked (`.exe`, `.bat`, `.php`, etc.)
- **MIME type validation**: Verified against safe prefixes
- **File size limits**: 200MB per file, 20 files per upload
- **Filename sanitization**: Regex-safe characters, length limits
- **Storage location**: Outside executable web directories
- **Profile photos**: Restricted to `image/*` MIME types

## 11. Security Logging

### Event Types
| Event | Description |
|-------|-------------|
| `auth.login.success` | Successful login |
| `auth.login.failure` | Failed login attempt |
| `auth.logout` | User logout |
| `auth.token.refresh` | Token refresh |
| `auth.password.change` | Password change |
| `auth.account.locked` | Account locked |
| `auth.captcha.failure` | CAPTCHA failure |
| `auth.unauthorized` | Unauthorized access |
| `auth.forbidden` | Permission denied |
| `security.rate_limited` | Rate limit exceeded |
| `security.suspicious_payload` | Suspicious content detected |
| `security.file_upload.blocked` | File upload rejected |

### Audit Trail
- All state-changing operations logged to `audit_logs` table
- Immutable (DB trigger blocks UPDATE/DELETE)
- Records: user, role, action, entity, before/after values

## 12. Error Handling

- **No stack traces**: Never exposed to clients
- **Generic messages**: Internal errors return "An unexpected error occurred"
- **Structured errors**: Client errors include message, code, details
- **No implementation details**: Database queries, paths, secrets never leaked
- **Production mode**: Detailed errors logged server-side only

## 13. Environment Variables

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `CLERK_SECRET_KEY` | Clerk secret key (from Dashboard → API Keys) | `sk_test_...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `PORT` | Server port | `4040` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `https://app.example.com` |

### Security Rules
- Never hard-code secrets in source code
- `.env` files excluded from version control
- Production requires strong secrets (32+ characters)
- Separate configs for dev/test/staging/production

## 14. Database Security

- **Parameterized queries**: SQL injection prevention
- **Least privilege**: Database user with minimal permissions
- **Connection pooling**: Max 10 connections
- **SSL**: Auto-detected for Supabase connections
- **Transactions**: Proper BEGIN/COMMIT/ROLLBACK
- **Audit logs**: Append-only with DB trigger protection

## 15. Network Security

### Production Architecture
```
User → HTTPS → CDN/WAF → Reverse Proxy → Application → Database
```

### Firewall Rules (Recommended)
- HTTPS (443): Public
- HTTP (80): Redirect to HTTPS only
- SSH (22): Restricted by IP/VPN
- Database (5432): Private network only
- Application (4040): Private network only

## 16. Deployment Security

### Production Checklist
- [ ] `NODE_ENV=production`
- [ ] Strong `CLERK_SECRET_KEY` set from Clerk Dashboard
- [ ] HTTPS enabled
- [ ] CORS configured for production domain
- [ ] `DEMO_MODE=false`
- [ ] Security headers enabled
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Database backups enabled
- [ ] File upload limits configured

## 17. Incident Response

### Steps
1. **Detect**: Monitor security logs for anomalies
2. **Contain**: Block malicious IPs, revoke compromised tokens
3. **Investigate**: Review audit logs and security events
4. **Revoke**: Change secrets, rotate keys
5. **Restore**: Recover from clean backups if needed
6. **Verify**: Confirm system integrity
7. **Document**: Record incident details and lessons learned

## 18. Security Testing

### Automated Tests
- `npm run check` - Backend syntax validation
- `npm run build` - Frontend build verification
- `npm run e2e` - End-to-end API testing
- `npm audit` - Dependency vulnerability scanning

### Manual Testing
- Authentication bypass attempts
- Authorization escalation attempts
- SQL injection testing
- XSS injection testing
- File upload validation
- Rate limit verification
- Session management testing

## 19. Remaining Risks

### Accepted Risks
1. **In-memory rate limiting**: Not distributed across processes (single-process deployment only)
2. **No Redis**: Token revocation uses timestamp comparison, not real-time blacklist
3. **No MFA**: Multi-factor authentication not implemented (ready for future)
4. **No WAF**: Application-level protection only (infrastructure WAF recommended)

### Mitigations
- Strong password policies
- Account lockout after failed attempts
- Token invalidation on password change
- Comprehensive audit logging
- Security headers and CSP

## 20. Future Enhancements

1. **Redis-backed rate limiting**: For horizontal scaling
2. **Refresh token rotation**: New token on each refresh
3. **MFA/2FA**: TOTP or SMS-based verification
4. **Real-time threat detection**: IP reputation, anomaly detection
5. **Automated security scanning**: CI/CD integration
6. **Web Application Firewall**: Cloudflare or AWS WAF
7. **Database encryption**: At-rest encryption
8. **Key rotation**: Automated secret rotation

---

*Last updated: September 2026*
*Security audit completed: September 2026*
