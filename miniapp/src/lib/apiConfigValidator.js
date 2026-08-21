/**
 * API configuration validation and diagnostics
 * Detects missing or incorrect API URLs before attempting requests
 * Reports specific configuration errors to users
 */

import { getApiEnvironmentStatus } from './api';

const ISSUE_CODES = {
  API_BASE_URL_MISSING: 'API_BASE_URL_MISSING',
  API_BASE_URL_INVALID: 'API_BASE_URL_INVALID',
  API_ORIGIN_MISMATCH: 'API_ORIGIN_MISMATCH',
  PRODUCTION_API_NOT_CONFIGURED: 'PRODUCTION_API_NOT_CONFIGURED'
};

class ApiConfigValidator {
  constructor() {
    this.lastValidation = null;
    this.cachedIssues = [];
  }

  validate() {
    const status = getApiEnvironmentStatus();
    const issues = [];

    // Check if API base URL is configured
    if (!status.configuredBaseUrl) {
      if (this.isProductionEnvironment()) {
        issues.push({
          code: ISSUE_CODES.PRODUCTION_API_NOT_CONFIGURED,
          severity: 'critical',
          message: 'Transferly API URL is not configured for production',
          details: 'VITE_API_BASE_URL environment variable is missing',
          fix: 'Set VITE_API_BASE_URL to the correct API endpoint (e.g., https://api.transferly.app)'
        });
      } else {
        issues.push({
          code: ISSUE_CODES.API_BASE_URL_MISSING,
          severity: 'warning',
          message: 'API URL not explicitly configured',
          details: 'Using relative API calls (may route to frontend origin)',
          fix: 'Set VITE_API_BASE_URL in development environment'
        });
      }
    }

    // Check if API URL is valid
    if (status.configuredBaseUrl) {
      try {
        new URL(status.configuredBaseUrl);
      } catch (_error) {
        issues.push({
          code: ISSUE_CODES.API_BASE_URL_INVALID,
          severity: 'critical',
          message: 'API URL is malformed',
          details: `Invalid URL: ${status.configuredBaseUrl}`,
          fix: 'Ensure VITE_API_BASE_URL is a valid URL (e.g., https://api.example.com)'
        });
      }
    }

    // Check for origin mismatch in production
    if (
      this.isProductionEnvironment() &&
      typeof window !== 'undefined' &&
      status.configuredBaseUrl &&
      !issues.some((issue) => issue.code === ISSUE_CODES.API_BASE_URL_INVALID)
    ) {
      const appOrigin = window.location.origin;
      const apiOrigin = new URL(status.configuredBaseUrl).origin;

      if (appOrigin === apiOrigin) {
        issues.push({
          code: ISSUE_CODES.API_ORIGIN_MISMATCH,
          severity: 'warning',
          message: 'API and frontend share the same origin',
          details: `Both deployed to ${appOrigin}`,
          fix: 'This is expected if running a monolith deployment'
        });
      }
    }

    this.lastValidation = {
      timestamp: new Date().toISOString(),
      environment: status,
      issues,
      isValid: issues.filter(i => i.severity === 'critical').length === 0
    };

    this.cachedIssues = issues;
    return this.lastValidation;
  }

  isProductionEnvironment() {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    // Vercel domains
    if (hostname.includes('vercel.app')) return true;
    // Production domains (not localhost, 127.0.0.1, etc)
    if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)) {
      return true;
    }
    return false;
  }

  getValidation() {
    return this.lastValidation;
  }

  getCriticalIssues() {
    return this.cachedIssues.filter(i => i.severity === 'critical');
  }

  getWarnings() {
    return this.cachedIssues.filter(i => i.severity === 'warning');
  }

  reportDiagnostics() {
    const validation = this.validate();

    if (!validation.isValid) {
      console.error('[Transferly] Critical API configuration issues detected:');
      validation.issues.forEach(issue => {
        console.error(`  - ${issue.code}: ${issue.message}`);
        console.error(`    Details: ${issue.details}`);
        console.error(`    Fix: ${issue.fix}`);
      });
    }

    return validation;
  }
}

export const apiConfigValidator = new ApiConfigValidator();
export { ISSUE_CODES };
