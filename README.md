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

Uploads, extracted audio, sampled frames, and other analysis artifacts are temporary and removed after every request, including failures. `.env.local` is ignored by Git; the API key is read only in server code.

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

PostLint checks are product targets, not universal platform rules or guarantees of legal compliance. Gemini-generated transcript timestamps are approximate and displayed at whole-second precision. Visual analysis sees representative sampled frames rather than every video frame, so absence from samples is not treated as definitive failure.
