# STATUS.md — audited 2026-09-23

**What it is:** Local-first Pokemon TCG collection & drop-intelligence dashboard (sample-data demo mode, no account/backend needed to view).

**Stack:** Next.js 16 / React 19 / TypeScript / Tailwind (via @tailwindcss/postcss), ESLint.

**How to run:** `npm install && npm run dev` (Next dev server). `npm run build` / `npm start` for production. `npm run lint` for ESLint.

**Lint (run today):** `npm run lint` — clean, no errors reported.

**Tests:** No test script in package.json — this project has no automated test suite. Do not claim a pass count.

**Live check (run today):** https://pokemon-drop-intel.vercel.app -> 200.

**Deploy:** Vercel project `pokemon-drop-intel` (prj_elIF5NvGIMBkfGNEz8HVhkzvCpOa), latest production deployment (2026-09-21, "deps: safe minor/patch upgrades (#16)") READY.

**Local git state (2026-09-23):** HEAD 1363e37 (2026-09-21), working tree clean, remote `bmath8/pokemon-drop-intel` (PUBLIC), in sync, 21 commits, most recently active repo in this cluster.

**Duplicates:**
- `C:\Users\mathe\OneDrive\Desktop\pokemon-drop-intel` — same remote/lineage but 12 commits behind (stopped 2026-07-19), 1 dirty file. Stale, safe to archive once confirmed no unique WIP in that 1 dirty file.
- `C:\Users\mathe\OneDrive\Desktop\Pokemon-STALE-local-backup` — separate git history (own root commit, 2 commits, last 2026-07-22 "ci: add GitHub Actions CI + README badges"), **no remote configured**. Self-labeled "STALE" by Brian already — pure local backup, safe archive/delete candidate, nothing unique to preserve beyond what's in the canonical repo's CI-setup commit.

**Security:** Has automated dependency-upgrade commits with "(auto, build verified)" messages — good hygiene signal (dependencies are being kept current with build verification, most recently 2026-09-21, 2 days before this audit).

**Recommendation:** SHOWCASE — the freshest, most actively maintained repo in this cluster (public, lint-clean, dependencies current within the week). Good "I keep things maintained" proof point. Main gap: no automated tests — adding even a handful of unit tests would strengthen the story given Brian's other showcases (draft-desk, brian-os) lead with test counts.
