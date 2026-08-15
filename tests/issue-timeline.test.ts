import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIssueTimeline,
  timelinePosition,
} from "../lib/postlint/revisions/issue-timeline";
import type { RevisionAction } from "../lib/postlint/revisions/revision-actions";

function action(
  id: string,
  timestampStart?: number,
  type: RevisionAction["type"] = "manual_edit",
): RevisionAction {
  return {
    id: `revision-${id}`,
    sourceLintId: id,
    source: "lint",
    sourceCategory: "campaign",
    sourceSeverity: type === "review" ? "review" : "fail",
    type,
    title: id,
    explanation: `Fix ${id}`,
    timestampStart,
    target: "video",
  };
}

describe("timeline geometry", () => {
  it("maps timestamp zero to 0%", () => {
    assert.equal(timelinePosition(0, 10), 0);
  });

  it("maps the video duration to 100%", () => {
    assert.equal(timelinePosition(10, 10), 1);
  });

  it("maps a midpoint proportionally", () => {
    assert.equal(timelinePosition(5, 10), 0.5);
  });

  it("clamps out-of-range timestamps", () => {
    assert.equal(timelinePosition(-4, 10), 0);
    assert.equal(timelinePosition(14, 10), 1);
  });

  it("handles invalid or zero duration deterministically", () => {
    assert.equal(timelinePosition(1, 0), 0);
    assert.equal(timelinePosition(Number.NaN, 0.1), 0);
  });

  it("excludes untimed actions", () => {
    assert.deepEqual(buildIssueTimeline([action("untimed")], 10), []);
  });

  it("assigns deterministic lanes to close markers", () => {
    const markers = buildIssueTimeline(
      [action("first", 2), action("second", 2.2), action("third", 2.7)],
      10,
    );
    assert.deepEqual(
      markers.map((marker) => marker.lane),
      [0, 1, 0],
    );
  });

  it("preserves review marker semantics", () => {
    const [marker] = buildIssueTimeline([action("review", 1, "review")], 2);
    assert.equal(marker.type, "review");
  });
});
