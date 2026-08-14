import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertValidNormalizedRect,
  intersectionArea,
  intersectionRect,
  isValidNormalizedRect,
  normalizeRect,
  overlapRatio,
  providerBoxToNormalizedRect,
} from "../lib/postlint/platform/geometry";
import { PLATFORM_PROFILES } from "../lib/postlint/platform/profiles";
import type { TargetPlatform } from "../lib/postlint/types";

describe("platform profiles", () => {
  it("defines a valid profile for every supported target", () => {
    const platforms: TargetPlatform[] = ["tiktok", "instagram", "youtube"];
    assert.deepEqual(Object.keys(PLATFORM_PROFILES).sort(), platforms.sort());
    for (const platform of platforms) {
      assert.equal(PLATFORM_PROFILES[platform].platform, platform);
      assert.ok(PLATFORM_PROFILES[platform].zones.length >= 2);
    }
  });

  it("keeps every zone within normalized bounds with positive dimensions", () => {
    for (const profile of Object.values(PLATFORM_PROFILES)) {
      for (const zone of profile.zones) {
        assert.equal(isValidNormalizedRect(zone.rect), true, zone.id);
        assert.ok(zone.rect.width > 0);
        assert.ok(zone.rect.height > 0);
      }
    }
  });
});

describe("normalized rectangle geometry", () => {
  it("normalizes source-coordinate rectangles", () => {
    assert.deepEqual(
      normalizeRect({ x: 100, y: 200, width: 300, height: 400 }, 1000, 1000),
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    );
  });

  it("returns no intersection for separated rectangles", () => {
    const first = { x: 0, y: 0, width: 0.2, height: 0.2 };
    const second = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 };
    assert.equal(intersectionRect(first, second), null);
    assert.equal(intersectionArea(first, second), 0);
  });

  it("calculates partial intersection and content overlap ratio", () => {
    const content = { x: 0.6, y: 0.4, width: 0.2, height: 0.2 };
    const zone = { x: 0.7, y: 0.3, width: 0.3, height: 0.4 };
    assert.ok(Math.abs(intersectionArea(content, zone) - 0.02) < 1e-12);
    assert.ok(Math.abs(overlapRatio(content, zone) - 0.5) < 1e-12);
  });

  it("calculates full containment", () => {
    const content = { x: 0.82, y: 0.3, width: 0.1, height: 0.1 };
    const zone = { x: 0.8, y: 0.2, width: 0.2, height: 0.5 };
    assert.ok(Math.abs(overlapRatio(content, zone) - 1) < 1e-12);
  });

  it("treats edge touching as zero-area overlap", () => {
    const first = { x: 0, y: 0, width: 0.5, height: 0.5 };
    const second = { x: 0.5, y: 0, width: 0.5, height: 0.5 };
    assert.equal(intersectionArea(first, second), 0);
  });

  it("rejects malformed normalized rectangles", () => {
    for (const rect of [
      { x: -0.1, y: 0, width: 0.2, height: 0.2 },
      { x: 0, y: 0, width: 0, height: 0.2 },
      { x: 0.9, y: 0, width: 0.2, height: 0.2 },
      { x: 0, y: Number.NaN, width: 0.2, height: 0.2 },
    ]) {
      assert.equal(isValidNormalizedRect(rect), false);
      assert.throws(() => assertValidNormalizedRect(rect), RangeError);
    }
  });

  it("converts valid provider boxes and rejects malformed ones", () => {
    assert.deepEqual(providerBoxToNormalizedRect([200, 100, 600, 500]), {
      x: 0.1,
      y: 0.2,
      width: 0.4,
      height: 0.4,
    });
    assert.equal(providerBoxToNormalizedRect([200, 100, 200, 500]), null);
    assert.equal(providerBoxToNormalizedRect([-1, 100, 200, 500]), null);
    assert.equal(providerBoxToNormalizedRect([0, 0, 1001, 500]), null);
    assert.equal(providerBoxToNormalizedRect([0, 0, 500]), null);
  });
});

