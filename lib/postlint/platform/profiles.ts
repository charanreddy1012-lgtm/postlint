import type { NormalizedRect, TargetPlatform } from "@/lib/postlint/types";

export type PlatformSafeZone = {
  id: string;
  label: string;
  reason: string;
  rect: NormalizedRect;
};

export type PlatformProfile = {
  platform: TargetPlatform;
  label: string;
  zones: PlatformSafeZone[];
};

/**
 * PostLint-owned estimates for common short-form interface regions.
 * They are preflight guides, not official or pixel-perfect platform specifications.
 * Rectangles use normalized 0–1 coordinates relative to the visible video canvas.
 */
export const PLATFORM_PROFILES: Record<TargetPlatform, PlatformProfile> = {
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    zones: [
      {
        id: "top-chrome",
        label: "top navigation area",
        reason: "Estimated space used by top-level navigation and status chrome.",
        rect: { x: 0, y: 0, width: 1, height: 0.1 },
      },
      {
        id: "interaction-rail",
        label: "right-side interaction rail",
        reason: "Estimated space used by avatar and engagement controls.",
        rect: { x: 0.78, y: 0.18, width: 0.22, height: 0.58 },
      },
      {
        id: "lower-interface",
        label: "lower caption and navigation area",
        reason: "Estimated space used by caption, audio, and bottom navigation UI.",
        rect: { x: 0, y: 0.76, width: 1, height: 0.24 },
      },
    ],
  },
  instagram: {
    platform: "instagram",
    label: "Instagram Reels",
    zones: [
      {
        id: "top-chrome",
        label: "top Reels controls",
        reason: "Estimated space used by Reels title and top controls.",
        rect: { x: 0, y: 0, width: 1, height: 0.12 },
      },
      {
        id: "interaction-rail",
        label: "right-side Reels interaction area",
        reason: "Estimated space used by engagement and sharing controls.",
        rect: { x: 0.8, y: 0.2, width: 0.2, height: 0.52 },
      },
      {
        id: "lower-interface",
        label: "lower Reels caption and controls area",
        reason: "Estimated space used by account, caption, audio, and controls.",
        rect: { x: 0, y: 0.72, width: 1, height: 0.28 },
      },
    ],
  },
  youtube: {
    platform: "youtube",
    label: "YouTube Shorts",
    zones: [
      {
        id: "top-chrome",
        label: "top Shorts controls",
        reason: "Estimated space used by top navigation and utility controls.",
        rect: { x: 0, y: 0, width: 1, height: 0.09 },
      },
      {
        id: "interaction-rail",
        label: "right-side Shorts controls",
        reason: "Estimated space used by engagement and sharing controls.",
        rect: { x: 0.8, y: 0.24, width: 0.2, height: 0.54 },
      },
      {
        id: "lower-interface",
        label: "lower Shorts metadata area",
        reason: "Estimated space used by channel, title, audio, and navigation UI.",
        rect: { x: 0, y: 0.78, width: 1, height: 0.22 },
      },
    ],
  },
};

export function platformProfile(platform: TargetPlatform): PlatformProfile {
  return PLATFORM_PROFILES[platform];
}

