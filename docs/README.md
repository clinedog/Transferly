# Transferly documentation

This directory contains maintained product, architecture, operational, and contributor guidance. Runtime code, package scripts, and tests remain authoritative when implementation details change.

## Start here

- [Next-generation enhancement strategy](next-generation-enhancement-strategy.md) — prioritized product and engineering direction.
- [Transferly V2 implementation checklist](codex/transferly-v2-implementation-checklist.md) — implementation evidence and remaining delivery gates.
- [Project architecture](codex/references/project-architecture.md) — package boundaries and backend layering.
- [Provider module architecture](provider-module-architecture.md) — provider lifecycle, contracts, and extension points.
- [Payment provider adapters](codex/references/payment-provider-adapters.md) — provider capability and integration status.
- [Deployment operations guide](deployment-operations-guide.md) — rollout, rollback, recovery, and incident operations.
- [EC2 deployment](deployment/ec2.md) and [release gates](deployment/release-gates.md) — environment-specific deployment checks.
- [Mini App real-device QA](miniapp-real-device-qa.md) — Telegram client and device validation.

## Maintenance policy

- Keep one canonical document per decision, roadmap, or workflow; update it instead of adding dated copies.
- Do not commit agent session state, generated checkpoints, chat transcripts, or temporary implementation summaries under `docs/`.
- Remove completed plans once their durable decisions are represented by code, tests, an ADR, or maintained reference documentation.
- Keep historical architectural decisions as ADRs when they still explain current constraints.
- Use repository-relative links so documentation works in local clones and code hosts.
- Never include credentials, tokens, webhook headers, production payloads, or private user data.