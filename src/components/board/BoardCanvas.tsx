"use client";

import type React from "react";
import { useMemo, useRef, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import type {
  AnchorTarget,
  ControlPointKey,
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

const isPlayerEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

const renderEntityShape = (
  entity: TacticalEntity,
  textTransform?: string,
): React.ReactNode => {
  const stroke = "rgba(255,255,255,0.7)";
  const strokeWidth = 0.24;

  if (entity.kind === "ball") {
    return (
      <>
        <circle
          r={entity.radius}
          fill={entity.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <circle r={entity.radius * 0.42} fill="rgba(15,23,42,0.3)" />
      </>
    );
  }

  if (entity.kind === "cone") {
    const r = entity.radius;
    return (
      <polygon
        points={`0,${-r} ${r * 0.9},${r * 0.9} ${-r * 0.9},${r * 0.9}`}
        fill={entity.color}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  if (entity.kind === "mannequin") {
    const width = entity.radius * 1.6;
    const height = entity.radius * 2.6;
    return (
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={0.55}
        fill={entity.color}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
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
      >
        {"number" in entity ? entity.number : ""}
      </text>
    </>
  );
};

export function BoardCanvas({ svgRef }: BoardCanvasProps) {
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
  const addLine = useTacticalBoardStore((state) => state.addLine);
  const addFreehand = useTacticalBoardStore((state) => state.addFreehand);
  const addPolygon = useTacticalBoardStore((state) => state.addPolygon);
  const addText = useTacticalBoardStore((state) => state.addText);
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

  const isPortraitRotated = settings.orientation === "portrait-rotated";
  const pitchDimensions: PitchDimensions =
    PITCH_PRESET_DIMENSIONS[settings.pitchPreset] ??
    PITCH_PRESET_DIMENSIONS["football-105x68"];
  const readableTextTransform = isPortraitRotated
    ? "scale(-1 1) rotate(-90)"
    : undefined;
  const viewBox = useMemo(() => {
    if (isPortraitRotated && settings.mode === "training") {
      if (settings.training.focus === "half-attacking") {
        return {
          x: 0,
          y: 0,
          width: pitchDimensions.height,
          height: pitchDimensions.width / 2,
        };
      }

      if (settings.training.focus === "half-defending") {
        return {
          x: 0,
          y: pitchDimensions.width / 2,
          width: pitchDimensions.height,
          height: pitchDimensions.width / 2,
        };
      }
    }

    if (isPortraitRotated) {
      return {
        x: 0,
        y: 0,
        width: pitchDimensions.height,
        height: pitchDimensions.width,
      };
    }

    if (settings.mode === "training") {
      if (settings.training.focus === "half-defending") {
        return {
          x: 0,
          y: 0,
          width: pitchDimensions.width / 2,
          height: pitchDimensions.height,
        };
      }

      if (settings.training.focus === "half-attacking") {
        return {
          x: pitchDimensions.width / 2,
          y: 0,
          width: pitchDimensions.width / 2,
          height: pitchDimensions.height,
        };
      }
    }

    return getPitchViewBox(settings.pitchView, pitchDimensions);
  }, [
    isPortraitRotated,
    pitchDimensions,
    settings.mode,
    settings.pitchView,
    settings.training.focus,
  ]);
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
        visibility: {} as Record<Id, boolean>,
        lines: [] as TacticalLine[],
      };
    }

    if (isPlaying && fromFrameId && toFrameId) {
      const fromFrame = frames.find((frame) => frame.id === fromFrameId);
      const toFrame = frames.find((frame) => frame.id === toFrameId);

      if (fromFrame && toFrame) {
        const progress = clamp(playbackProgress, 0, 1);
        const positions: Record<Id, Point> = {};
        const visibility: Record<Id, boolean> = {};

        Object.values(entities).forEach((entity) => {
          const fromPoint =
            fromFrame.entityStates[entity.id]?.position ??
            entity.defaultPosition;
          const toPoint =
            toFrame.entityStates[entity.id]?.position ?? fromPoint;
          positions[entity.id] = lerpPoint(fromPoint, toPoint, progress);
          visibility[entity.id] =
            fromFrame.entityStates[entity.id]?.visible ?? true;
        });

        return {
          positions,
          visibility,
          overlays: fromFrame.overlays,
        };
      }
    }

    const positions: Record<Id, Point> = {};
    const visibility: Record<Id, boolean> = {};
    Object.values(entities).forEach((entity) => {
      positions[entity.id] =
        activeFrame.entityStates[entity.id]?.position ?? entity.defaultPosition;
      visibility[entity.id] =
        activeFrame.entityStates[entity.id]?.visible ?? true;
    });

    return {
      positions,
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
      addText({
        position: point,
        text: "Anotação",
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

  const selectedLine =
    renderable.overlays.lines.find(
      (line) => line.id === selection.activeOverlayId,
    ) ?? null;

  return (
    <div className="h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="h-full w-full touch-none"
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

        <g ref={boardLayerRef} transform={boardTransform}>
          <PitchLayer
            dimensions={pitchDimensions}
            showGrid={settings.showGrid}
            showZones={settings.showZones}
            pitchStyle={settings.pitchStyle}
            theme={settings.theme}
          />

          <g>
            {renderable.overlays.polygons.map((polygon) => {
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
            {renderable.overlays.freehand.map((stroke) => (
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
            {renderable.overlays.lines.map((line) => {
              const start = resolveAnchor(
                line.start,
                renderable.positions,
                entities,
              );
              const end = resolveAnchor(
                line.end,
                renderable.positions,
                entities,
              );
              const isSelected = selection.activeOverlayId === line.id;
              const path =
                line.type === "dribble"
                  ? buildWavyPath(start, line, end)
                  : buildCubicPath(start, line, end);

              return (
                <g key={line.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={line.width + (isSelected ? 0.35 : 0)}
                    strokeDasharray={
                      line.type === "run" ? "2.4 2.1" : undefined
                    }
                    markerEnd="url(#motus-arrow)"
                    opacity={line.opacity}
                    className="cursor-pointer"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelection({
                        overlayIds: [line.id],
                        activeOverlayId: line.id,
                        entityIds: [],
                        activeEntityId: null,
                      });
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
            {renderable.overlays.texts.map((textItem) => (
              <g
                key={textItem.id}
                transform={`translate(${textItem.position.x} ${textItem.position.y})`}
                className="cursor-pointer"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelection({
                    overlayIds: [textItem.id],
                    activeOverlayId: textItem.id,
                    entityIds: [],
                    activeEntityId: null,
                  });
                }}
              >
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
                  textAnchor={textItem.align}
                  fontSize={textItem.fontSize}
                  fill={textItem.color}
                  fontWeight={600}
                >
                  {textItem.text}
                </text>
              </g>
            ))}
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
                const showName =
                  settings.showPlayerNames ||
                  (entity.kind === "player" || entity.kind === "goalkeeper"
                    ? hoveredEntityId === entity.id
                    : false);

                return (
                  <g
                    key={entity.id}
                    transform={`translate(${position.x} ${position.y})`}
                    className={
                      entity.locked
                        ? "pointer-events-none"
                        : "cursor-grab active:cursor-grabbing"
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
                    {renderEntityShape(entity, readableTextTransform)}

                    {showName && (
                      <text
                        x={0}
                        y={-entity.radius - 1.3}
                        textAnchor="middle"
                        fontSize={1.6}
                        fill="#e2e8f0"
                        fontWeight={600}
                        transform={readableTextTransform}
                        className="pointer-events-none"
                      >
                        {entity.kind === "player" ||
                        entity.kind === "goalkeeper"
                          ? entity.name
                          : entity.label}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>

          {selectedLine && activeTool === "select" && (
            <g>
              <line
                x1={selectedLine.controlPoint1.x}
                y1={selectedLine.controlPoint1.y}
                x2={selectedLine.controlPoint2.x}
                y2={selectedLine.controlPoint2.y}
                stroke="rgba(15,23,42,0.35)"
                strokeWidth={0.2}
                strokeDasharray="1 1"
              />
              <circle
                cx={selectedLine.controlPoint1.x}
                cy={selectedLine.controlPoint1.y}
                r={0.95}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth={0.22}
                onPointerDown={(event) =>
                  handleControlPointPointerDown(
                    event,
                    selectedLine.id,
                    "controlPoint1",
                  )
                }
              />
              <circle
                cx={selectedLine.controlPoint2.x}
                cy={selectedLine.controlPoint2.y}
                r={0.95}
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth={0.22}
                onPointerDown={(event) =>
                  handleControlPointPointerDown(
                    event,
                    selectedLine.id,
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
