# Active Context

**Current focus**: Finalising the PayPal SVG‑to‑React icon generation workflow
and ensuring the Mini App builds correctly with the updated script prefixes.

**Recent changes**:
- Updated `miniapp/package.json` scripts to use `--prefix ..` when invoking the
  generator.
- Added documentation (`CONTRIBUTING.md`) describing the generation workflow.
- Updated `scripts/README.md` with the correct script examples.

**Next steps**:
1. Run the full verification pipeline (`npm run verify`).
2. Commit and push the changes.
3. Optionally add a scheduled mirror‑refresh workflow.
