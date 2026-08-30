# Contributing to Transferly

## Development workflow

When working on the **Mini App** you will frequently need the generated PayPal
SVG‑to‑React component library (`miniapp/src/lib/paypal/Icons.tsx`). The repository
provides a script that converts the PayPal mirror SVGs into a TypeScript module:

```bash
npm run generate:icons            # runs the script from the repository root
```

### Why the prefix flag is required

The generator script lives in the **root** `package.json` (`scripts/generate-
paypal-icons.js`). The Mini App's own `package.json` therefore cannot run the
script directly – it would look for a `generate:icons` script inside the Mini App
package and fail.

To make the workflow seamless, the Mini App's `dev` and `build` scripts invoke the
root script with the `--prefix ..` flag:

```json
"scripts": {
  "dev": "npm run generate:icons --prefix .. && vite",
  "build": "npm run generate:icons --prefix .. && vite build"
}
```

When you run `npm run dev --prefix miniapp` or `npm run build --prefix miniapp`
the generator will execute first, ensuring that `Icons.tsx` is up‑to‑date before
Vite starts.

### Local development steps

1. **Start the Mini App** – the generator runs automatically:
   ```bash
   npm run dev --prefix miniapp
   ```
2. **If you modify source SVGs** (e.g. by updating the PayPal mirror), regenerate
   the icons manually and commit the updated `Icons.tsx`:
   ```bash
   npm run generate:icons
   git add miniapp/src/lib/paypal/Icons.tsx
   git commit -m "Update PayPal icons"
   ```

### Testing the generator

The generator is covered by a unit test (`scripts/__tests__/generate-paypal-icons.
test.js`). Run it with:

```bash
npm run test:icons
```

The CI workflow (`.github/workflows/miniapp-ci.yml`) runs this test on every
push/pull‑request, guaranteeing that the generated file remains valid.

---

*Please *never* edit `miniapp/src/lib/paypal/Icons.tsx` directly – always use the
generator.*
