# PostLint

PostLint is pre-publication QA for short-form social video—“ESLint for social media.” It combines real local media inspection, Gemini-assisted interpretation, and deterministic compliance checks in one inspectable report.

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

Visual and unsupported requirements are preserved as **Not evaluated**. They never become fabricated passes and do not count as warnings or failures. Provider failures also preserve successful local media results.

## Run locally

Requirements: Node.js 20+, npm, `ffprobe`, and `ffmpeg` available on `PATH`.

```bash
npm install
cp .env.example .env.local
```

Add a Gemini API key to `.env.local`:

```dotenv
GEMINI_API_KEY=your_key_here
```

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload an MP4 or MOV file (up to 250 MB), choose a target, optionally add a caption and campaign brief, and run preflight.

Uploads, extracted audio, and other analysis artifacts are temporary and removed after every request, including failures. `.env.local` is ignored by Git; the API key is read only in server code.

## Verification

```bash
npm test
npm run lint
npm run build
```

Tests mock the provider boundary and never call Gemini. If Turbopack cannot create its internal CSS worker in a restricted environment, use the equivalent webpack verification:

```bash
npx next build --webpack
```

PostLint checks are product targets, not universal platform rules or guarantees of legal compliance. Gemini-generated timestamps are approximate and displayed at whole-second precision.
