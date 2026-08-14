# STEP 17 â€” TypeScript / lint / build

## Commands used (from root `package.json`)

| Script | What it runs |
|--------|----------------|
| `npm run typecheck` | tsc `--noEmit` for contracts, domain, ai, db, hardware, ui, api, web, desktop |
| `npm run lint` | Aliases to `npm run typecheck` (no separate ESLint script) |
| `npm run build` | `build:packages` + `apps/api` build + `apps/web` build (tsc + vite) |

Also verified (phase touched desktop):

| Script | Result |
|--------|--------|
| `npm run typecheck --prefix apps/desktop` | PASS |
| `npm run build --prefix apps/desktop` | PASS |

## Results

| Command | Exit code | Notes |
|---------|-----------|-------|
| `npm run typecheck` | **0** | All packages + apps clean |
| `npm run lint` | **0** | Same as typecheck |
| `npm run build` | **0** | Packages, API, web production build OK |
| Desktop typecheck/build | **0** | Online shell builds |

### Build output (web)

- Vite production build succeeded (`apps/web/dist`)
- Advisory only: main chunk &gt; 500 kB â€” **pre-existing**, not a failure; not suppressed or â€œfixedâ€ with config weakenings

## Fixes applied

**None required.** No TypeScript or build errors from the offlineâ†’online conversion phase.

## Guardrails honored

- No `@ts-ignore` / `@ts-nocheck`
- No `eslint-disable` shortcuts
- No intentional `any` introduced to silence errors
- TypeScript config not weakened

## Verdict

**PASS** â€” typecheck, lint, and build all succeed with the projectâ€™s real scripts.
