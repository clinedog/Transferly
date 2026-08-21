# Transferly Production Deployment & Operations Guide

## 1. Pre-Deployment Checklist

### Security
- [ ] All secrets rotated in last 90 days
- [ ] Audit logs reviewed for anomalies
- [ ] Dependency audit clean (npm audit --audit-level=high passes)
- [ ] No hardcoded credentials in codebase
- [ ] HTTPS/TLS enabled for all endpoints

### Reliability
- [ ] Database backups verified and tested for restore
- [ ] Migration dry-run completed on production-like DB copy
- [ ] Failover/rollback procedures documented and tested
- [ ] Redis cluster configured with replication
- [ ] BullMQ queue monitoring configured

### Performance
- [ ] Load test completed (k6/locust)
- [ ] Bundle size within budgets
- [ ] Database query performance analyzed
- [ ] Cache strategy reviewed

### Compliance
- [ ] Audit logs enabled and immutable
- [ ] Data retention policy implemented
- [ ] GDPR/compliance requirements met
- [ ] Legal review completed

## 2. Deployment Procedures

### Staging Deployment
```bash
# 1. Deploy to staging environment
git checkout main && git pull
npm ci --prefix api && npm ci --prefix miniapp && npm ci --prefix bot

# 2. Run full verification
npm run lint --prefix api
npm run lint --prefix miniapp
npm run db:migrate --prefix api  # on staging DB copy
npm test --prefix api
npm run test:e2e --prefix miniapp

# 3. Smoke tests
npm run smoke:providers --prefix miniapp
npm run verify:paypal:sandbox --prefix api

# 4. Monitor for 24 hours
# - Check error rates (Sentry/Telemetry)
# - Monitor Redis/queue health
# - Review audit logs
```

### Production Deployment (Canary)
```bash
# 1. Create feature flag in code for new features
# 2. Deploy to 10% of traffic with monitoring
# 3. Verify metrics for 1 hour
# 4. Expand to 50% traffic
# 5. Expand to 100% if stable for 2 hours
# 6. Keep canary flag active for 48 hours before removing
```

### Rollback Procedure
```bash
# If critical issues detected:
git revert <commit-hash>
git push origin main
# Re-deploy previous stable version
npm run db:migrate --prefix api  # down migrations if needed
# Monitor error rates and verify stability
```

## 3. Incident Response

### High-Priority Issues
1. Immediately disable problematic feature (feature flag)
2. Alert on-call team
3. Begin investigation
4. If unfixable in <15 min: execute rollback
5. Post-mortem within 24 hours

### On-Call Runbook
- **Database is slow**: Check connection pool, query plans, check for long-running transactions
- **Redis is down**: Restart service, check memory usage, verify replication
- **Payment webhook delays**: Check BullMQ queue depth, verify PayPal status page
- **API endpoints timeout**: Check database locks, verify Redis connectivity, scale if needed
- **Mini app won't load**: Check CDN status, verify API health, check browser cache

## 4. Monitoring & Alerts

### Key Metrics to Track
- API error rate (target: <0.1%)
- API response time (p95: <500ms)
- Database query time (p95: <100ms)
- BullMQ queue depth (alert if >1000)
- Redis memory usage (alert if >80%)
- Mini app bundle size (alert if >500KB gzip)

### Alert Thresholds
- Error rate >1% for 5 min → Page on-call
- Error rate >5% for 2 min → Page on-call + notify engineering lead
- Response time p95 >2s for 10 min → Alert on-call
- Database unavailable → Immediate page

## 5. Backup & Disaster Recovery

### Database Backups
```bash
# Daily backups (automated)
sqlite3 data/transferly.sqlite ".backup backup-$(date +%Y%m%d).db"

# Weekly offsite backup
aws s3 cp backup-latest.db s3://transferly-backups/

# Recovery test (weekly)
sqlite3 backup-latest.db ".schema" | sqlite3 test-recovery.db
```

### RTO/RPO Targets
- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 15 minutes

## 6. Performance Tuning

### Database Optimization
```sql
-- Add missing indices
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_ledger_wallet_created ON ledger_entries(wallet_id, created_at);

-- Analyze query plans
EXPLAIN QUERY PLAN SELECT ...
```

### Redis Optimization
- Use pipelining for bulk operations
- Set appropriate TTL for cached data
- Monitor eviction policies

### Mini App Optimization
- Enable gzip compression
- Code split by route
- Lazy load non-critical components
- Use service workers for offline support

## 7. Scheduled Maintenance

### Daily
- Review error logs
- Check payment webhook processing
- Verify database backup completion

### Weekly
- Security scanning (npm audit)
- Dependency check
- Backup recovery test
- Performance review

### Monthly
- Full audit log review
- Database maintenance (analyze, vacuum)
- Dependency updates (if minor/patch)
- Capacity planning review

## 8. Communication Plan

### Incidents
- Declare incident in #incidents Slack channel
- Post status updates every 15 minutes
- Notify customers if >15 min user-facing impact
- Post-mortem within 24 hours

### Maintenance Windows
- Announce 48 hours in advance
- Schedule during low-traffic periods (2am UTC)
- Max 30 minute window
- Have rollback plan ready

## 9. Feature Flags

### Deployment Pattern
```javascript
if (featureFlags.isEnabled('tonconnect-linking')) {
  // New TonConnect flow
} else {
  // Old flow (fallback)
}
```

### Feature Flag Control
- Managed via environment variable or database
- Gradual rollout (1%, 10%, 50%, 100%)
- A/B testing support
- Metrics collection

## 10. Post-Deployment Checklist

- [ ] Health checks passing
- [ ] Error rates normal
- [ ] Payment processing working
- [ ] API response times normal
- [ ] Mini app loads correctly
- [ ] Audit logs being recorded
- [ ] Backups created successfully
- [ ] Team notified of successful deployment
