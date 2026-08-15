import type { RevisionAction } from "@/lib/postlint/revisions/revision-actions";

export type TimelineMarkerType = "fail" | "warning" | "review";

export type IssueTimelineMarker = {
  id: string;
  sourceLintId: string;
  title: string;
  detail: string;
  timestampStart: number;
  timestampEnd?: number;
  position: number;
  lane: number;
  type: TimelineMarkerType;
  platformZoneId?: string;
};

export const TIMELINE_CLOSE_MARKER_RATIO = 0.045;

export function timelinePosition(timestamp: number, duration: number): number {
  if (!Number.isFinite(timestamp) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, timestamp / duration));
}

function markerType(action: RevisionAction): TimelineMarkerType {
  if (action.type === "review") return "review";
  return action.sourceSeverity === "warning" ? "warning" : "fail";
}

function markerDetail(action: RevisionAction): string {
  if (action.detected && action.expected) {
    return `${action.detected} detected / ${action.expected} required`;
  }
  return action.detected ?? action.expected ?? action.explanation;
}

export function buildIssueTimeline(
  actions: RevisionAction[],
  duration: number,
): IssueTimelineMarker[] {
  const timed = actions
    .filter(
      (action): action is RevisionAction & { timestampStart: number } =>
        action.timestampStart !== undefined &&
        Number.isFinite(action.timestampStart),
    )
    .map((action) => ({
      id: `timeline-${action.id}`,
      sourceLintId: action.sourceLintId,
      title: action.title,
      detail: markerDetail(action),
      timestampStart: action.timestampStart,
      timestampEnd: action.timestampEnd,
      position: timelinePosition(action.timestampStart, duration),
      lane: 0,
      type: markerType(action),
      platformZoneId: action.platformZoneId,
    }))
    .sort(
      (left, right) =>
        left.position - right.position || left.id.localeCompare(right.id),
    );

  const lastPositionByLane: number[] = [];
  return timed.map((marker) => {
    let lane = lastPositionByLane.findIndex(
      (lastPosition) =>
        marker.position - lastPosition >= TIMELINE_CLOSE_MARKER_RATIO,
    );
    if (lane === -1) lane = lastPositionByLane.length;
    lastPositionByLane[lane] = marker.position;
    return { ...marker, lane };
  });
}
