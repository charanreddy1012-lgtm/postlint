# PostLint

PostLint is pre-publication QA for short-form social video—“ESLint for social media.” This Phase 1 vertical slice analyzes real MP4 and MOV uploads locally with `ffprobe` and returns deterministic PASS, WARNING, and FAIL results.

## What it checks

- Approximate 9:16 vertical format
- Vertical resolution quality
- PostLint’s 90-second MVP duration limit
- Audio stream presence

These are PostLint MVP targets, not universal platform requirements.

## Run locally

Requirements: Node.js, npm, and `ffprobe` available on your `PATH`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload an MP4 or MOV file (up to 250 MB), choose a target, and run preflight.

Uploads are written to a temporary directory only for the duration of analysis and removed afterward, including on failures.

## Verification

```bash
npm run lint
npm run build
```

If Turbopack cannot create its internal CSS worker in a restricted environment, the equivalent webpack verification is:

```bash
npx next build --webpack
```
