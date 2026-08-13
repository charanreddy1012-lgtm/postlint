export const GEMINI_MODEL = "gemini-3.1-flash-lite";

// Inline requests have a 20 MB total limit. This lower raw-audio ceiling leaves
// room for base64 expansion, prompts, and structured response configuration.
export const MAX_INLINE_AUDIO_BYTES = 12 * 1024 * 1024;
