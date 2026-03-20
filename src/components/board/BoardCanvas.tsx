"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import type {
  AnchorTarget,
  BenchDragPreview,
  ControlPointKey,
  EquipmentEntity,
  Id,
  PitchDimensions,
  Point,
  PlayerEntity,
  TacticalEntity,
  TacticalLine,
} from "@/src/types";
import { PITCH_PRESET_DIMENSIONS } from "@/src/types";

import { PitchLayer } from "./PitchLayer";
import {
  buildCubicPath,
  buildWavyPath,
  clampPointToPitch,
  distance,
  findNearestEntity,
  getPitchViewBox,
  resolveAnchor,
} from "./utils";

interface BoardCanvasProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  benchDrag?: BenchDragPreview | null;
}

interface DraftLine {
  tool: "pass" | "run" | "dribble";
  start: AnchorTarget;
  end: AnchorTarget;
}

interface EditingControlPoint {
  lineId: Id;
  key: ControlPointKey;
}

interface DraftPolygon {
  start: Point;
  end: Point;
}

interface LassoRect {
  start: Point;
  end: Point;
}

interface MultiDragState {
  entityIds: Id[];
  startPoint: Point;
  currentPoint: Point;
  initialPositions: Record<Id, Point>;
}

interface LinePointerDownState {
  lineId: Id;
  startClientX: number;
  startClientY: number;
}

interface DraggingLineState {
  lineId: Id;
  startPoint: Point;
  currentPoint: Point;
  snapshot: TacticalLine;
  resolvedStart: Point;
  resolvedEnd: Point;
}

const isLineTool = (tool: string): tool is DraftLine["tool"] =>
  tool === "pass" || tool === "run" || tool === "dribble";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;

const lerpPoint = (from: Point, to: Point, t: number): Point => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
});

const offsetPoint = (point: Point, deltaX: number, deltaY: number): Point => ({
  x: point.x + deltaX,
  y: point.y + deltaY,
});

const cubicPointAt = (
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point,
  t: number,
): Point => {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * start.x +
      3 * mt * mt * t * controlPoint1.x +
      3 * mt * t * t * controlPoint2.x +
      t * t * t * end.x,
    y:
      mt * mt * mt * start.y +
      3 * mt * mt * t * controlPoint1.y +
      3 * mt * t * t * controlPoint2.y +
      t * t * t * end.y,
  };
};

const buildDraggedLine = (draggingLine: DraggingLineState): TacticalLine => {
  const deltaX = draggingLine.currentPoint.x - draggingLine.startPoint.x;
  const deltaY = draggingLine.currentPoint.y - draggingLine.startPoint.y;

  return {
    ...draggingLine.snapshot,
    start: {
      kind: "free",
      point: offsetPoint(draggingLine.resolvedStart, deltaX, deltaY),
    },
    end: {
      kind: "free",
      point: offsetPoint(draggingLine.resolvedEnd, deltaX, deltaY),
    },
    controlPoint1: offsetPoint(
      draggingLine.snapshot.controlPoint1,
      deltaX,
      deltaY,
    ),
    controlPoint2: offsetPoint(
      draggingLine.snapshot.controlPoint2,
      deltaX,
      deltaY,
    ),
  };
};

const isPlayerEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

const isEquipmentEntity = (
  entity: TacticalEntity,
): entity is EquipmentEntity =>
  entity.kind === "ball" ||
  entity.kind === "cone" ||
  entity.kind === "mannequin";

const toSvgTextAnchor = (
  align: "left" | "center" | "right",
): "start" | "middle" | "end" => {
  if (align === "left") {
    return "start";
  }

  if (align === "right") {
    return "end";
  }

  return "middle";
};

const renderEntityShape = (
  entity: TacticalEntity,
  textTransform?: string,
): React.ReactNode => {
  const stroke = "rgba(255,255,255,0.7)";
  const strokeWidth = 0.24;

  if (entity.kind === "ball") {
    const ballGradientId = `ball-gradient-${entity.id}`;
    const ballShadowId = `ball-shadow-${entity.id}`;
    return (
      <>
        <defs>
          <radialGradient id={ballGradientId} cx="36%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="52%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>
          <radialGradient id={ballShadowId} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(15,23,42,0.22)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </radialGradient>
        </defs>
        <ellipse
          cx={entity.radius * 0.12}
          cy={entity.radius * 0.96}
          rx={entity.radius * 0.96}
          ry={entity.radius * 0.42}
          fill={`url(#${ballShadowId})`}
        />
        <circle
          r={entity.radius}
          fill={`url(#${ballGradientId})`}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <path
          d={`M 0 ${-entity.radius * 0.56} L ${entity.radius * 0.4} ${-entity.radius * 0.22} L ${entity.radius * 0.26} ${entity.radius * 0.26} L ${-entity.radius * 0.26} ${entity.radius * 0.26} L ${-entity.radius * 0.4} ${-entity.radius * 0.22} Z`}
          fill="rgba(15,23,42,0.72)"
        />
        <path
          d={`M ${-entity.radius * 0.82} ${-entity.radius * 0.08} Q ${-entity.radius * 0.38} ${-entity.radius * 0.62}, 0 ${-entity.radius * 0.56} Q ${entity.radius * 0.38} ${-entity.radius * 0.62}, ${entity.radius * 0.82} ${-entity.radius * 0.08}`}
          fill="none"
          stroke="rgba(30,41,59,0.28)"
          strokeWidth={0.18}
        />
        <path
          d={`M 0 ${-entity.radius * 0.56} C ${entity.radius * 0.58} ${-entity.radius * 0.12}, ${entity.radius * 0.44} ${entity.radius * 0.62}, 0 ${entity.radius * 0.84}`}
          fill="none"
          stroke="rgba(30,41,59,0.22)"
          strokeWidth={0.17}
        />
        <path
          d={`M ${-entity.radius * 0.84} 0 C ${-entity.radius * 0.46} ${-entity.radius * 0.44}, ${entity.radius * 0.46} ${-entity.radius * 0.44}, ${entity.radius * 0.84} 0`}
          fill="none"
          stroke="rgba(30,41,59,0.2)"
          strokeWidth={0.18}
        />
        <circle
          cx={-entity.radius * 0.3}
          cy={-entity.radius * 0.34}
          r={entity.radius * 0.22}
          fill="rgba(255,255,255,0.42)"
        />
      </>
    );
  }

  if (entity.kind === "cone") {
    const r = entity.radius;
    const coneGradientId = `cone-gradient-${entity.id}`;
    const coneBaseId = `cone-base-${entity.id}`;
    return (
      <>
        <defs>
          <linearGradient
            id={coneGradientId}
            x1="10%"
            y1="0%"
            x2="90%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="38%" stopColor={entity.color} />
            <stop offset="100%" stopColor="#9a3412" />
          </linearGradient>
          <linearGradient id={coneBaseId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
        </defs>
        <ellipse
          cx={0}
          cy={r * 1.08}
          rx={r * 0.96}
          ry={r * 0.24}
          fill="rgba(15,23,42,0.18)"
        />
        <path
          d={`M 0 ${-r * 1.12} L ${r * 0.92} ${r * 0.78} Q ${r * 0.7} ${r * 1.02}, 0 ${r * 1.08} Q ${-r * 0.7} ${r * 1.02}, ${-r * 0.92} ${r * 0.78} Z`}
          fill={`url(#${coneGradientId})`}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <ellipse
          cx={0}
          cy={r * 0.94}
          rx={r * 1.06}
          ry={r * 0.18}
          fill={`url(#${coneBaseId})`}
          opacity={0.94}
        />
        <path
          d={`M ${-r * 0.54} ${r * 0.08} H ${r * 0.54}`}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={0.18}
          strokeLinecap="round"
        />
        <path
          d={`M ${-r * 0.44} ${-r * 0.22} H ${r * 0.44}`}
          stroke="rgba(255,255,255,0.34)"
          strokeWidth={0.15}
          strokeLinecap="round"
        />
        <path
          d={`M ${-r * 0.16} ${-r * 0.66} Q 0 ${-r * 0.88}, ${r * 0.18} ${-r * 0.4}`}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={0.14}
          fill="none"
        />
      </>
    );
  }

  if (entity.kind === "mannequin") {
    const width = entity.radius * 1.58;
    const height = entity.radius * 2.82;
    const mannequinGradientId = `mannequin-gradient-${entity.id}`;
    return (
      <>
        <defs>
          <linearGradient
            id={mannequinGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="42%" stopColor={entity.color} />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>

        <ellipse
          cx={0}
          cy={height / 2 + entity.radius * 0.24}
          rx={width * 0.5}
          ry={entity.radius * 0.24}
          fill="rgba(15,23,42,0.18)"
        />

        <circle
          cx={0}
          cy={-height * 0.62}
          r={entity.radius * 0.34}
          fill="#e2e8f0"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />

        <rect
          x={-width / 2}
          y={-height * 0.44}
          width={width}
          height={height * 0.88}
          rx={0.5}
          fill={`url(#${mannequinGradientId})`}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />

        <line
          x1={-width * 0.34}
          y1={-height * 0.1}
          x2={width * 0.34}
          y2={-height * 0.1}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={0.14}
        />
        <line
          x1={-width * 0.34}
          y1={height * 0.1}
          x2={width * 0.34}
          y2={height * 0.1}
          stroke="rgba(255,255,255,0.24)"
          strokeWidth={0.14}
        />
        <line
          x1={0}
          y1={height * 0.36}
          x2={0}
          y2={height * 0.58}
          stroke="#475569"
          strokeWidth={0.18}
          strokeLinecap="round"
        />
        <line
          x1={-width * 0.4}
          y1={height * 0.56}
          x2={width * 0.4}
          y2={height * 0.56}
          stroke="#64748b"
          strokeWidth={0.2}
          strokeLinecap="round"
        />
        <path
          d={`M ${-width * 0.18} ${-height * 0.26} L 0 ${-height * 0.4} L ${width * 0.18} ${-height * 0.26}`}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={0.13}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  }

  const jerseyPatternId = `jersey-pattern-${entity.id}`;
  const avatarClipId = `avatar-clip-${entity.id}`;
  const jerseyStyle = isPlayerEntity(entity)
    ? (entity.jerseyStyle ?? "solid")
    : "solid";
  const jerseyFill =
    jerseyStyle === "solid"
      ? entity.color
      : jerseyStyle === "striped"
        ? `url(#${jerseyPatternId})`
        : `url(#${jerseyPatternId})`;

  const isGoalkeeper = entity.kind === "goalkeeper";
  return (
    <>
      {jerseyStyle !== "solid" && (
        <defs>
          <pattern
            id={jerseyPatternId}
            width={jerseyStyle === "striped" ? 0.85 : 1.2}
            height={jerseyStyle === "striped" ? 0.85 : 1.2}
            patternUnits="userSpaceOnUse"
          >
            <rect width="100%" height="100%" fill={entity.color} />
            {jerseyStyle === "striped" ? (
              <rect width="0.45" height="100%" fill="rgba(255,255,255,0.32)" />
            ) : (
              <rect
                x="0.08"
                y="0.08"
                width="1.04"
                height="1.04"
                fill="none"
                stroke="rgba(255,255,255,0.34)"
                strokeWidth="0.12"
              />
            )}
          </pattern>
        </defs>
      )}

      {isGoalkeeper ? (
        <rect
          x={-entity.radius}
          y={-entity.radius}
          width={entity.radius * 2}
          height={entity.radius * 2}
          rx={0.45}
          fill={jerseyFill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <circle
          r={entity.radius}
          fill={jerseyFill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      {isPlayerEntity(entity) && entity.avatarUrl && (
        <>
          <defs>
            <clipPath id={avatarClipId}>
              <circle cx={0} cy={0} r={entity.radius * 0.58} />
            </clipPath>
          </defs>
          <image
            href={entity.avatarUrl}
            x={-entity.radius * 0.58}
            y={-entity.radius * 0.58}
            width={entity.radius * 1.16}
            height={entity.radius * 1.16}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${avatarClipId})`}
            className="pointer-events-none"
          />
        </>
      )}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={2.02}
        fontWeight={700}
        fill="#f8fafc"
        transform={textTransform}
        className="pointer-events-none"
        style={{ userSelect: "none" }}
      >
        {"number" in entity ? entity.number : ""}
      </text>
    </>
  );
};

interface CanvasActionButtonProps {
  x: number;
  y: number;
  label: string;
  tone?: "neutral" | "danger";
  readableTextTransform?: string;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}

function CanvasActionButton({
  x,
  y,
  label,
  tone = "neutral",
  readableTextTransform,
  onPointerDown,
}: CanvasActionButtonProps) {
  const isDanger = tone === "danger";

  return (
    <g className="cursor-pointer" onPointerDown={onPointerDown}>
      <circle
        cx={x}
        cy={y}
        r={1.18}
        fill="rgba(255,255,255,0.92)"
        stroke={isDanger ? "rgba(244,63,94,0.28)" : "rgba(15,23,42,0.12)"}
        strokeWidth={0.12}
      />
      <g transform={`translate(${x} ${y})`}>
        <g transform={readableTextTransform}>
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={0.78}
            fontWeight={700}
            fill={isDanger ? "#e11d48" : "#0f172a"}
          >
            {label}
          </text>
        </g>
      </g>
    </g>
  );
}

export function BoardCanvas({ svgRef, benchDrag }: BoardCanvasProps) {
  const boardLayerRef = useRef<SVGGElement | null>(null);
  const settings = useTacticalBoardStore((state) => state.settings);
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const isPlaying = useTacticalBoardStore((state) => state.playback.isPlaying);
  const fromFrameId = useTacticalBoardStore(
    (state) => state.playback.fromFrameId,
  );
  const toFrameId = useTacticalBoardStore((state) => state.playback.toFrameId);
  const playbackProgress = useTacticalBoardStore(
    (state) => state.playback.progress,
  );
  const activeTool = useTacticalBoardStore((state) => state.activeTool);
  const selection = useTacticalBoardStore((state) => state.selection);

  const setSelection = useTacticalBoardStore((state) => state.setSelection);
  const clearSelection = useTacticalBoardStore((state) => state.clearSelection);
  const moveEntity = useTacticalBoardStore((state) => state.moveEntity);
  const rotateEntity = useTacticalBoardStore((state) => state.rotateEntity);
  const removeEntity = useTacticalBoardStore((state) => state.removeEntity);
  const addLine = useTacticalBoardStore((state) => state.addLine);
  const addFreehand = useTacticalBoardStore((state) => state.addFreehand);
  const addPolygon = useTacticalBoardStore((state) => state.addPolygon);
  const addText = useTacticalBoardStore((state) => state.addText);
  const updateText = useTacticalBoardStore((state) => state.updateText);
  const updateLine = useTacticalBoardStore((state) => state.updateLine);
  const removeOverlayById = useTacticalBoardStore(
    (state) => state.removeOverlayById,
  );
  const updateLineControlPoint = useTacticalBoardStore(
    (state) => state.updateLineControlPoint,
  );

  const [draggingEntityId, setDraggingEntityId] = useState<Id | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [draftLine, setDraftLine] = useState<DraftLine | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[] | null>(null);
  const [draftPolygon, setDraftPolygon] = useState<DraftPolygon | null>(null);
  const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);
  const [multiDrag, setMultiDrag] = useState<MultiDragState | null>(null);
  const [editingControlPoint, setEditingControlPoint] =
    useState<EditingControlPoint | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<Id | null>(null);
  const [editingTextId, setEditingTextId] = useState<Id | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [textPointerDown, setTextPointerDown] = useState<{
    textId: Id;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<Id | null>(null);
  const [dragTextPoint, setDragTextPoint] = useState<Point | null>(null);
  const [linePointerDown, setLinePointerDown] =
    useState<LinePointerDownState | null>(null);
  const [draggingLine, setDraggingLine] = useState<DraggingLineState | null>(
    null,
  );

  const isPortraitRotated = settings.orientation === "portrait-rotated";
  const pitchDimensions: PitchDimensions =
    PITCH_PRESET_DIMENSIONS[settings.pitchPreset] ??
    PITCH_PRESET_DIMENSIONS["football-105x68"];
  const readableTextTransform = isPortraitRotated
    ? "scale(-1 1) rotate(-90)"
    : undefined;
  const viewBox = useMemo(() => {
    if (isPortraitRotated) {
      return {
        x: 0,
        y: 0,
        width: pitchDimensions.height,
        height: pitchDimensions.width,
      };
    }

    if (settings.mode === "training") {
      return {
        x: 0,
        y: 0,
        width: pitchDimensions.width,
        height: pitchDimensions.height,
      };
    }

    return getPitchViewBox(settings.pitchView, pitchDimensions);
  }, [isPortraitRotated, pitchDimensions, settings.mode, settings.pitchView]);
  const boardTransform = isPortraitRotated
    ? `translate(${pitchDimensions.height} ${pitchDimensions.width}) rotate(90) scale(-1 1)`
    : undefined;
  const entityEntries = useMemo(() => Object.values(entities), [entities]);
  const filteredEntityEntries = useMemo(() => {
    if (settings.mode !== "training") {
      return entityEntries;
    }

    return entityEntries.filter((entity) => {
      if (entity.kind === "player" || entity.kind === "goalkeeper") {
        return settings.training.visibleTeams.includes(entity.team);
      }

      return true;
    });
  }, [entityEntries, settings.mode, settings.training.visibleTeams]);
  const renderable = useMemo(() => {
    const activeFrame =
      frames.find((frame) => frame.id === activeFrameId) ?? frames[0];

    if (!activeFrame) {
      return {
        positions: {} as Record<Id, Point>,
        rotations: {} as Record<Id, number>,
        visibility: {} as Record<Id, boolean>,
        overlays: {
          lines: [] as TacticalLine[],
          freehand: [],
          polygons: [],
          texts: [],
          rulers: [],
        },
      };
    }

    if (isPlaying && fromFrameId && toFrameId) {
      const fromFrame = frames.find((frame) => frame.id === fromFrameId);
      const toFrame = frames.find((frame) => frame.id === toFrameId);

      if (fromFrame && toFrame) {
        const progress = clamp(playbackProgress, 0, 1);
        const positions: Record<Id, Point> = {};
        const rotations: Record<Id, number> = {};
        const visibility: Record<Id, boolean> = {};

        Object.values(entities).forEach((entity) => {
          const fromPoint =
            fromFrame.entityStates[entity.id]?.position ??
            entity.defaultPosition;
          const toPoint =
            toFrame.entityStates[entity.id]?.position ?? fromPoint;
          positions[entity.id] = lerpPoint(fromPoint, toPoint, progress);
          rotations[entity.id] =
            fromFrame.entityStates[entity.id]?.rotation ?? entity.rotation ?? 0;
          visibility[entity.id] =
            fromFrame.entityStates[entity.id]?.visible ?? true;
        });

        return {
          positions,
          rotations,
          visibility,
          overlays: fromFrame.overlays,
        };
      }
    }

    const positions: Record<Id, Point> = {};
    const rotations: Record<Id, number> = {};
    const visibility: Record<Id, boolean> = {};
    Object.values(entities).forEach((entity) => {
      positions[entity.id] =
        activeFrame.entityStates[entity.id]?.position ?? entity.defaultPosition;
      rotations[entity.id] =
        activeFrame.entityStates[entity.id]?.rotation ?? entity.rotation ?? 0;
      visibility[entity.id] =
        activeFrame.entityStates[entity.id]?.visible ?? true;
    });

    return {
      positions,
      rotations,
      visibility,
      overlays: activeFrame.overlays,
    };
  }, [
    activeFrameId,
    entities,
    frames,
    fromFrameId,
    isPlaying,
    playbackProgress,
    toFrameId,
  ]);

  const toBoardPoint = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    const boardLayer = boardLayerRef.current;
    if (!svg || !boardLayer) {
      return { x: 0, y: 0 };
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = boardLayer.getScreenCTM();
    if (!matrix) {
      return { x: 0, y: 0 };
    }

    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const toBoardPointFromClient = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    const boardLayer = boardLayerRef.current;
    if (!svg || !boardLayer) {
      return { x: 0, y: 0 };
    }

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = boardLayer.getScreenCTM();
    if (!matrix) {
      return { x: 0, y: 0 };
    }

    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const getRectBounds = (start: Point, end: Point) => ({
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y),
  });

  const visiblePositions = useMemo(() => {
    const allowedEntityIds = new Set(
      filteredEntityEntries.map((entity) => entity.id),
    );
    const next: Record<Id, Point> = {};
    Object.entries(renderable.positions).forEach(([entityId, point]) => {
      if (
        (renderable.visibility[entityId] ?? true) &&
        allowedEntityIds.has(entityId)
      ) {
        next[entityId] = point;
      }
    });
    return next;
  }, [filteredEntityEntries, renderable.positions, renderable.visibility]);

  const toAnchor = (point: Point): AnchorTarget => {
    const clamped = clampPointToPitch(point, pitchDimensions);
    if (!settings.snapToEntities) {
      return { kind: "free", point: clamped };
    }

    const nearest = findNearestEntity(clamped, visiblePositions, 3.3);
    if (nearest) {
      return { kind: "entity", entityId: nearest };
    }

    return { kind: "free", point: clamped };
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const selectedEntity = selection.activeEntityId
        ? entities[selection.activeEntityId]
        : null;

      if (selectedEntity && isEquipmentEntity(selectedEntity)) {
        event.preventDefault();
        removeEntity(selectedEntity.id);
        return;
      }

      if (selection.activeOverlayId) {
        event.preventDefault();
        removeOverlayById(selection.activeOverlayId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    entities,
    removeEntity,
    removeOverlayById,
    selection.activeEntityId,
    selection.activeOverlayId,
  ]);

  const startLineDraft = (
    tool: DraftLine["tool"],
    startAnchor: AnchorTarget,
  ) => {
    setDraftLine({
      tool,
      start: startAnchor,
      end: startAnchor,
    });
    setSelection({
      entityIds: [],
      overlayIds: [],
      activeEntityId: null,
      activeOverlayId: null,
    });
  };

  const finalizeLineDraft = () => {
    if (!draftLine) {
      return;
    }

    const startPoint = resolveAnchor(
      draftLine.start,
      renderable.positions,
      entities,
    );
    const endPoint = resolveAnchor(
      draftLine.end,
      renderable.positions,
      entities,
    );

    if (distance(startPoint, endPoint) > 1.2) {
      addLine({
        type: draftLine.tool,
        start: draftLine.start,
        end: draftLine.end,
      });
    }

    setDraftLine(null);
  };

  const handleBoardPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const point = clampPointToPitch(toBoardPoint(event), pitchDimensions);

    if (isLineTool(activeTool)) {
      startLineDraft(activeTool, toAnchor(point));
      return;
    }

    if (activeTool === "freehand") {
      setFreehandPoints([point]);
      return;
    }

    if (activeTool === "polygon") {
      setDraftPolygon({ start: point, end: point });
      return;
    }

    if (activeTool === "text") {
      const typedText = window.prompt("Digite o texto", "Anotação");
      if (typedText === null) {
        return;
      }

      const sanitizedText = typedText.trim();
      if (!sanitizedText) {
        return;
      }

      addText({
        position: point,
        text: sanitizedText,
        color: settings.pitchStyle === "minimal-light" ? "#0f172a" : "#f8fafc",
        fontSize: 2,
        align: "left",
      });
      return;
    }

    if (activeTool === "lasso") {
      setLassoRect({ start: point, end: point });
      setSelection({
        entityIds: [],
        activeEntityId: null,
        overlayIds: [],
        activeOverlayId: null,
      });
      return;
    }

    clearSelection();
  };

  const handleEntityPointerDown = (
    event: React.PointerEvent<SVGGElement>,
    entityId: Id,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    if (isLineTool(activeTool)) {
      startLineDraft(activeTool, { kind: "entity", entityId });
      return;
    }

    if (activeTool !== "select") {
      return;
    }

    const pointerPoint = clampPointToPitch(
      toBoardPointFromClient(event.clientX, event.clientY),
      pitchDimensions,
    );

    if (
      selection.entityIds.length > 1 &&
      selection.entityIds.includes(entityId)
    ) {
      const initialPositions: Record<Id, Point> = {};
      selection.entityIds.forEach((id) => {
        const basePosition = renderable.positions[id] ??
          entities[id]?.defaultPosition ?? { x: 0, y: 0 };
        initialPositions[id] = basePosition;
      });
      setMultiDrag({
        entityIds: selection.entityIds,
        startPoint: pointerPoint,
        currentPoint: pointerPoint,
        initialPositions,
      });
      svg.setPointerCapture(event.pointerId);
      return;
    }

    const initialPosition =
      renderable.positions[entityId] ?? entities[entityId]?.defaultPosition;
    setSelection({
      entityIds: [entityId],
      activeEntityId: entityId,
      overlayIds: [],
      activeOverlayId: null,
    });
    setDraggingEntityId(entityId);
    setDragPoint(initialPosition ?? null);
    svg.setPointerCapture(event.pointerId);
  };

  const handleControlPointPointerDown = (
    event: React.PointerEvent<SVGCircleElement>,
    lineId: Id,
    key: ControlPointKey,
  ) => {
    event.stopPropagation();
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    setEditingControlPoint({ lineId, key });
    svg.setPointerCapture(event.pointerId);
  };

  const handleTextPointerDown = (
    event: React.PointerEvent<SVGGElement>,
    textId: Id,
  ) => {
    event.stopPropagation();
    event.preventDefault();

    if (activeTool !== "select") {
      return;
    }

    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    setSelection({
      overlayIds: [textId],
      activeOverlayId: textId,
      entityIds: [],
      activeEntityId: null,
    });

    setTextPointerDown({
      textId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
    setDraggingTextId(null);
    setDragTextPoint(null);

    svg.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const point = clampPointToPitch(toBoardPoint(event), pitchDimensions);

    if (multiDrag) {
      setMultiDrag((current) =>
        current
          ? {
              ...current,
              currentPoint: point,
            }
          : null,
      );
      return;
    }

    if (draggingEntityId) {
      setDragPoint(point);
      return;
    }

    if (textPointerDown) {
      if (!draggingTextId) {
        const moveDistance = distance(
          { x: textPointerDown.startClientX, y: textPointerDown.startClientY },
          { x: event.clientX, y: event.clientY },
        );
        if (moveDistance >= 4) {
          setDraggingTextId(textPointerDown.textId);
          setDragTextPoint(point);
        }
      } else {
        setDragTextPoint(point);
      }
      return;
    }

    if (linePointerDown) {
      if (!draggingLine) {
        const moveDistance = distance(
          { x: linePointerDown.startClientX, y: linePointerDown.startClientY },
          { x: event.clientX, y: event.clientY },
        );

        if (moveDistance >= 4) {
          const line = (renderable.overlays?.lines ?? []).find(
            (item) => item.id === linePointerDown.lineId,
          );

          if (!line) {
            setLinePointerDown(null);
            return;
          }

          setDraggingLine({
            lineId: line.id,
            startPoint: point,
            currentPoint: point,
            snapshot: line,
            resolvedStart: resolveAnchor(line.start, renderable.positions, entities),
            resolvedEnd: resolveAnchor(line.end, renderable.positions, entities),
          });
        }
      } else {
        setDraggingLine((current) =>
          current
            ? {
                ...current,
                currentPoint: point,
              }
            : null,
        );
      }
      return;
    }

    if (editingControlPoint) {
      updateLineControlPoint(
        editingControlPoint.lineId,
        editingControlPoint.key,
        point,
      );
      return;
    }

    if (draftLine) {
      setDraftLine((current) =>
        current
          ? {
              ...current,
              end: toAnchor(point),
            }
          : null,
      );
      return;
    }

    if (freehandPoints) {
      setFreehandPoints((current) => {
        if (!current || current.length === 0) {
          return [point];
        }

        const last = current[current.length - 1];
        if (distance(last, point) < 0.18) {
          return current;
        }

        return [...current, point];
      });
      return;
    }

    if (draftPolygon) {
      setDraftPolygon((current) =>
        current
          ? {
              ...current,
              end: point,
            }
          : null,
      );
      return;
    }

    if (lassoRect) {
      setLassoRect((current) =>
        current
          ? {
              ...current,
              end: point,
            }
          : null,
      );
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (svg && svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }

    if (draggingEntityId && dragPoint) {
      const currentPoint =
        renderable.positions[draggingEntityId] ??
        entities[draggingEntityId]?.defaultPosition;
      if (
        !currentPoint ||
        currentPoint.x !== dragPoint.x ||
        currentPoint.y !== dragPoint.y
      ) {
        moveEntity(draggingEntityId, dragPoint);
      }
    }

    if (textPointerDown) {
      if (draggingTextId && dragTextPoint) {
        updateText(draggingTextId, { position: dragTextPoint });
      } else {
        const targetText = (renderable.overlays?.texts ?? []).find(
          (textItem) => textItem.id === textPointerDown.textId,
        );
        if (targetText) {
          setEditingTextId(targetText.id);
          setEditingTextValue(targetText.text);
        }
      }

      setTextPointerDown(null);
      setDraggingTextId(null);
      setDragTextPoint(null);
      return;
    }

    if (linePointerDown) {
      if (draggingLine) {
        const nextLine = buildDraggedLine(draggingLine);
        updateLine(nextLine.id, {
          start: nextLine.start,
          end: nextLine.end,
          controlPoint1: nextLine.controlPoint1,
          controlPoint2: nextLine.controlPoint2,
        });
      }

      setLinePointerDown(null);
      setDraggingLine(null);
      return;
    }

    if (multiDrag) {
      const deltaX = multiDrag.currentPoint.x - multiDrag.startPoint.x;
      const deltaY = multiDrag.currentPoint.y - multiDrag.startPoint.y;

      multiDrag.entityIds.forEach((entityId) => {
        const initial = multiDrag.initialPositions[entityId];
        if (!initial) {
          return;
        }

        const next = clampPointToPitch(
          {
            x: initial.x + deltaX,
            y: initial.y + deltaY,
          },
          pitchDimensions,
        );
        moveEntity(entityId, next);
      });
    }

    setDraggingEntityId(null);
    setDragPoint(null);
    setMultiDrag(null);

    if (editingControlPoint) {
      setEditingControlPoint(null);
    }

    if (draftLine) {
      finalizeLineDraft();
    }

    if (freehandPoints && freehandPoints.length > 1) {
      addFreehand({
        points: freehandPoints,
        color: "#f8fafc",
        width: 0.42,
        opacity: 0.95,
      });
    }
    setFreehandPoints(null);

    if (draftPolygon) {
      const bounds = getRectBounds(draftPolygon.start, draftPolygon.end);
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;
      if (width > 0.8 && height > 0.8) {
        addPolygon({
          points: [
            { x: bounds.left, y: bounds.top },
            { x: bounds.right, y: bounds.top },
            { x: bounds.right, y: bounds.bottom },
            { x: bounds.left, y: bounds.bottom },
          ],
          stroke: "#22c55e",
          strokeWidth: 0.34,
          fill: "#22c55e",
          opacity: 0.22,
        });
      }
    }
    setDraftPolygon(null);

    if (lassoRect) {
      const bounds = getRectBounds(lassoRect.start, lassoRect.end);
      const ids = filteredEntityEntries
        .filter((entity) => renderable.visibility[entity.id] ?? true)
        .filter((entity) => {
          const point =
            renderable.positions[entity.id] ?? entity.defaultPosition;
          return (
            point.x >= bounds.left &&
            point.x <= bounds.right &&
            point.y >= bounds.top &&
            point.y <= bounds.bottom
          );
        })
        .map((entity) => entity.id);

      setSelection({
        entityIds: ids,
        activeEntityId: ids[0] ?? null,
        overlayIds: [],
        activeOverlayId: null,
      });
    }
    setLassoRect(null);
  };

  const getRenderedEntityPosition = (entity: TacticalEntity): Point => {
    if (multiDrag && multiDrag.initialPositions[entity.id]) {
      const deltaX = multiDrag.currentPoint.x - multiDrag.startPoint.x;
      const deltaY = multiDrag.currentPoint.y - multiDrag.startPoint.y;
      const base = multiDrag.initialPositions[entity.id];
      return clampPointToPitch(
        {
          x: base.x + deltaX,
          y: base.y + deltaY,
        },
        pitchDimensions,
      );
    }

    const base = renderable.positions[entity.id] ?? entity.defaultPosition;
    if (draggingEntityId === entity.id && dragPoint) {
      return dragPoint;
    }

    return base;
  };

  const getRenderedEntityRotation = (entity: TacticalEntity): number =>
    renderable.rotations[entity.id] ?? entity.rotation ?? 0;

  const selectedLine =
    renderable.overlays?.lines?.find(
      (line) => line.id === selection.activeOverlayId,
    ) ?? null;
  const renderedSelectedLine =
    selectedLine && draggingLine?.lineId === selectedLine.id
      ? buildDraggedLine(draggingLine)
      : selectedLine;
  const selectedEntity = selection.activeEntityId
    ? entities[selection.activeEntityId]
    : null;
  const selectedEquipment =
    selectedEntity && isEquipmentEntity(selectedEntity) ? selectedEntity : null;
  const selectedEquipmentVisible =
    selectedEquipment &&
    (renderable.visibility[selectedEquipment.id] ?? true) &&
    filteredEntityEntries.some((entity) => entity.id === selectedEquipment.id)
      ? selectedEquipment
      : null;
  const selectedEquipmentPosition = selectedEquipmentVisible
    ? getRenderedEntityPosition(selectedEquipmentVisible)
    : null;
  const selectedText =
    renderable.overlays?.texts?.find(
      (textItem) => textItem.id === selection.activeOverlayId,
    ) ?? null;
  const selectedTextPosition =
    selectedText && draggingTextId === selectedText.id && dragTextPoint
      ? dragTextPoint
      : selectedText?.position ?? null;
  const selectedTextActionPoint = selectedTextPosition
    ? {
        x: selectedTextPosition.x,
        y: selectedTextPosition.y - 3.3,
      }
    : null;
  const selectedLineActionPoint = renderedSelectedLine
    ? cubicPointAt(
        resolveAnchor(
          renderedSelectedLine.start,
          renderable.positions,
          entities,
        ),
        renderedSelectedLine.controlPoint1,
        renderedSelectedLine.controlPoint2,
        resolveAnchor(renderedSelectedLine.end, renderable.positions, entities),
        0.5,
      )
    : null;
  const draggedBenchEntity = benchDrag
    ? entities[benchDrag.playerId]
    : undefined;
  const draggedBenchPlayer: PlayerEntity | null =
    draggedBenchEntity && isPlayerEntity(draggedBenchEntity)
      ? draggedBenchEntity
      : null;

  const commitInlineTextEdit = (textId: Id) => {
    const sanitizedText = editingTextValue.trim();
    if (sanitizedText) {
      updateText(textId, { text: sanitizedText });
    }

    setEditingTextId(null);
    setEditingTextValue("");
  };

  const cancelInlineTextEdit = () => {
    setEditingTextId(null);
    setEditingTextValue("");
  };

  return (
    <div className="h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="none"
        className="block h-full w-full touch-none select-none"
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <marker
            id="motus-arrow"
            markerWidth="5"
            markerHeight="5"
            refX="4"
            refY="2.5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L5,2.5 L0,5 Z" fill="context-stroke" />
          </marker>
        </defs>

        <g
          ref={boardLayerRef}
          transform={boardTransform}
          style={{ userSelect: "none", WebkitUserSelect: "none" }}
        >
          <PitchLayer
            dimensions={pitchDimensions}
            showGrid={settings.showGrid}
            showZones={settings.showZones}
            pitchStyle={settings.pitchStyle}
            theme={settings.theme}
          />

          <g>
            {(renderable.overlays?.polygons ?? []).map((polygon) => {
              const points = polygon.points
                .map((point) => `${point.x},${point.y}`)
                .join(" ");
              return (
                <polygon
                  key={polygon.id}
                  points={points}
                  fill={polygon.fill}
                  fillOpacity={polygon.opacity}
                  stroke={polygon.stroke}
                  strokeWidth={polygon.strokeWidth}
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelection({
                      overlayIds: [polygon.id],
                      activeOverlayId: polygon.id,
                      entityIds: [],
                      activeEntityId: null,
                    });
                  }}
                />
              );
            })}
          </g>

          <g>
            {(renderable.overlays?.freehand ?? []).map((stroke) => (
              <polyline
                key={stroke.id}
                points={stroke.points
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                opacity={stroke.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="cursor-pointer"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelection({
                    overlayIds: [stroke.id],
                    activeOverlayId: stroke.id,
                    entityIds: [],
                    activeEntityId: null,
                  });
                }}
              />
            ))}
          </g>

          <g>
            {(renderable.overlays?.lines ?? []).map((line) => {
              const renderedLine =
                draggingLine?.lineId === line.id ? buildDraggedLine(draggingLine) : line;
              const start = resolveAnchor(
                renderedLine.start,
                renderable.positions,
                entities,
              );
              const end = resolveAnchor(
                renderedLine.end,
                renderable.positions,
                entities,
              );
              const isSelected = selection.activeOverlayId === line.id;
              const path =
                renderedLine.type === "dribble"
                  ? buildWavyPath(start, renderedLine, end)
                  : buildCubicPath(start, renderedLine, end);

              return (
                <g key={line.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={renderedLine.color}
                    strokeWidth={renderedLine.width + (isSelected ? 0.24 : 0)}
                    strokeDasharray={
                      renderedLine.type === "run" ? "2.4 2.1" : undefined
                    }
                    markerEnd="url(#motus-arrow)"
                    opacity={renderedLine.opacity}
                    className={
                      activeTool === "select"
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-pointer"
                    }
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      setSelection({
                        overlayIds: [line.id],
                        activeOverlayId: line.id,
                        entityIds: [],
                        activeEntityId: null,
                      });

                      if (activeTool !== "select") {
                        return;
                      }

                      const svg = svgRef.current;
                      if (!svg) {
                        return;
                      }

                      setLinePointerDown({
                        lineId: line.id,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                      });
                      setDraggingLine(null);
                      svg.setPointerCapture(event.pointerId);
                    }}
                  />
                </g>
              );
            })}
          </g>

          {draftLine &&
            (() => {
              const start = resolveAnchor(
                draftLine.start,
                renderable.positions,
                entities,
              );
              const end = resolveAnchor(
                draftLine.end,
                renderable.positions,
                entities,
              );
              const mid1 = {
                x: start.x + (end.x - start.x) * 0.33,
                y: start.y + (end.y - start.y) * 0.33,
              };
              const mid2 = {
                x: start.x + (end.x - start.x) * 0.66,
                y: start.y + (end.y - start.y) * 0.66,
              };
              const line: TacticalLine = {
                id: "draft",
                type: draftLine.tool,
                start: draftLine.start,
                end: draftLine.end,
                color:
                  draftLine.tool === "pass"
                    ? "#2563eb"
                    : draftLine.tool === "run"
                      ? "#0f172a"
                      : "#ea580c",
                width: 0.9,
                opacity: 0.82,
                controlPoint1: mid1,
                controlPoint2: mid2,
              };
              const path =
                draftLine.tool === "dribble"
                  ? buildWavyPath(start, line, end)
                  : buildCubicPath(start, line, end);

              return (
                <path
                  d={path}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={line.width}
                  strokeDasharray={
                    draftLine.tool === "run" ? "2.4 2.1" : undefined
                  }
                  markerEnd="url(#motus-arrow)"
                  opacity={line.opacity}
                />
              );
            })()}

          {freehandPoints && freehandPoints.length > 1 && (
            <polyline
              points={freehandPoints
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              fill="none"
              stroke="#f8fafc"
              strokeWidth={0.42}
              opacity={0.95}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {draftPolygon &&
            (() => {
              const bounds = getRectBounds(
                draftPolygon.start,
                draftPolygon.end,
              );
              const points = [
                `${bounds.left},${bounds.top}`,
                `${bounds.right},${bounds.top}`,
                `${bounds.right},${bounds.bottom}`,
                `${bounds.left},${bounds.bottom}`,
              ].join(" ");

              return (
                <polygon
                  points={points}
                  fill="#22c55e"
                  fillOpacity={0.18}
                  stroke="#22c55e"
                  strokeWidth={0.28}
                  strokeDasharray="1.4 1"
                />
              );
            })()}

          <g>
            {(renderable.overlays?.texts ?? []).map((textItem) =>
              (() => {
                const textPosition =
                  draggingTextId === textItem.id && dragTextPoint
                    ? dragTextPoint
                    : textItem.position;

                return (
                  <g
                    key={textItem.id}
                    transform={`translate(${textPosition.x} ${textPosition.y})`}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(event) =>
                      handleTextPointerDown(event, textItem.id)
                    }
                  >
                    <g transform={readableTextTransform}>
                      <rect
                        x={-0.5}
                        y={-2}
                        width={Math.max(7, textItem.text.length * 1.08)}
                        height={3}
                        rx={0.5}
                        fill="rgba(15,23,42,0.45)"
                      />
                      <text
                        x={0}
                        y={0}
                        textAnchor={toSvgTextAnchor(textItem.align)}
                        fontSize={textItem.fontSize}
                        fill={textItem.color}
                        fontWeight={600}
                        style={{
                          display:
                            editingTextId === textItem.id ? "none" : "inline",
                        }}
                      >
                        {textItem.text}
                      </text>
                      {editingTextId === textItem.id && (
                        <foreignObject
                          x={-0.5}
                          y={-2}
                          width={Math.max(14, textItem.text.length * 1.5)}
                          height={3.2}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={editingTextValue}
                            onChange={(event) =>
                              setEditingTextValue(event.target.value)
                            }
                            onBlur={() => commitInlineTextEdit(textItem.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitInlineTextEdit(textItem.id);
                                return;
                              }

                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelInlineTextEdit();
                              }
                            }}
                            style={{
                              width: "100%",
                              height: "100%",
                              border: "1px solid rgba(255,255,255,0.45)",
                              borderRadius: "6px",
                              background: "rgba(15,23,42,0.75)",
                              color: textItem.color,
                              fontSize: `${textItem.fontSize * 5.4}px`,
                              fontWeight: 600,
                              outline: "none",
                              padding: "0 6px",
                            }}
                          />
                        </foreignObject>
                      )}
                    </g>
                  </g>
                );
              })(),
            )}
          </g>

          {lassoRect &&
            (() => {
              const bounds = getRectBounds(lassoRect.start, lassoRect.end);
              return (
                <rect
                  x={bounds.left}
                  y={bounds.top}
                  width={bounds.right - bounds.left}
                  height={bounds.bottom - bounds.top}
                  fill="rgba(56, 189, 248, 0.14)"
                  stroke="rgba(14, 165, 233, 0.9)"
                  strokeWidth={0.26}
                  strokeDasharray="1.4 1"
                />
              );
            })()}

          <g>
            {filteredEntityEntries
              .filter((entity) => renderable.visibility[entity.id] ?? true)
              .map((entity) => {
                const position = getRenderedEntityPosition(entity);
                const rotation = getRenderedEntityRotation(entity);
                const isSelected =
                  selection.activeEntityId === entity.id ||
                  selection.entityIds.includes(entity.id);
                const isHovered = hoveredEntityId === entity.id;
                const showName =
                  settings.showPlayerNames ||
                  (entity.kind === "player" || entity.kind === "goalkeeper"
                    ? isHovered
                    : false);
                const entityTransform = [
                  rotation !== 0 ? `rotate(${rotation})` : null,
                  isPortraitRotated && entity.kind === "cone"
                    ? "rotate(90)"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ");
                const entityLabel =
                  entity.kind === "player" || entity.kind === "goalkeeper"
                    ? entity.name
                    : entity.label;
                const isBenchDragTargetCandidate =
                  draggedBenchPlayer !== null &&
                  isPlayerEntity(entity) &&
                  entity.team === draggedBenchPlayer.team;

                return (
                  <g
                    key={entity.id}
                    transform={`translate(${position.x} ${position.y})`}
                    className={
                      entity.locked
                        ? "pointer-events-none"
                        : "cursor-grab active:cursor-grabbing"
                    }
                    data-player-drop-id={
                      isPlayerEntity(entity) ? entity.id : undefined
                    }
                    onPointerDown={(event) =>
                      handleEntityPointerDown(event, entity.id)
                    }
                    onPointerEnter={() => setHoveredEntityId(entity.id)}
                    onPointerLeave={() =>
                      setHoveredEntityId((current) =>
                        current === entity.id ? null : current,
                      )
                    }
                  >
                    <circle
                      r={Math.max(entity.radius * 1.45, 3)}
                      fill="transparent"
                    />

                    {(isSelected || isHovered || isBenchDragTargetCandidate) && (
                      <circle
                        r={Math.max(
                          entity.radius * (isBenchDragTargetCandidate ? 1.55 : 1.35),
                          3,
                        )}
                        fill={
                          isSelected
                            ? "rgba(14,165,233,0.18)"
                            : isBenchDragTargetCandidate
                              ? "rgba(245,158,11,0.12)"
                            : "rgba(255,255,255,0.12)"
                        }
                        stroke={
                          isSelected
                            ? "rgba(14,165,233,0.95)"
                            : isBenchDragTargetCandidate
                              ? "rgba(245,158,11,0.88)"
                            : "rgba(255,255,255,0.5)"
                        }
                        strokeWidth={0.24}
                        strokeDasharray={
                          isBenchDragTargetCandidate
                            ? "1.2 0.9"
                            : undefined
                        }
                        className="pointer-events-none"
                      />
                    )}

                    <g transform={entityTransform || undefined}>
                      {renderEntityShape(entity, readableTextTransform)}
                    </g>

                    {showName && (
                      <g
                        transform={`translate(0 ${entity.radius + 1.7})`}
                        className="pointer-events-none"
                      >
                        <g transform={readableTextTransform}>
                          <text
                            x={0}
                            y={0}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={1.2}
                            fill="rgba(15,23,42,0.92)"
                            fontWeight={600}
                            stroke="rgba(255,255,255,0.96)"
                            strokeWidth={0.34}
                            paintOrder="stroke"
                            letterSpacing="0.01em"
                          >
                            {entityLabel}
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}
          </g>

          {selectedEquipmentVisible &&
            selectedEquipmentPosition &&
            activeTool === "select" && (
            <g
              transform={`translate(${selectedEquipmentPosition.x} ${Math.max(4.4, selectedEquipmentPosition.y - selectedEquipmentVisible.radius - 3.8)})`}
            >
              {selectedEquipmentVisible.kind !== "ball" && (
                <>
                  <CanvasActionButton
                    x={-2.55}
                    y={0}
                    label="<"
                    readableTextTransform={readableTextTransform}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      rotateEntity(selectedEquipmentVisible.id, -45);
                    }}
                  />
                  <CanvasActionButton
                    x={0}
                    y={0}
                    label=">"
                    readableTextTransform={readableTextTransform}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      rotateEntity(selectedEquipmentVisible.id, 45);
                    }}
                  />
                </>
              )}

              <CanvasActionButton
                x={selectedEquipmentVisible.kind === "ball" ? 0 : 2.55}
                y={0}
                label="x"
                tone="danger"
                readableTextTransform={readableTextTransform}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  removeEntity(selectedEquipmentVisible.id);
                }}
              />
            </g>
          )}

          {selectedText &&
            selectedTextActionPoint &&
            activeTool === "select" &&
            editingTextId !== selectedText.id &&
            draggingTextId !== selectedText.id && (
              <CanvasActionButton
                x={selectedTextActionPoint.x}
                y={selectedTextActionPoint.y}
                label="x"
                tone="danger"
                readableTextTransform={readableTextTransform}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  removeOverlayById(selectedText.id);
                }}
              />
            )}

          {renderedSelectedLine &&
            selectedLineActionPoint &&
            activeTool === "select" &&
            !draggingLine && (
            <g>
              <CanvasActionButton
                x={selectedLineActionPoint.x}
                y={selectedLineActionPoint.y - 2.1}
                label="x"
                tone="danger"
                readableTextTransform={readableTextTransform}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  removeOverlayById(renderedSelectedLine.id);
                }}
              />
              <line
                x1={renderedSelectedLine.controlPoint1.x}
                y1={renderedSelectedLine.controlPoint1.y}
                x2={renderedSelectedLine.controlPoint2.x}
                y2={renderedSelectedLine.controlPoint2.y}
                stroke="rgba(15,23,42,0.22)"
                strokeWidth={0.16}
                strokeDasharray="0.8 0.8"
              />
              <circle
                cx={renderedSelectedLine.controlPoint1.x}
                cy={renderedSelectedLine.controlPoint1.y}
                r={0.74}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth={0.18}
                onPointerDown={(event) =>
                  handleControlPointPointerDown(
                    event,
                    renderedSelectedLine.id,
                    "controlPoint1",
                  )
                }
              />
              <circle
                cx={renderedSelectedLine.controlPoint2.x}
                cy={renderedSelectedLine.controlPoint2.y}
                r={0.74}
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth={0.18}
                onPointerDown={(event) =>
                  handleControlPointPointerDown(
                    event,
                    renderedSelectedLine.id,
                    "controlPoint2",
                  )
                }
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
