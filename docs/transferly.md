Review the entire `Ednnut/Transferly` repository and refactor it into a **modular financial services platform** where every payment provider is implemented as an independent, production-ready service module while sharing a common platform architecture.

## Goal

Transform the project into an enterprise-grade financial workspace where each provider (PayPal, Stripe, Wise, Binance, Cash App, etc.) behaves as a standalone application within Transferly but shares common infrastructure, UI patterns, backend services, and development standards.

Do **not** perform a destructive rewrite. Preserve existing functionality wherever possible and refactor incrementally.

---

# Phase 1 — Repository Analysis

Before making changes:

- Inspect the entire repository.
- Map the current architecture.
- Identify reusable components.
- Identify duplicated provider logic.
- Identify coupling between providers.
- Identify dead code.
- Identify missing abstractions.
- Produce an implementation plan before modifying code.

---

# Phase 2 — Introduce a Modular Provider Architecture

Create a shared Provider Framework.

Each provider should have its own module containing:

- Dashboard
- Overview
- Transactions
- Activity
- Actions
- Settings
- Templates
- API client
- Service layer
- Validation
- Background jobs
- Webhook handlers
- Configuration
- Types
- UI components
- Tests

Example:

providers/
├── paypal/
├── stripe/
├── wise/
├── binance/
├── cashapp/
└── shared/

Every provider must expose the same interface so adding a new provider requires minimal code changes.

---

# Phase 3 — Shared Provider SDK

Create reusable abstractions instead of provider-specific logic.

Examples include:

- BaseProvider
- ProviderRegistry
- ProviderService
- ProviderClient
- ProviderConfig
- ProviderRoutes
- ProviderDashboard
- ProviderSettings
- ProviderActions
- ProviderTransactionHistory
- ProviderNotifications
- ProviderHealth
- ProviderLogger

Avoid duplicate implementations across providers.

---

# Phase 4 — Shared UI System

Standardize the UI so every provider page has a consistent layout.

Each provider should include:

- Overview cards
- Statistics
- Recent activity
- Quick actions
- Transactions
- Search
- Filters
- Status indicators
- Settings
- Notifications
- Loading states
- Empty states
- Error boundaries

Use reusable components rather than copying layouts.

---

# Phase 5 — Backend Abstractions

Move provider-specific logic into dedicated services.

Create common interfaces for:

- API communication
- Validation
- Job dispatching
- Event handling
- Logging
- Error handling
- Webhooks
- File generation
- Notifications

Each provider should only implement its unique behavior.

---

# Phase 6 — Provider Registry

Implement a registry that automatically discovers and registers providers.

The application should not hardcode provider lists.

Support:

- enable/disable providers
- feature flags
- provider metadata
- routing
- navigation
- permissions

---

# Phase 7 — Routing

Generate provider routes dynamically.

Examples:

/providers/paypal
/providers/stripe
/providers/wise

Avoid duplicated route definitions.

---

# Phase 8 — Configuration

Create centralized configuration for all providers.

Support:

- API credentials
- environments
- endpoints
- feature flags
- webhook secrets
- rate limits
- retries
- timeout values

---

# Phase 9 — Testing

Add comprehensive tests for:

- provider registration
- routing
- shared services
- API clients
- UI rendering
- configuration loading
- validation
- background jobs

---

# Phase 10 — Documentation

Document:

- provider architecture
- module lifecycle
- how to add a new provider
- coding standards
- extension points
- testing strategy

---

# Implementation Rules

- Preserve working functionality.
- Avoid breaking existing APIs.
- Prefer composition over duplication.
- Keep modules loosely coupled.
- Follow SOLID principles.
- Follow DRY principles.
- Keep code production-ready.
- Write maintainable, well-documented code.

---

# Verification

After each major change:

- Build the project.
- Run linting.
- Run type checks.
- Run tests.
- Fix regressions immediately.

---

# Deliverables

When complete, provide:

1. Architecture summary.
2. Files created and modified.
3. Refactoring summary.
4. Shared abstractions introduced.
5. Provider modules completed.
6. Remaining technical debt.
7. Recommendations for the next implementation phase.

Do not stop after planning—begin implementing the modular provider architecture immediately, progressing in small, reviewable commits while ensuring the application remains functional throughout the refactor.
