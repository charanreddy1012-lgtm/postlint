import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_SAMPLE_FRAMES,
  sampleFrameTimestamps,
} from "../lib/postlint/media/frames";

describe("visual frame sampling", () => {
  it("uses the midpoint for a very short video", () => {
    assert.deepEqual(sampleFrameTimestamps(2), [1]);
  });

  it("distributes samples across the full duration", () => {
    const timestamps = sampleFrameTimestamps(12);
    assert.equal(timestamps.length, 5);
    assert.ok(timestamps[0] <= 0.25);
    assert.ok(timestamps.at(-1)! >= 11.75);
    for (let index = 1; index < timestamps.length; index += 1) {
      assert.ok(timestamps[index] > timestamps[index - 1]);
    }
  });

  it("respects the frame cap for a 90-second video", () => {
    const timestamps = sampleFrameTimestamps(90);
    assert.equal(timestamps.length, MAX_SAMPLE_FRAMES);
  });

  it("returns no samples for invalid duration", () => {
    assert.deepEqual(sampleFrameTimestamps(0), []);
    assert.deepEqual(sampleFrameTimestamps(Number.NaN), []);
  });
});
