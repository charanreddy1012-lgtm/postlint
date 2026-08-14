# PostLint

PostLint is pre-publication QA for short-form social video—“ESLint for social media.” It combines real local media inspection, Gemini-assisted interpretation and observation, and deterministic compliance checks in one inspectable report.

> **Design principle:** AI interprets; deterministic code verifies.

## Phase 1: local media analysis

The uploaded MP4 or MOV file is inspected with local `ffprobe`. TypeScript rules check:

- Approximate 9:16 vertical format
- Vertical resolution quality
- PostLint’s 90-second MVP duration limit
- Audio stream presence

## Phase 2: transcription and campaign preflight

For videos with audio, local `ffmpeg` creates a compact temporary mono MP3. Gemini (`gemini-3.1-flash-lite`) then provides:

- Timestamped transcript segments
- Structured interpretation of the human campaign brief

Gemini does **not** decide whether the post complies. Deterministic application code verifies objective requirements including:

- Required mentions and phrases
- Promo codes
- Percentage discounts and mismatches
- Sponsorship disclosure tokens
- Explicit prohibited phrases
- Calls to action

Phase 2 preserves visual and unsupported requirements as **Not evaluated** rather than fabricating passes. Phase 3 upgrades only concrete, supported visual requirements to conservative frame analysis. Provider failures preserve successful local media results throughout the pipeline.

## Phase 3: conservative visual evidence

PostLint samples representative frames across the full video with local `ffmpeg`—approximately every three seconds, capped at 16 JPEGs. One batched Gemini request inspects those frames against supported visual requirements such as:

- Show a product or identifiable item
- Display a logo or packaging
- Make a product interface or app screen visible
- Show a creator holding an item
- Display specific visible brand text when it is reasonably clear

Only high-confidence `verified` observations with explicit evidence and an exact sampled-frame timestamp become **PASS · Visual**. Medium/low confidence, ambiguous identification, missing evidence, unsupported subjective direction, and no clear sampled evidence remain non-scoring **Needs review**, **Not verified**, or **Not evaluated** states.

The report uses a browser-side object URL to preview the selected upload without permanent storage. Clicking a lint or transcript timestamp seeks the single HTML5 video player to that moment. Old preview URLs are revoked when the file changes or the page unmounts.

For a preflight with audio and a brief containing supported visual requirements, the normal Gemini budget is three batched calls:

1. Timestamped transcription
2. Campaign brief interpretation
3. Visual observation across all sampled frames and supported requirements

## Phase 4: hackathon hardening

Phase 4 adds deployment portability and report handoff without adding another model call:

- A deterministic **Fix Package** turns existing warnings, failures, and non-passing visual observations into an actionable checklist. Copy buttons appear only when PostLint has concrete replacement text; unsupported and unevaluated requirements never receive invented fixes.
- Report sections identify the important provenance boundary: **Deterministic**, **AI-interpreted**, or **AI-observed**. The core rule remains: AI interprets; code verifies.
- **Load FocusFlow demo** fills a clearly labeled synthetic caption and campaign brief. The presenter must still select a real demo video, which runs through the normal preflight endpoint.
- The processing UI names pipeline stages without claiming a percentage, blocks concurrent submissions from the same form, and continues to revoke browser object URLs.

### Portable ffmpeg and ffprobe

PostLint resolves each media executable independently in this order:

1. `FFMPEG_PATH` or `FFPROBE_PATH`, when explicitly configured
2. The installed `ffmpeg-static` and `@derhuerst/ffprobe-static` package binaries
3. `ffmpeg` or `ffprobe` on the local system `PATH`

All process calls use Node’s `execFile` with an argument array. Binary paths and filenames are never interpolated into a shell command. The static packages download a platform-specific binary during dependency installation, so dependencies must be installed for the same operating system and CPU architecture as the deployment artifact.

Next keeps both binary packages external to the server bundle so their real filesystem paths remain available to the Node.js route handler. A Node.js runtime is required; static-export hosting is not supported by the analysis endpoint.

### Upload configuration

The browser and route handler consume the same upload policy:

| Environment | Default video limit | UI copy |
| --- | ---: | --- |
| Local development | 250 MB | `Local analysis: videos up to 250 MB` |
| Hosted demo (`POSTLINT_HOSTED_DEMO=true`, Vercel, or Netlify) | 4 MB | `Hackathon demo: videos up to 4 MB` |
| Explicit `POSTLINT_MAX_UPLOAD_MB` | Configured value | Configured limit |

The client rejects an oversized selection before uploading. The route also checks the request content length when available and validates the actual `File.size` after multipart parsing. A hosting provider may reject an oversized request before application code runs; the deliberately small demo limit is designed to avoid presenting that infrastructure boundary as an application bug.

The multipart boundary is intentionally isolated in the route handler so a later direct object-storage upload can replace transport without rewriting the lint pipeline. Object storage is not implemented in this phase.

## Phase 5: Platform Safe-Zone Preflight

The selected TikTok, Instagram Reels, or YouTube Shorts target now drives a visible overlay on the video preview before preflight runs. Each profile contains centralized PostLint-owned rectangles for estimated top chrome, right-side interactions, and lower caption/navigation controls. Coordinates are normalized from 0–1 so the overlay scales with the actual visible video canvas.

These are **approximate PostLint UI safety zones**, not official or pixel-perfect platform specifications. Profiles are intentionally easy to tune in `lib/postlint/platform/profiles.ts`.

The optional automatic placement path extends the existing batched visual-frame response; it does not add a Gemini call. When that Phase 3 visual batch already runs, Gemini may return prominent creator-authored communication boxes using `[ymin, xmin, ymax, xmax]` coordinates on a 0–1000 grid. PostLint then:

1. validates the structured element and sampled-frame timestamp;
2. converts the box to normalized 0–1 geometry;
3. ignores medium/low-confidence, malformed, and irrelevant detections;
4. computes exact rectangle intersection in TypeScript;
5. emits a non-blocking platform warning only when at least 20% of the content box overlaps an estimated interface zone.

Warnings remain sampled-frame observations, not guarantees that every frame is safe. If visual analysis is unavailable or no eligible visual batch runs, the platform overlay remains fully usable and the report asks for manual placement review instead of fabricating a result.

> **Design principle:** AI observes; deterministic code verifies geometry.

## Run locally

Requirements: Node.js 20+ and npm. Packaged static media binaries are installed with dependencies; system `ffmpeg` and `ffprobe` remain optional development fallbacks.

```bash
npm install
cp .env.example .env.local
```

Add a Gemini API key to `.env.local`:

```dotenv
GEMINI_API_KEY=your_key_here
```

For the hosted hackathon profile, configure:

```dotenv
POSTLINT_HOSTED_DEMO=true
POSTLINT_MAX_UPLOAD_MB=4
```

`POSTLINT_MAX_UPLOAD_MB` is optional because hosted mode defaults to 4 MB. Set `FFMPEG_PATH` and `FFPROBE_PATH` only when the deployment supplies its own binaries.

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload an MP4 or MOV file within the limit shown in the UI, choose a target, optionally add a caption and campaign brief, and run preflight.

Uploads, extracted audio, sampled frames, and other analysis artifacts are temporary and removed after every request, including failures. `.env.local` is ignored by Git; the API key is read only in server code.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Tests mock the provider boundary and never call Gemini. If Turbopack cannot create its internal CSS worker in a restricted environment, use the equivalent webpack verification:

```bash
npx next build --webpack
```

PostLint checks are product targets, not universal platform rules or guarantees of legal compliance. Gemini-generated transcript timestamps are approximate and displayed at whole-second precision. Visual analysis sees representative sampled frames rather than every video frame, so absence from samples is not treated as definitive failure.
