"use client";

import type React from "react";
import { useMemo, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import type {
  AnchorTarget,
  ControlPointKey,
  Id,
  Point,
  TacticalEntity,
  TacticalLine,
} from "@/src/types";

import { PitchLayer } from "./PitchLayer";
import {
  buildCubicPath,
  buildWavyPath,
  clampPointToPitch,
  distance,
  findNearestEntity,
  getPitchViewBox,
  resolveAnchor,
  toPitchPoint,
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

const isLineTool = (tool: string): tool is DraftLine["tool"] =>
  tool === "pass" || tool === "run" || tool === "dribble";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const lerpPoint = (from: Point, to: Point, t: number): Point => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
});

const renderEntityShape = (entity: TacticalEntity): React.ReactNode => {
  const stroke = "rgba(255,255,255,0.7)";
  const strokeWidth = 0.24;

  if (entity.kind === "ball") {
    return (
      <>
        <circle r={entity.radius} fill={entity.color} stroke={stroke} strokeWidth={strokeWidth} />
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

  const isGoalkeeper = entity.kind === "goalkeeper";
  return (
    <>
      {isGoalkeeper ? (
        <rect
          x={-entity.radius}
          y={-entity.radius}
          width={entity.radius * 2}
          height={entity.radius * 2}
          rx={0.45}
          fill={entity.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <circle
          r={entity.radius}
          fill={entity.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={2.02}
        fontWeight={700}
        fill="#f8fafc"
      >
        {"number" in entity ? entity.number : ""}
      </text>
    </>
  );
};

export function BoardCanvas({ svgRef }: BoardCanvasProps) {
  const settings = useTacticalBoardStore((state) => state.settings);
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const isPlaying = useTacticalBoardStore((state) => state.playback.isPlaying);
  const fromFrameId = useTacticalBoardStore((state) => state.playback.fromFrameId);
  const toFrameId = useTacticalBoardStore((state) => state.playback.toFrameId);
  const playbackProgress = useTacticalBoardStore((state) => state.playback.progress);
  const activeTool = useTacticalBoardStore((state) => state.activeTool);
  const selection = useTacticalBoardStore((state) => state.selection);

  const setSelection = useTacticalBoardStore((state) => state.setSelection);
  const clearSelection = useTacticalBoardStore((state) => state.clearSelection);
  const moveEntity = useTacticalBoardStore((state) => state.moveEntity);
  const addLine = useTacticalBoardStore((state) => state.addLine);
  const updateLineControlPoint = useTacticalBoardStore((state) => state.updateLineControlPoint);

  const [draggingEntityId, setDraggingEntityId] = useState<Id | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [draftLine, setDraftLine] = useState<DraftLine | null>(null);
  const [editingControlPoint, setEditingControlPoint] = useState<EditingControlPoint | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<Id | null>(null);

  const viewBox = useMemo(() => getPitchViewBox(settings.pitchView), [settings.pitchView]);
  const entityEntries = useMemo(() => Object.values(entities), [entities]);
  const renderable = useMemo(() => {
    const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0];

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
          const fromPoint = fromFrame.entityStates[entity.id]?.position ?? entity.defaultPosition;
          const toPoint = toFrame.entityStates[entity.id]?.position ?? fromPoint;
          positions[entity.id] = lerpPoint(fromPoint, toPoint, progress);
          visibility[entity.id] = fromFrame.entityStates[entity.id]?.visible ?? true;
        });

        return {
          positions,
          visibility,
          lines: fromFrame.lines,
        };
      }
    }

    const positions: Record<Id, Point> = {};
    const visibility: Record<Id, boolean> = {};
    Object.values(entities).forEach((entity) => {
      positions[entity.id] = activeFrame.entityStates[entity.id]?.position ?? entity.defaultPosition;
      visibility[entity.id] = activeFrame.entityStates[entity.id]?.visible ?? true;
    });

    return {
      positions,
      visibility,
      lines: activeFrame.lines,
    };
  }, [activeFrameId, entities, frames, fromFrameId, isPlaying, playbackProgress, toFrameId]);

  const visiblePositions = useMemo(() => {
    const next: Record<Id, Point> = {};
    Object.entries(renderable.positions).forEach(([entityId, point]) => {
      if (renderable.visibility[entityId] ?? true) {
        next[entityId] = point;
      }
    });
    return next;
  }, [renderable.positions, renderable.visibility]);

  const toAnchor = (point: Point): AnchorTarget => {
    const clamped = clampPointToPitch(point);
    if (!settings.snapToEntities) {
      return { kind: "free", point: clamped };
    }

    const nearest = findNearestEntity(clamped, visiblePositions, 3.3);
    if (nearest) {
      return { kind: "entity", entityId: nearest };
    }

    return { kind: "free", point: clamped };
  };

  const startLineDraft = (tool: DraftLine["tool"], startAnchor: AnchorTarget) => {
    setDraftLine({
      tool,
      start: startAnchor,
      end: startAnchor,
    });
    setSelection({ entityId: null, lineId: null });
  };

  const finalizeLineDraft = () => {
    if (!draftLine) {
      return;
    }

    const startPoint = resolveAnchor(draftLine.start, renderable.positions, entities);
    const endPoint = resolveAnchor(draftLine.end, renderable.positions, entities);

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

    const point = clampPointToPitch(toPitchPoint(event, svg));

    if (isLineTool(activeTool)) {
      startLineDraft(activeTool, toAnchor(point));
      return;
    }

    clearSelection();
  };

  const handleEntityPointerDown = (event: React.PointerEvent<SVGGElement>, entityId: Id) => {
    event.stopPropagation();
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    if (isLineTool(activeTool)) {
      startLineDraft(activeTool, { kind: "entity", entityId });
      return;
    }

    const initialPosition = renderable.positions[entityId] ?? entities[entityId]?.defaultPosition;
    setSelection({ entityId, lineId: null });
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

    const point = clampPointToPitch(toPitchPoint(event, svg));

    if (draggingEntityId) {
      setDragPoint(point);
      return;
    }

    if (editingControlPoint) {
      updateLineControlPoint(editingControlPoint.lineId, editingControlPoint.key, point);
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
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (svg && svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }

    if (draggingEntityId && dragPoint) {
      const currentPoint =
        renderable.positions[draggingEntityId] ?? entities[draggingEntityId]?.defaultPosition;
      if (!currentPoint || currentPoint.x !== dragPoint.x || currentPoint.y !== dragPoint.y) {
        moveEntity(draggingEntityId, dragPoint);
      }
    }

    setDraggingEntityId(null);
    setDragPoint(null);

    if (editingControlPoint) {
      setEditingControlPoint(null);
    }

    if (draftLine) {
      finalizeLineDraft();
    }
  };

  const selectedLine = renderable.lines.find((line) => line.id === selection.lineId) ?? null;

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
        <PitchLayer showGrid={settings.showGrid} showZones={settings.showZones} />

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

        <g>
          {renderable.lines.map((line) => {
            const start = resolveAnchor(line.start, renderable.positions, entities);
            const end = resolveAnchor(line.end, renderable.positions, entities);
            const isSelected = selection.lineId === line.id;
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
                  strokeDasharray={line.type === "run" ? "2.4 2.1" : undefined}
                  markerEnd="url(#motus-arrow)"
                  opacity={line.opacity}
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelection({ lineId: line.id, entityId: null });
                  }}
                />
              </g>
            );
          })}
        </g>

        {draftLine && (() => {
          const start = resolveAnchor(draftLine.start, renderable.positions, entities);
          const end = resolveAnchor(draftLine.end, renderable.positions, entities);
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
            color: draftLine.tool === "pass" ? "#2563eb" : draftLine.tool === "run" ? "#0f172a" : "#ea580c",
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
              strokeDasharray={draftLine.tool === "run" ? "2.4 2.1" : undefined}
              markerEnd="url(#motus-arrow)"
              opacity={line.opacity}
            />
          );
        })()}

        <g>
          {entityEntries
            .filter((entity) => renderable.visibility[entity.id] ?? true)
            .map((entity) => {
            const basePosition = renderable.positions[entity.id] ?? entity.defaultPosition;
            const position =
              draggingEntityId === entity.id && dragPoint ? dragPoint : basePosition;
            const showName =
              settings.showPlayerNames ||
              (entity.kind === "player" || entity.kind === "goalkeeper"
                ? hoveredEntityId === entity.id
                : false);

            return (
              <g
                key={entity.id}
                transform={`translate(${position.x} ${position.y})`}
                className={entity.locked ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"}
                onPointerDown={(event) => handleEntityPointerDown(event, entity.id)}
                onPointerEnter={() => setHoveredEntityId(entity.id)}
                onPointerLeave={() =>
                  setHoveredEntityId((current) => (current === entity.id ? null : current))
                }
              >
                {renderEntityShape(entity)}

                {showName && (
                  <text
                    x={0}
                    y={-entity.radius - 1.3}
                    textAnchor="middle"
                    fontSize={1.6}
                    fill="#e2e8f0"
                    fontWeight={600}
                    className="pointer-events-none"
                  >
                    {entity.kind === "player" || entity.kind === "goalkeeper"
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
                handleControlPointPointerDown(event, selectedLine.id, "controlPoint1")
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
                handleControlPointPointerDown(event, selectedLine.id, "controlPoint2")
              }
            />
          </g>
        )}
      </svg>
    </div>
  );
}
