# BSC-Exclusive-POMS Security Checklist

## Production Security Checklist

### 1. Environment Configuration
- [ ] `NODE_ENV=production` is set
- [ ] `CLERK_SECRET_KEY` is set (from Clerk Dashboard → API Keys)
- [ ] `DEMO_MODE=false` or unset
- [ ] `DATABASE_URL` uses SSL connection
- [ ] `CORS_ORIGIN` is configured for production domain only
- [ ] No secrets committed to version control
- [ ] `.env` files are in `.gitignore`

### 2. Authentication
- [ ] Passwords are hashed with bcrypt (cost factor >= 10)
- [ ] Password complexity requirements enforced (uppercase, lowercase, number, special char)
- [ ] Minimum password length is 8 characters
- [ ] Account lockout after 5 failed attempts
- [ ] Lockout duration is 15 minutes
- [ ] CAPTCHA required for login in production
- [ ] Clerk manages session tokens and expiry automatically
- [ ] Token invalidation on password change

### 3. Authorization
- [ ] All protected endpoints require authentication
- [ ] RBAC permissions checked server-side
- [ ] Division scope isolation enforced
- [ ] Section scope isolation enforced
- [ ] Super admin bypass works correctly
- [ ] No client-side-only security checks

### 4. Input Validation
- [ ] All write endpoints use Zod schema validation
- [ ] Email format validation on user creation
- [ ] UUID format validation on ID parameters
- [ ] String length limits enforced
- [ ] Numeric range validation
- [ ] Required field validation
- [ ] Input sanitization middleware active

### 5. SQL Injection Prevention
- [ ] All queries use parameterized placeholders
- [ ] No string concatenation of user input into SQL
- [ ] Dynamic WHERE clauses use parameterized push
- [ ] Database user has minimal permissions

### 6. XSS Prevention
- [ ] Content Security Policy configured
- [ ] `script-src 'self'` (no `unsafe-eval`)
- [ ] React automatic escaping active
- [ ] No `dangerouslySetInnerHTML` for user content
- [ ] Input sanitization strips dangerous patterns

### 7. Security Headers
- [ ] Helmet middleware active
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] `Strict-Transport-Security` configured
- [ ] `Content-Security-Policy` configured
- [ ] `Referrer-Policy` configured
- [ ] `Permissions-Policy` configured
- [ ] `X-XSS-Protection` enabled

### 8. Rate Limiting
- [ ] Global API rate limit active (600/60s)
- [ ] Login rate limit active (10/5min)
- [ ] CAPTCHA rate limit active (60/60s)
- [ ] Rate limit headers included in responses
- [ ] Retry-After header sent when exceeded

### 9. File Upload Security
- [ ] Dangerous file extensions blocked
- [ ] MIME type validation active
- [ ] File size limits enforced (200MB)
- [ ] Max files per upload enforced (20)
- [ ] Filenames sanitized
- [ ] Uploads stored outside web root
- [ ] Profile photos restricted to images

### 10. Error Handling
- [ ] No stack traces exposed to clients
- [ ] No database queries in error messages
- [ ] No server paths in error messages
- [ ] Generic error messages for 500 errors
- [ ] Structured error responses for client errors

### 11. Logging & Monitoring
- [ ] Security events logged (login, logout, failures)
- [ ] Audit trail for state changes
- [ ] Rate limit events logged
- [ ] Suspicious payload detection logged
- [ ] No passwords/tokens in logs
- [ ] Log rotation configured

### 12. CORS Configuration
- [ ] Only production domain allowed
- [ ] Credentials enabled for token auth
- [ ] Preflight cache configured
- [ ] Allowed methods limited
- [ ] Allowed headers limited

### 13. Database Security
- [ ] Strong database credentials
- [ ] Database not publicly exposed
- [ ] SSL connections required
- [ ] Connection pooling configured
- [ ] Audit logs append-only (DB trigger)

### 14. Dependencies
- [ ] `npm audit` passes with no high/critical vulnerabilities
- [ ] Unused packages removed
- [ ] Lock files committed
- [ ] Dependency updates scheduled

### 15. Deployment
- [ ] HTTPS enforced
- [ ] HTTP redirects to HTTPS
- [ ] TLS certificates valid
- [ ] HSTS enabled
- [ ] Reverse proxy configured
- [ ] Database backups enabled
- [ ] Backup encryption configured

### 16. Admin Security
- [ ] Admin routes require super_admin permission
- [ ] Role management restricted to super_admin
- [ ] User management requires proper permissions
- [ ] Settings changes logged
- [ ] Destructive operations require confirmation

### 17. Session Management
- [ ] Clerk manages tokens securely (httpStorage + memory)
- [ ] Tokens not in URLs
- [ ] Tokens not in logs
- [ ] Logout clears Clerk session
- [ ] Session timeout configured via Clerk Dashboard

---

## Security Testing Checklist

### Authentication Testing
- [ ] Login with valid credentials succeeds
- [ ] Login with invalid password fails
- [ ] Login with invalid email/username fails
- [ ] CAPTCHA required in production
- [ ] Account lockout after 5 failed attempts
- [ ] Lockout expires after 15 minutes
- [ ] Password change requires current password
- [ ] Password complexity enforced

### Authorization Testing
- [ ] Unauthenticated requests return 401
- [ ] Invalid tokens return 401
- [ ] Expired tokens return 401
- [ ] Wrong token type returns 401
- [ ] Missing permission returns 403
- [ ] Division scope enforced
- [ ] Section scope enforced
- [ ] Super admin bypass works

### Input Validation Testing
- [ ] Missing required fields return 400
- [ ] Invalid email format returns 400
- [ ] Invalid UUID format returns 400
- [ ] String too long returns 400
- [ ] Number out of range returns 400
- [ ] Invalid enum value returns 400

### SQL Injection Testing
- [ ] `' OR '1'='1` in login fails
- [ ] `'; DROP TABLE users;--` blocked
- [ ] UNION injection attempts blocked
- [ ] Parameterized queries used everywhere

### XSS Testing
- [ ] `<script>alert(1)</script>` stripped
- [ ] `javascript:` URI blocked
- [ ] Event handlers (`onload=`) stripped
- [ ] CSP blocks inline scripts

### Rate Limiting Testing
- [ ] Exceeding rate limit returns 429
- [ ] Retry-After header present
- [ ] X-RateLimit headers present
- [ ] Different endpoints have separate limits

### File Upload Testing
- [ ] `.exe` upload blocked
- [ ] `.php` upload blocked
- [ ] `.bat` upload blocked
- [ ] Large files rejected
- [ ] Too many files rejected
- [ ] Invalid MIME types rejected

### Error Handling Testing
- [ ] 500 errors return generic message
- [ ] No stack traces in responses
- [ ] No database queries in responses
- [ ] No server paths in responses

### Security Headers Testing
- [ ] All security headers present
- [ ] CSP header configured
- [ ] HSTS header present (HTTPS)
- [ ] X-Frame-Options configured

---

## Incident Response Checklist

### Detection
- [ ] Security monitoring active
- [ ] Anomaly detection configured
- [ ] Alert thresholds set

### Containment
- [ ] IP blocking capability available
- [ ] Account suspension capability available
- [ ] Token revocation capability available

### Investigation
- [ ] Audit logs accessible
- [ ] Security event logs accessible
- [ ] Database logs accessible

### Recovery
- [ ] Backup restoration tested
- [ ] Secret rotation procedure documented
- [ ] System integrity verification procedure

### Documentation
- [ ] Incident response plan documented
- [ ] Contact information updated
- [ ] Post-incident review process defined

---

*Last updated: September 2026*
