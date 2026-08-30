# PayPal SVG Icon Generation

## Overview

The **PayPal SVG icon generation** workflow converts a collection of PayPal SVG files
from a local mirror (`paypal_mirror/`) into a TypeScript module used by the Mini App.
The generated file lives at:

```
miniapp/src/lib/paypal/Icons.tsx
```

This file is **auto‑generated**; it should never be edited manually because any
subsequent run of the generator will overwrite it.

## Prerequisites

1. **PayPal mirror** – A local copy of the PayPal UI assets must be present under
   `paypal_mirror/`. The repository includes a script that can create or update the
   mirror using `HTTrack` (see the top‑level README for the exact command).
2. **Node.js** – Version 18+ (the workspace uses Node 18 in CI).

## Generating Icons

Run the generator with the standard script:

```bash
npm run generate:icons            # uses the full mirror at ./paypal_mirror
```

For isolated unit tests or CI runs you can point the generator at a temporary
mirror by setting the `MIRROR_ROOT_OVERRIDE` environment variable:

```bash
MIRROR_ROOT_OVERRIDE=/path/to/mock npm run generate:icons
```

## Why This File Is Generated

`miniapp/src/lib/paypal/Icons.tsx` contains a set of React components (e.g.
`export const FooIcon = ...`) that embed the SVG markup. Keeping this file
generated ensures:

* **Consistency** – any change to the source SVGs is reflected automatically.
* **Type safety** – the components are typed as React `FC` objects, avoiding manual
  copy‑and‑paste errors.
* **Performance** – the SVG content is inlined, eliminating extra network requests.

## Testing

The generator is covered by a unit test that creates a temporary mock mirror,
executes the script, and asserts that the resulting `Icons.tsx` contains the
expected component exports.

Run the test with:

```bash
npm run test:icons
```

The CI workflow (`.github/workflows/miniapp-ci.yml`) now runs this test on every
push/pull‑request, guaranteeing the generated file remains valid.

## Integration with Development Workflow

For local development the Mini App's `dev` and `build` scripts invoke the icon
generator automatically, so you never have to remember to run it manually.

```json
"scripts": {
  // The generator lives at the repository root, so we invoke it with the
  // appropriate `--prefix ..` flag when running from the Mini‑App package.
  // This ensures `npm run dev` and `npm run build` always regenerate the
  // PayPal SVG‑to‑React components before starting Vite.
  "dev": "npm run generate:icons --prefix .. && vite",
  "build": "npm run generate:icons --prefix .. && vite build",
  ...
}
```

## Contributing

* **Never edit `Icons.tsx` directly** – any required changes should be made to
  the source SVGs in the PayPal mirror and then regenerated.
* If you add new SVG files to the mirror, rerun `npm run generate:icons` and
  commit the updated `Icons.tsx`.
* Keep the unit test (`scripts/__tests__/generate-paypal-icons.test.js`) up to
  date if the generation logic changes.

---

*This README lives in `scripts/` as the canonical reference for the icon
generation workflow.*
