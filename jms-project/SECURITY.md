# Security Policy

## Overview

This document outlines the security measures implemented in the JMS system.

## Authentication & Authorization

### Supabase Auth
- JWT-based authentication with 1-hour expiry
- Secure password hashing with bcrypt
- Session management with refresh tokens
- Email verification for account creation

### API Protection
```typescript
// All protected routes require valid JWT
const token = req.headers.authorization?.replace('Bearer ', '');
const { user, error } = await supabase.auth.getUser(token);
```

### User Isolation
- Row-level security (RLS) on all tables
- Queries filtered by `user_id` to prevent cross-user access
- Database policies enforce isolation at DB level

## Database Security

### Parameterized Queries
```typescript
// Safe - uses parameterized query
db.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId)

// Never: SQL injection vulnerable
db.prepare(`SELECT * FROM jobs WHERE id = '${jobId}'`)
```

### Encryption
- Sensitive fields encrypted at rest in D1
- TLS 1.2+ for all database connections
- Cloudflare DDoS protection enabled

### Backup Security
- Daily automated backups in Cloudflare
- Backups encrypted and geographically distributed
- Recovery tested monthly

## API Security

### CORS Configuration
```typescript
// Only allow requests from your domain
const allowedOrigins = [
  'https://jms.yourdomain.com',
  'https://www.jms.yourdomain.com'
];
```

### Rate Limiting
- Cloudflare rate limiting: 100 requests/10 seconds per IP
- Configurable per endpoint
- Automatic DDoS mitigation

### Request Validation
```typescript
// Always validate input
if (!email || !password) {
  return res.status(400).json({ error: 'Invalid input' });
}
```

### HTTPS Only
- All traffic enforced over HTTPS
- HSTS headers enabled
- Certificate auto-renewal

## Frontend Security

### XSS Prevention
- React automatically escapes content
- No `dangerouslySetInnerHTML` used
- Content Security Policy headers

### CSRF Protection
- SameSite cookies enabled
- CSRF tokens for state-changing operations
- Double-submit cookie pattern for sensitive actions

### Type Safety
- TypeScript for compile-time type checking
- Prevents common JS vulnerabilities
- Strict null checks enabled

## Secrets Management

### Environment Variables
```bash
# Never commit secrets
# Use .env.local (gitignored)
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=secret_xyz
```

### Cloudflare Secrets
- Stored in Pages Environment Variables
- Encrypted at rest
- Rotated periodically

### Key Rotation
```bash
# Rotate Supabase keys quarterly
# 1. Generate new key in Supabase dashboard
# 2. Update environment variables
# 3. Test in staging first
# 4. Deploy to production
```

## File Upload Security

### Image Validation
```typescript
// Validate file type
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowedTypes.includes(file.type)) {
  throw new Error('Invalid file type');
}

// Validate file size (max 10MB)
if (file.size > 10 * 1024 * 1024) {
  throw new Error('File too large');
}
```

### Storage
- Images stored in Cloudflare R2 (when implemented)
- Automatic virus scanning
- CDN caching with 1-day expiry

## Audit Logging

### User Actions Logged
- Login/logout events
- Data modifications
- File uploads
- Admin actions

### Query Logging
- All database queries logged
- Includes timestamp, user, action
- 90-day retention

### Access Review
```sql
-- Check who accessed what when
SELECT user_id, action, created_at FROM audit_logs
WHERE created_at > datetime('now', '-7 days')
ORDER BY created_at DESC;
```

## Compliance

### GDPR
- User data can be exported
- Account deletion removes all user data
- Privacy policy provided
- Consent management for cookies

### Data Retention
- Deleted jobs retained for 30 days (soft delete)
- Backup data retained for 90 days
- Audit logs retained for 1 year
- User can request permanent deletion

## Security Headers

Cloudflare automatically sets:
```
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## Regular Security Tasks

### Weekly
- Review error logs for suspicious activity
- Check for failed login attempts
- Monitor API usage patterns

### Monthly
- Update dependencies (npm audit)
- Review and rotate API keys
- Test backup restoration
- Audit user access levels

### Quarterly
- Security audit of codebase
- Penetration testing
- Update security policies
- Compliance review

## Incident Response

### If Breach Suspected
1. Immediately revoke all active sessions
2. Force password reset for affected users
3. Review access logs for the breach period
4. Notify users within 24 hours
5. Document incident thoroughly
6. Implement preventive measures

### Contact
- Security issues: security@yourdomain.com
- Do not post security issues publicly
- Allow 30 days for response

## Third-Party Security

### Dependencies
- npm packages scanned for vulnerabilities
- Use `npm audit` regularly
- Update packages promptly
- Monitor security advisories

### Supabase Security
- SOC 2 Type II compliant
- GDPR compliant
- Automatic security patches
- 24/7 infrastructure monitoring

### Cloudflare Security
- Enterprise-grade DDoS protection
- WAF (Web Application Firewall)
- Bot management
- API rate limiting

## Security Checklist

Before production deployment:

- [ ] All secrets in environment variables
- [ ] HTTPS/TLS enabled
- [ ] CORS properly configured
- [ ] Rate limiting configured
- [ ] User isolation verified
- [ ] Input validation in all endpoints
- [ ] SQL injection tests passed
- [ ] XSS prevention verified
- [ ] CSRF tokens in place
- [ ] Audit logging enabled
- [ ] Backup tested
- [ ] Security headers verified
- [ ] Dependencies audited
- [ ] Documentation reviewed
- [ ] Team trained on security

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/security)
- [Cloudflare Trust](https://www.cloudflare.com/security/)
- [Next.js Security](https://nextjs.org/learn/seo/introduction-to-seo)

---

Last updated: June 2024
Contact: security@yourdomain.com
