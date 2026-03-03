import type { AnchorTarget, Id, PitchView, Point, TacticalEntity, TacticalLine } from "@/src/types";
import { PITCH_DIMENSIONS } from "@/src/types";

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getPitchViewBox = (pitchView: PitchView): ViewBox =>
  pitchView === "full"
    ? {
        x: 0,
        y: 0,
        width: PITCH_DIMENSIONS.width,
        height: PITCH_DIMENSIONS.height,
      }
    : {
        x: PITCH_DIMENSIONS.width / 2,
        y: 0,
        width: PITCH_DIMENSIONS.width / 2,
        height: PITCH_DIMENSIONS.height,
      };

export const toPitchPoint = (
  event: PointerEvent | React.PointerEvent,
  svg: SVGSVGElement,
): Point => {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svg.getScreenCTM();

  if (!matrix) {
    return { x: 0, y: 0 };
  }

  const transformed = point.matrixTransform(matrix.inverse());

  return {
    x: transformed.x,
    y: transformed.y,
  };
};

export const clampPointToPitch = (point: Point): Point => ({
  x: Math.max(0, Math.min(PITCH_DIMENSIONS.width, point.x)),
  y: Math.max(0, Math.min(PITCH_DIMENSIONS.height, point.y)),
});

export const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const findNearestEntity = (
  point: Point,
  entityPositions: Record<Id, Point>,
  maxDistance = 3.2,
): Id | null => {
  let nearestId: Id | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  Object.entries(entityPositions).forEach(([entityId, entityPoint]) => {
    const nextDistance = distance(point, entityPoint);
    if (nextDistance <= maxDistance && nextDistance < nearestDistance) {
      nearestDistance = nextDistance;
      nearestId = entityId;
    }
  });

  return nearestId;
};

export const resolveAnchor = (
  anchor: AnchorTarget,
  positions: Record<Id, Point>,
  entities: Record<Id, TacticalEntity>,
): Point => {
  if (anchor.kind === "free") {
    return anchor.point;
  }

  const entityPosition = positions[anchor.entityId] ?? entities[anchor.entityId]?.defaultPosition;
  if (!entityPosition) {
    return { x: 0, y: 0 };
  }

  const offset = anchor.offset ?? { x: 0, y: 0 };
  return {
    x: entityPosition.x + offset.x,
    y: entityPosition.y + offset.y,
  };
};

export const buildCubicPath = (
  start: Point,
  line: Pick<TacticalLine, "controlPoint1" | "controlPoint2">,
  end: Point,
): string =>
  `M ${start.x} ${start.y} C ${line.controlPoint1.x} ${line.controlPoint1.y} ${line.controlPoint2.x} ${line.controlPoint2.y} ${end.x} ${end.y}`;

const cubicPoint = (
  start: Point,
  cp1: Point,
  cp2: Point,
  end: Point,
  t: number,
): Point => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: mt2 * mt * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t2 * t * end.x,
    y: mt2 * mt * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t2 * t * end.y,
  };
};

export const buildWavyPath = (
  start: Point,
  line: Pick<TacticalLine, "controlPoint1" | "controlPoint2">,
  end: Point,
): string => {
  const samples = 36;
  const amplitude = 0.55;
  const frequency = Math.PI * 8;
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples;
    return cubicPoint(start, line.controlPoint1, line.controlPoint2, end, t);
  });

  const waved = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(samples, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const normal = {
      x: -tangentY / tangentLength,
      y: tangentX / tangentLength,
    };
    const offset = Math.sin((index / samples) * frequency) * amplitude;

    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    };
  });

  return waved.reduce((acc, point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${acc}${command} ${point.x} ${point.y} `;
  }, "");
};
