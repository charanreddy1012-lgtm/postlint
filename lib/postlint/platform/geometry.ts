import type { NormalizedRect } from "@/lib/postlint/types";

const BOUNDS_EPSILON = 1e-9;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidNormalizedRect(value: unknown): value is NormalizedRect {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const rect = value as Record<string, unknown>;
  if (
    !finite(rect.x) ||
    !finite(rect.y) ||
    !finite(rect.width) ||
    !finite(rect.height)
  ) {
    return false;
  }
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= 1 + BOUNDS_EPSILON &&
    rect.y + rect.height <= 1 + BOUNDS_EPSILON
  );
}

export function assertValidNormalizedRect(
  value: unknown,
): asserts value is NormalizedRect {
  if (!isValidNormalizedRect(value)) {
    throw new RangeError("Rectangle must have positive dimensions within normalized 0–1 bounds.");
  }
}

export function normalizeRect(
  rect: NormalizedRect,
  sourceWidth: number,
  sourceHeight: number,
): NormalizedRect {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new RangeError("Source dimensions must be positive finite numbers.");
  }
  const normalized = {
    x: rect.x / sourceWidth,
    y: rect.y / sourceHeight,
    width: rect.width / sourceWidth,
    height: rect.height / sourceHeight,
  };
  assertValidNormalizedRect(normalized);
  return normalized;
}

export function providerBoxToNormalizedRect(
  box: unknown,
): NormalizedRect | null {
  if (
    !Array.isArray(box) ||
    box.length !== 4 ||
    !box.every((coordinate) =>
      Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1000,
    )
  ) {
    return null;
  }
  const [ymin, xmin, ymax, xmax] = box as number[];
  if (ymin >= ymax || xmin >= xmax) return null;
  const rect = {
    x: xmin / 1000,
    y: ymin / 1000,
    width: (xmax - xmin) / 1000,
    height: (ymax - ymin) / 1000,
  };
  return isValidNormalizedRect(rect) ? rect : null;
}

export function rectArea(rect: NormalizedRect): number {
  assertValidNormalizedRect(rect);
  return rect.width * rect.height;
}

export function intersectionRect(
  first: NormalizedRect,
  second: NormalizedRect,
): NormalizedRect | null {
  assertValidNormalizedRect(first);
  assertValidNormalizedRect(second);
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

export function intersectionArea(
  first: NormalizedRect,
  second: NormalizedRect,
): number {
  const intersection = intersectionRect(first, second);
  return intersection ? rectArea(intersection) : 0;
}

export function overlapRatio(
  contentBox: NormalizedRect,
  dangerZone: NormalizedRect,
): number {
  return intersectionArea(contentBox, dangerZone) / rectArea(contentBox);
}

export function rectContainsPoint(
  rect: NormalizedRect,
  point: { x: number; y: number },
): boolean {
  assertValidNormalizedRect(rect);
  if (!finite(point.x) || !finite(point.y)) return false;
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

