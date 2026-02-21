# Security Documentation

This document outlines the security practices, architecture, and guidelines for the WhoNow application.

## Table of Contents

1. [Secrets Management](#secrets-management)
2. [Authentication & Authorization](#authentication--authorization)
3. [Data Protection](#data-protection)
4. [API Security](#api-security)
5. [AI Security Controls](#ai-security-controls)
6. [Incident Response](#incident-response)

---

## Secrets Management

### Environment Variables

All secrets are stored securely and accessed via environment variables:

| Secret | Purpose | Access Level |
|--------|---------|--------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Database admin operations | Edge functions only |
| `STRIPE_SECRET_KEY` | Payment processing | Edge functions only |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Edge functions only |
| `LOVABLE_API_KEY` | AI gateway access | Edge functions only |
| `SLACK_CLIENT_ID/SECRET` | Slack OAuth | Edge functions only |
| `MICROSOFT_CLIENT_ID/SECRET` | Teams OAuth | Edge functions only |

### Best Practices

- **Never log secrets** - All logging excludes API keys and tokens
- **Never expose in responses** - Error messages are generic
- **Least privilege** - Each function only has access to required secrets
- **Rotation** - Secrets can be rotated without code changes

---

## Authentication & Authorization

### Authentication Flow

1. Users authenticate via Supabase Auth (email/password)
2. JWT tokens are issued with configurable expiration
3. Tokens are validated on every protected request

### Authorization Levels

| Role | Permissions |
|------|-------------|
| `member` | View own contacts, view company shared contacts |
| `admin` | All member permissions + manage company settings, integrations |

### Password Requirements

- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Passwords are hashed using bcrypt (handled by Supabase)

### Session Security

- Tokens expire after configured period
- Refresh tokens enable seamless re-authentication
- Sign out clears all session data
- "Sign out all devices" available for security incidents

---

## Data Protection

### Data at Rest

- Database hosted on Supabase with encryption at rest
- OAuth tokens stored with row-level security
- Sensitive columns protected by RLS policies

### Data in Transit

- All connections use TLS/HTTPS
- No sensitive data in URL parameters
- API responses exclude unnecessary fields

### Row-Level Security (RLS)

All tables have RLS enabled with policies that ensure:

- **Contacts**: Users see only their own contacts OR company shared contacts
- **Folders**: Users see only their own folders OR company folders (admins)
- **Integrations**: Users see only their own integrations
- **Subscriptions**: Users see only their own subscription data

### Data Minimization

- AI queries receive only role, company, and tags (no PII)
- Audit logs exclude sensitive content
- Error responses are generic

---

## API Security

### Edge Function Security

| Function | JWT Required | Rate Limited | Notes |
|----------|--------------|--------------|-------|
| `check-subscription` | Yes | No | User data access |
| `create-checkout` | Yes | No | Payment initiation |
| `customer-portal` | Yes | No | Billing access |
| `stripe-webhook` | No | No | Signature verified |
| `parse-search-query` | No | Yes | AI usage |
| `scan-business-card` | No | Yes | AI + image |
| `parse-contact-pdf` | No | Yes | AI + file |
| `slack-integration` | Partial | No | OAuth callback public |
| `teams-integration` | Partial | No | OAuth callback public |

### CORS Policy

- Production origins explicitly whitelisted
- Localhost allowed for development
- Credentials require explicit origin match

### Rate Limiting

Applied to prevent abuse:
- AI search: 30 requests/minute
- Business card scan: 20 requests/minute
- Contact imports: 10 requests/minute

### Webhook Security

Stripe webhooks are verified using signature verification:
1. Raw request body preserved
2. Signature from `stripe-signature` header extracted
3. Verified against `STRIPE_WEBHOOK_SECRET`
4. Invalid signatures rejected with 400 status

---

## AI Security Controls

### Context Scoping

AI queries are scoped to authorized data only:
- Only contacts the user owns OR has shared access to
- No cross-organization data leakage

### PII Minimization

Data sent to AI providers excludes:
- Email addresses
- Phone numbers
- Exact names (for search, uses role/company/tags only)

### Prompt Injection Prevention

- User input separated from system instructions
- Input length limits enforced (500 chars for queries)
- Response structure validated before use

### AI Response Handling

- Never use `dangerouslySetInnerHTML` with AI output
- Validate response matches expected JSON schema
- Sanitize AI-generated text before display

---

## Incident Response

### Security Issue Detection

Monitor for:
- Failed authentication attempts
- Unusual API usage patterns
- Rate limit breaches
- Webhook signature failures

### Response Procedures

1. **Contain** - Revoke affected credentials
2. **Investigate** - Review audit logs
3. **Remediate** - Patch vulnerability
4. **Communicate** - Notify affected users if required

### Contact

For security concerns, contact the development team immediately.

---

## Security Checklist for New Features

When adding new features, verify:

- [ ] RLS policies cover new tables
- [ ] JWT verification enabled for sensitive endpoints
- [ ] No secrets logged or exposed
- [ ] Input validation on client and server
- [ ] Error messages don't leak internal details
- [ ] Rate limiting applied if user-facing
- [ ] CORS headers use allowlist
- [ ] AI inputs stripped of PII
- [ ] Audit logging for sensitive operations
