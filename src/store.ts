"use client";

import { create } from "zustand";
import type { StoreApi } from "zustand";
import { v4 as uuidv4 } from "uuid";

import type {
  AddFreehandInput,
  AddEntityInput,
  AddPolygonInput,
  AddRulerInput,
  AddTextInput,
  AnchorTarget,
  BoardHistory,
  BoardSelection,
  BoardSettings,
  ControlPointKey,
  DrawTool,
  EquipmentEntity,
  FrameOverlays,
  FormationPreset,
  FrameEntityState,
  Id,
  NewLineInput,
  PlaybackState,
  PitchPreset,
  Point,
  PlayerEntity,
  RenderBoardState,
  TacticalBoardExport,
  TacticalBoardImport,
  TacticalBoardSnapshot,
  TacticalEntity,
  TacticalLine,
  TeamSide,
  TimelineFrame,
} from "./types";
import { FORMATION_PRESETS, PITCH_DIMENSIONS } from "./types";
import {
  getMockPlayerById,
  MOCK_MATCH_DATABASE,
  type MockPlayerRecord,
} from "./mockPlayerDatabase";
import { PITCH_PRESET_DIMENSIONS } from "./types";

const HISTORY_LIMIT = 100;

const LINE_COLORS: Record<TacticalLine["type"], string> = {
  pass: "#19d3c5",
  run: "#2f6bff",
  dribble: "#f59e0b",
};

const EQUIPMENT_DEFAULTS: Record<
  EquipmentEntity["kind"],
  { label: string; color: string; radius: number }
> = {
  ball: { label: "Bola", color: "#f8fafc", radius: 1.2 },
  cone: { label: "Cone", color: "#fb923c", radius: 1.4 },
  mannequin: { label: "Manequim", color: "#d9f99d", radius: 1.8 },
  portableGoal: { label: "Gol", color: "#f8fafc", radius: 1.95 },
  miniGoal: { label: "Mini gol", color: "#f8fafc", radius: 1.25 },
  hurdle: { label: "Barreira", color: "#e2e8f0", radius: 1.55 },
};

const DEFAULT_SETTINGS: BoardSettings = {
  mode: "match",
  orientation: "landscape",
  pitchStyle: "tactical-pad",
  pitchPreset: "football-105x68",
  theme: "light",
  pitchView: "full",
  showGrid: false,
  showZones: false,
  showPlayerNames: false,
  snapToEntities: true,
  training: {
    focus: "full",
    visibleTeams: ["home"],
    emphasizeEquipment: true,
    fieldLayout: "none",
  },
};

const DEFAULT_PLAYBACK: PlaybackState = {
  isPlaying: false,
  fromFrameId: null,
  toFrameId: null,
  progress: 0,
  loop: false,
  speed: 1,
};

interface TacticalBoardStore {
  settings: BoardSettings;
  entities: Record<Id, TacticalEntity>;
  frames: TimelineFrame[];
  activeFrameId: Id;
  activeTool: DrawTool;
  selection: BoardSelection;
  history: BoardHistory;
  playback: PlaybackState;
  setActiveTool: (tool: TacticalBoardStore["activeTool"]) => void;
  setSelection: (selection: Partial<BoardSelection>) => void;
  clearSelection: () => void;
  setBoardSettings: (updates: Partial<BoardSettings>) => void;
  addEntity: (input: AddEntityInput) => void;
  updateEntity: (entityId: Id, updates: Partial<TacticalEntity>) => void;
  rotateEntity: (entityId: Id, deltaDegrees: number, frameId?: Id) => void;
  moveEntity: (entityId: Id, position: Point, frameId?: Id) => void;
  removePlayerFromPitch: (playerId: Id, frameId?: Id) => void;
  returnPlayerToPitch: (playerId: Id, frameId?: Id) => void;
  placePlayerOnPitch: (playerId: Id, position: Point, frameId?: Id) => void;
  substitutePlayers: (
    benchPlayerId: Id,
    fieldPlayerId: Id,
    frameId?: Id,
  ) => void;
  removeEntity: (entityId: Id) => void;
  addLine: (input: NewLineInput, frameId?: Id) => void;
  updateLine: (
    lineId: Id,
    updates: Partial<TacticalLine>,
    frameId?: Id,
  ) => void;
  updateLineControlPoint: (
    lineId: Id,
    controlPointKey: ControlPointKey,
    point: Point,
    frameId?: Id,
  ) => void;
  removeLine: (lineId: Id, frameId?: Id) => void;
  addFreehand: (input: AddFreehandInput, frameId?: Id) => void;
  updateFreehand: (
    strokeId: Id,
    updates: Partial<FrameOverlays["freehand"][number]>,
    frameId?: Id,
  ) => void;
  removeFreehand: (strokeId: Id, frameId?: Id) => void;
  addPolygon: (input: AddPolygonInput, frameId?: Id) => void;
  updatePolygon: (
    polygonId: Id,
    updates: Partial<FrameOverlays["polygons"][number]>,
    frameId?: Id,
  ) => void;
  removePolygon: (polygonId: Id, frameId?: Id) => void;
  addText: (input: AddTextInput, frameId?: Id) => void;
  updateText: (
    textId: Id,
    updates: Partial<FrameOverlays["texts"][number]>,
    frameId?: Id,
  ) => void;
  removeText: (textId: Id, frameId?: Id) => void;
  addRuler: (input: AddRulerInput, frameId?: Id) => void;
  updateRuler: (
    rulerId: Id,
    updates: Partial<FrameOverlays["rulers"][number]>,
    frameId?: Id,
  ) => void;
  removeRuler: (rulerId: Id, frameId?: Id) => void;
  removeOverlayById: (overlayId: Id, frameId?: Id) => void;
  addFrame: (name?: string) => void;
  duplicateFrame: (frameId?: Id) => void;
  removeFrame: (frameId: Id) => void;
  setActiveFrame: (frameId: Id) => void;
  updateFrameDuration: (frameId: Id, durationMs: number) => void;
  applyFormation: (
    team: TeamSide,
    formation: FormationPreset,
    frameId?: Id,
  ) => void;
  swapSides: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  tickPlayback: (deltaMs: number) => void;
  toggleLoop: () => void;
  setPlaybackSpeed: (speed: number) => void;
  undo: () => void;
  redo: () => void;
  resetBoard: () => void;
  exportPlaybook: () => TacticalBoardExport;
  importPlaybook: (payload: TacticalBoardImport) => void;
  getRenderableState: () => RenderBoardState;
}

const isTeamEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

const isGoalkeeperEntity = (
  entity: TacticalEntity,
): entity is PlayerEntity & { kind: "goalkeeper" } =>
  entity.kind === "goalkeeper";

const isOutfieldPlayerEntity = (
  entity: TacticalEntity,
): entity is PlayerEntity & { kind: "player" } => entity.kind === "player";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeRotation = (value: number): number => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;

const lerpPoint = (from: Point, to: Point, t: number): Point => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
});

const deepClone = <T>(value: T): T => structuredClone(value);

const createFrameEntityState = (position: Point): FrameEntityState => ({
  position,
  rotation: 0,
  visible: true,
});

const mirrorForAway = (point: Point, dimensions: { width: number }): Point => ({
  x: dimensions.width - point.x,
  y: point.y,
});

const parseFormation = (formation: FormationPreset): number[] =>
  formation
    .split("-")
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value) && value > 0);

const buildOutfieldPositions = (
  formation: FormationPreset,
  team: TeamSide,
  dimensions = PITCH_DIMENSIONS,
): Point[] => {
  const rows = parseFormation(formation);
  const lineStartX = (22 / 105) * dimensions.width;
  const lineEndX = (70 / 105) * dimensions.width;
  const spacing =
    rows.length > 1 ? (lineEndX - lineStartX) / (rows.length - 1) : 0;

  const positions = rows.flatMap((count, rowIndex) => {
    const x = lineStartX + spacing * rowIndex;
    const laneGap = dimensions.height / (count + 1);
    return Array.from({ length: count }, (_, laneIndex) => ({
      x,
      y: laneGap * (laneIndex + 1),
    }));
  });

  return team === "away"
    ? positions.map((point) => mirrorForAway(point, dimensions))
    : positions;
};

const getBenchPosition = (
  team: TeamSide,
  index: number,
  dimensions = PITCH_DIMENSIONS,
): Point => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const laneX = 15 + column * 6.4;
  const laneY = 6 + row * 4.8;

  return team === "home"
    ? {
        x: laneX,
        y: dimensions.height - laneY,
      }
    : {
        x: dimensions.width - laneX,
        y: laneY,
      };
};

const buildTeamEntities = (
  team: TeamSide,
  formation: FormationPreset,
  color: string,
  dimensions = PITCH_DIMENSIONS,
): TacticalEntity[] => {
  const sidePrefix = team === "home" ? "C" : "V";
  const goalkeeperOffsetX = (8 / 105) * dimensions.width;
  const goalkeeperPoint =
    team === "home"
      ? { x: goalkeeperOffsetX, y: dimensions.height / 2 }
      : { x: dimensions.width - goalkeeperOffsetX, y: dimensions.height / 2 };
  const outfieldPositions = buildOutfieldPositions(formation, team, dimensions);

  const goalkeeper: TacticalEntity = {
    id: `${team}-gk`,
    kind: "goalkeeper",
    label: `${sidePrefix}1`,
    team,
    number: 1,
    name: `${sidePrefix} Goleiro`,
    color,
    jerseyStyle: "bordered",
    isStarter: true,
    radius: 2.3,
    rotation: 0,
    defaultPosition: goalkeeperPoint,
  };

  const outfield = outfieldPositions.map((position, index) => {
    const number = index + 2;
    return {
      id: `${team}-p-${number}`,
      kind: "player",
      label: `${number}`,
      team,
      number,
      name: `${sidePrefix}${number}`,
      color,
      jerseyStyle: team === "home" ? "striped" : "solid",
      isStarter: true,
      radius: 2.1,
      rotation: 0,
      defaultPosition: position,
    } satisfies TacticalEntity;
  });

  const benchGoalkeeper: TacticalEntity = {
    id: `${team}-gk-12`,
    kind: "goalkeeper",
    label: "12",
    team,
    number: 12,
    name: `${sidePrefix} Goleiro 12`,
    color,
    jerseyStyle: "bordered",
    isStarter: false,
    radius: 2.3,
    rotation: 0,
    defaultPosition: getBenchPosition(team, 0, dimensions),
  };

  const benchPlayers = Array.from({ length: 6 }, (_, index) => {
    const number = index + 13;
    return {
      id: `${team}-bench-${number}`,
      kind: "player",
      label: `${number}`,
      team,
      number,
      name: `${sidePrefix}${number}`,
      color,
      jerseyStyle: team === "home" ? "striped" : "solid",
      isStarter: false,
      radius: 2.1,
      rotation: 0,
      defaultPosition: getBenchPosition(team, index + 1, dimensions),
    } satisfies TacticalEntity;
  });

  return [goalkeeper, ...outfield, benchGoalkeeper, ...benchPlayers];
};

const createMockPlayerEntity = (
  team: TeamSide,
  color: string,
  player: MockPlayerRecord,
  defaultPosition: Point,
  isStarter: boolean,
): TacticalEntity => ({
  id: `${team}-${player.id}`,
  kind: player.role,
  label: String(player.shirtNumber),
  team,
  number: player.shirtNumber,
  name: player.fullName,
  avatarUrl: player.avatarUrl,
  color,
  jerseyStyle:
    player.jerseyStyle ??
    (player.role === "goalkeeper"
      ? "bordered"
      : team === "home"
        ? "striped"
        : "solid"),
  isStarter,
  radius: player.role === "goalkeeper" ? 2.3 : 2.1,
  rotation: 0,
  defaultPosition,
});

const buildTeamEntitiesFromMockDatabase = (
  team: TeamSide,
  dimensions = PITCH_DIMENSIONS,
): TacticalEntity[] => {
  const squad = MOCK_MATCH_DATABASE[team];
  if (!squad) {
    return buildTeamEntities(
      team,
      team === "home" ? "4-3-3" : "4-4-2",
      team === "home" ? "#2563eb" : "#f59e0b",
      dimensions,
    );
  }

  const goalkeeperOffsetX = (8 / 105) * dimensions.width;
  const goalkeeperPoint =
    team === "home"
      ? { x: goalkeeperOffsetX, y: dimensions.height / 2 }
      : { x: dimensions.width - goalkeeperOffsetX, y: dimensions.height / 2 };
  const outfieldPositions = buildOutfieldPositions(
    squad.formation,
    team,
    dimensions,
  );

  const starterRecords = squad.starterIds
    .map((playerId) => getMockPlayerById(playerId))
    .filter((player): player is MockPlayerRecord => Boolean(player));
  const benchRecords = squad.benchIds
    .map((playerId) => getMockPlayerById(playerId))
    .filter((player): player is MockPlayerRecord => Boolean(player));

  const starterGoalkeeper = starterRecords.find(
    (player) => player.role === "goalkeeper",
  );
  const starterOutfield = starterRecords.filter(
    (player) => player.role === "player",
  );
  const benchGoalkeeper = benchRecords.find(
    (player) => player.role === "goalkeeper",
  );
  const benchOutfield = benchRecords.filter((player) => player.role === "player");

  if (
    !starterGoalkeeper ||
    starterOutfield.length !== outfieldPositions.length ||
    !benchGoalkeeper ||
    benchOutfield.length < 6
  ) {
    return buildTeamEntities(team, squad.formation, squad.color, dimensions);
  }

  return [
    createMockPlayerEntity(
      team,
      squad.color,
      starterGoalkeeper,
      goalkeeperPoint,
      true,
    ),
    ...starterOutfield.map((player, index) =>
      createMockPlayerEntity(
        team,
        squad.color,
        player,
        outfieldPositions[index],
        true,
      ),
    ),
    createMockPlayerEntity(
      team,
      squad.color,
      benchGoalkeeper,
      getBenchPosition(team, 0, dimensions),
      false,
    ),
    ...benchOutfield.slice(0, 6).map((player, index) =>
      createMockPlayerEntity(
        team,
        squad.color,
        player,
        getBenchPosition(team, index + 1, dimensions),
        false,
      ),
    ),
  ];
};

const buildEquipmentEntities = (): TacticalEntity[] => [];

const toEntityMap = (entities: TacticalEntity[]): Record<Id, TacticalEntity> =>
  Object.fromEntries(entities.map((entity) => [entity.id, entity]));

const createFrameStatesFromEntities = (
  entities: Record<Id, TacticalEntity>,
): Record<Id, FrameEntityState> =>
  Object.fromEntries(
    Object.values(entities).map((entity) => [
      entity.id,
      {
        ...createFrameEntityState(deepClone(entity.defaultPosition)),
        visible: isTeamEntity(entity) ? (entity.isStarter ?? true) : true,
      },
    ]),
  );

const createEmptyOverlays = (): FrameOverlays => ({
  lines: [],
  freehand: [],
  polygons: [],
  texts: [],
  rulers: [],
});

const getDimensionsByPreset = (preset: PitchPreset) =>
  PITCH_PRESET_DIMENSIONS[preset] ?? PITCH_DIMENSIONS;

const scalePoint = (point: Point, scaleX: number, scaleY: number): Point => ({
  x: point.x * scaleX,
  y: point.y * scaleY,
});

const mirrorPoint = (point: Point, pitchWidth: number): Point => ({
  x: pitchWidth - point.x,
  y: point.y,
});

const scaleAnchor = (
  anchor: AnchorTarget,
  scaleX: number,
  scaleY: number,
): AnchorTarget => {
  if (anchor.kind === "free") {
    return {
      ...anchor,
      point: scalePoint(anchor.point, scaleX, scaleY),
    };
  }

  return {
    ...anchor,
    offset: anchor.offset
      ? scalePoint(anchor.offset, scaleX, scaleY)
      : anchor.offset,
  };
};

const scaleFrameOverlays = (
  overlays: FrameOverlays,
  scaleX: number,
  scaleY: number,
): FrameOverlays => ({
  lines: overlays.lines.map((line) => ({
    ...line,
    start: scaleAnchor(line.start, scaleX, scaleY),
    end: scaleAnchor(line.end, scaleX, scaleY),
    controlPoint1: scalePoint(line.controlPoint1, scaleX, scaleY),
    controlPoint2: scalePoint(line.controlPoint2, scaleX, scaleY),
  })),
  freehand: overlays.freehand.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => scalePoint(point, scaleX, scaleY)),
  })),
  polygons: overlays.polygons.map((polygon) => ({
    ...polygon,
    points: polygon.points.map((point) => scalePoint(point, scaleX, scaleY)),
  })),
  texts: overlays.texts.map((text) => ({
    ...text,
    position: scalePoint(text.position, scaleX, scaleY),
  })),
  rulers: overlays.rulers.map((ruler) => ({
    ...ruler,
    start: scaleAnchor(ruler.start, scaleX, scaleY),
    end: scaleAnchor(ruler.end, scaleX, scaleY),
  })),
});

const mirrorAnchor = (
  anchor: AnchorTarget,
  pitchWidth: number,
): AnchorTarget => {
  if (anchor.kind === "free") {
    return {
      ...anchor,
      point: mirrorPoint(anchor.point, pitchWidth),
    };
  }

  return {
    ...anchor,
    offset: anchor.offset
      ? {
          x: -anchor.offset.x,
          y: anchor.offset.y,
        }
      : anchor.offset,
  };
};

const mirrorFrameOverlays = (
  overlays: FrameOverlays,
  pitchWidth: number,
): FrameOverlays => ({
  lines: overlays.lines.map((line) => ({
    ...line,
    start: mirrorAnchor(line.start, pitchWidth),
    end: mirrorAnchor(line.end, pitchWidth),
    controlPoint1: mirrorPoint(line.controlPoint1, pitchWidth),
    controlPoint2: mirrorPoint(line.controlPoint2, pitchWidth),
  })),
  freehand: overlays.freehand.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => mirrorPoint(point, pitchWidth)),
  })),
  polygons: overlays.polygons.map((polygon) => ({
    ...polygon,
    points: polygon.points.map((point) => mirrorPoint(point, pitchWidth)),
  })),
  texts: overlays.texts.map((text) => ({
    ...text,
    position: mirrorPoint(text.position, pitchWidth),
  })),
  rulers: overlays.rulers.map((ruler) => ({
    ...ruler,
    start: mirrorAnchor(ruler.start, pitchWidth),
    end: mirrorAnchor(ruler.end, pitchWidth),
  })),
});

const scaleSnapshotToPreset = (
  snapshot: TacticalBoardSnapshot,
  fromPreset: PitchPreset,
  toPreset: PitchPreset,
): void => {
  if (fromPreset === toPreset) {
    return;
  }

  const from = getDimensionsByPreset(fromPreset);
  const to = getDimensionsByPreset(toPreset);
  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;

  Object.values(snapshot.entities).forEach((entity) => {
    entity.defaultPosition = scalePoint(entity.defaultPosition, scaleX, scaleY);
  });

  snapshot.frames.forEach((frame) => {
    Object.entries(frame.entityStates).forEach(([entityId, entityState]) => {
      frame.entityStates[entityId] = {
        ...entityState,
        position: scalePoint(entityState.position, scaleX, scaleY),
      };
    });

    frame.overlays = scaleFrameOverlays(frame.overlays, scaleX, scaleY);
  });
};

const createFrame = (
  name: string,
  entities: Record<Id, TacticalEntity>,
  durationMs = 1800,
): TimelineFrame => ({
  id: uuidv4(),
  name,
  durationMs,
  entityStates: createFrameStatesFromEntities(entities),
  overlays: createEmptyOverlays(),
});

const ensureFrameOverlays = (
  frame: Partial<TimelineFrame> & { lines?: TacticalLine[] },
): FrameOverlays => {
  const overlays = frame.overlays;
  if (overlays) {
    return {
      lines: overlays.lines ?? [],
      freehand: overlays.freehand ?? [],
      polygons: overlays.polygons ?? [],
      texts: overlays.texts ?? [],
      rulers: overlays.rulers ?? [],
    };
  }

  return {
    ...createEmptyOverlays(),
    lines: frame.lines ?? [],
  };
};

const createInitialSnapshot = (): TacticalBoardSnapshot => {
  const initialDimensions = getDimensionsByPreset(DEFAULT_SETTINGS.pitchPreset);
  const entities = toEntityMap([
    ...buildTeamEntitiesFromMockDatabase("home", initialDimensions),
    ...buildTeamEntitiesFromMockDatabase("away", initialDimensions),
    ...buildEquipmentEntities(),
  ]);

  const firstFrame = createFrame("Quadro 1", entities);

  return {
    settings: deepClone(DEFAULT_SETTINGS),
    entities,
    frames: [firstFrame],
    activeFrameId: firstFrame.id,
  };
};

const snapshotFromState = (
  state: TacticalBoardStore,
): TacticalBoardSnapshot => ({
  settings: deepClone(state.settings),
  entities: deepClone(state.entities),
  frames: deepClone(state.frames),
  activeFrameId: state.activeFrameId,
});

const getFrameIndex = (frames: TimelineFrame[], frameId: Id): number =>
  frames.findIndex((frame) => frame.id === frameId);

const getFrameById = (
  frames: TimelineFrame[],
  frameId: Id,
): TimelineFrame | undefined => frames.find((frame) => frame.id === frameId);

const getEntityPosition = (
  frame: TimelineFrame,
  entity: TacticalEntity | undefined,
): Point => {
  if (!entity) {
    return { x: 0, y: 0 };
  }

  return frame.entityStates[entity.id]?.position ?? entity.defaultPosition;
};

const resolveAnchorPoint = (
  anchor: AnchorTarget,
  frame: TimelineFrame,
  entities: Record<Id, TacticalEntity>,
): Point => {
  if (anchor.kind === "free") {
    return anchor.point;
  }

  const entity = entities[anchor.entityId];
  const position = getEntityPosition(frame, entity);
  const offset = anchor.offset ?? { x: 0, y: 0 };

  return {
    x: position.x + offset.x,
    y: position.y + offset.y,
  };
};

const createDefaultControlPoints = (
  start: Point,
  end: Point,
): Pick<TacticalLine, "controlPoint1" | "controlPoint2"> => ({
  controlPoint1: {
    x: lerp(start.x, end.x, 0.33),
    y: lerp(start.y, end.y, 0.33),
  },
  controlPoint2: {
    x: lerp(start.x, end.x, 0.66),
    y: lerp(start.y, end.y, 0.66),
  },
});

const resetPlayback = (playback: PlaybackState): PlaybackState => ({
  ...playback,
  isPlaying: false,
  fromFrameId: null,
  toFrameId: null,
  progress: 0,
});

const getNextFrameId = (
  frames: TimelineFrame[],
  fromFrameId: Id,
  loop: boolean,
): Id | null => {
  const index = getFrameIndex(frames, fromFrameId);
  if (index < 0) {
    return frames[0]?.id ?? null;
  }

  if (index === frames.length - 1) {
    return loop ? (frames[0]?.id ?? null) : null;
  }

  return frames[index + 1].id;
};

const convertAnchorAfterEntityDelete = (
  anchor: AnchorTarget,
  deletedEntityId: Id,
  fallbackPoint: Point,
): AnchorTarget => {
  if (anchor.kind === "entity" && anchor.entityId === deletedEntityId) {
    return { kind: "free", point: fallbackPoint };
  }

  return anchor;
};

const getNextTeamNumber = (
  entities: Record<Id, TacticalEntity>,
  team: TeamSide,
): number => {
  const numbers = Object.values(entities)
    .filter(isTeamEntity)
    .filter((entity) => entity.team === team)
    .map((entity) => entity.number);

  const max = numbers.length > 0 ? Math.max(...numbers) : 1;
  return max + 1;
};

const getFramePositions = (
  frame: TimelineFrame,
  entities: Record<Id, TacticalEntity>,
): Record<Id, Point> =>
  Object.fromEntries(
    Object.values(entities).map((entity) => [
      entity.id,
      frame.entityStates[entity.id]?.position ?? entity.defaultPosition,
    ]),
  );

const MAX_PLAYERS_ON_PITCH = 11;

const getTeamEntities = (
  entities: Record<Id, TacticalEntity>,
  team: TeamSide,
): PlayerEntity[] =>
  Object.values(entities)
    .filter(isTeamEntity)
    .filter((entity) => entity.team === team);

const getTeamOnPitchCount = (
  frame: TimelineFrame,
  entities: Record<Id, TacticalEntity>,
  team: TeamSide,
): number =>
  getTeamEntities(entities, team).filter(
    (entity) => frame.entityStates[entity.id]?.visible ?? true,
  ).length;

const getFormationSortValue = (
  frame: TimelineFrame,
  player: PlayerEntity,
): Point => frame.entityStates[player.id]?.position ?? player.defaultPosition;

const sortPlayersForFormation = (
  players: PlayerEntity[],
  frame: TimelineFrame,
  team: TeamSide,
): PlayerEntity[] =>
  [...players].sort((a, b) => {
    const aPoint = getFormationSortValue(frame, a);
    const bPoint = getFormationSortValue(frame, b);
    const xDelta =
      team === "home" ? aPoint.x - bPoint.x : bPoint.x - aPoint.x;

    if (Math.abs(xDelta) > 0.05) {
      return xDelta;
    }

    const yDelta = aPoint.y - bPoint.y;
    if (Math.abs(yDelta) > 0.05) {
      return yDelta;
    }

    return a.number - b.number;
  });

const getVisiblePlayersForFormation = (
  frame: TimelineFrame,
  entities: Record<Id, TacticalEntity>,
  team: TeamSide,
): PlayerEntity[] =>
  sortPlayersForFormation(
    getTeamEntities(entities, team).filter(
      (entity) =>
        isOutfieldPlayerEntity(entity) &&
        (frame.entityStates[entity.id]?.visible ?? true),
    ),
    frame,
    team,
  );

const getGoalkeeperForFormation = (
  frame: TimelineFrame,
  entities: Record<Id, TacticalEntity>,
  team: TeamSide,
): (PlayerEntity & { kind: "goalkeeper" }) | undefined =>
  Object.values(entities)
    .filter(isGoalkeeperEntity)
    .filter((entity) => entity.team === team)
    .sort((a, b) => {
      const aVisible = Number(frame.entityStates[a.id]?.visible ?? true);
      const bVisible = Number(frame.entityStates[b.id]?.visible ?? true);

      if (aVisible !== bVisible) {
        return bVisible - aVisible;
      }

      return a.number - b.number;
    })[0];

const getReturnPositionForPlayer = (
  frame: TimelineFrame,
  entities: Record<Id, TacticalEntity>,
  player: PlayerEntity,
): Point => {
  const currentState = frame.entityStates[player.id];
  const currentPosition = currentState?.position ?? player.defaultPosition;

  if (player.isStarter ?? false) {
    return currentPosition;
  }

  const hasPlayedBefore =
    currentPosition.x !== player.defaultPosition.x ||
    currentPosition.y !== player.defaultPosition.y;

  if (hasPlayedBefore) {
    return currentPosition;
  }

  const openSlot = getTeamEntities(entities, player.team)
    .filter((entity) => entity.id !== player.id)
    .filter((entity) => !(frame.entityStates[entity.id]?.visible ?? true))
    .sort((a, b) => {
      const starterWeight =
        Number(Boolean(b.isStarter)) - Number(Boolean(a.isStarter));
      if (starterWeight !== 0) {
        return starterWeight;
      }

      return a.number - b.number;
    })[0];

  if (openSlot) {
    return frame.entityStates[openSlot.id]?.position ?? openSlot.defaultPosition;
  }

  return currentPosition;
};

type StoreSet = StoreApi<TacticalBoardStore>["setState"];
type StoreGet = StoreApi<TacticalBoardStore>["getState"];

const applyBoardMutation = (
  set: StoreSet,
  get: StoreGet,
  mutate: (draft: TacticalBoardSnapshot) => boolean | void,
): void => {
  const current = snapshotFromState(get());
  const draft = deepClone(current);
  const changed = mutate(draft);

  if (changed === false) {
    return;
  }

  set((state) => ({
    ...state,
    settings: draft.settings,
    entities: draft.entities,
    frames: draft.frames,
    activeFrameId: draft.activeFrameId,
    history: {
      ...state.history,
      past: [...state.history.past, current].slice(-state.history.limit),
      future: [],
    },
    playback: resetPlayback(state.playback),
  }));
};

const initialSnapshot = createInitialSnapshot();

export const useTacticalBoardStore = create<TacticalBoardStore>((set, get) => ({
  settings: initialSnapshot.settings,
  entities: initialSnapshot.entities,
  frames: initialSnapshot.frames,
  activeFrameId: initialSnapshot.activeFrameId,
  activeTool: "select",
  selection: {
    entityIds: [],
    overlayIds: [],
    activeEntityId: null,
    activeOverlayId: null,
  },
  history: {
    past: [],
    future: [],
    limit: HISTORY_LIMIT,
  },
  playback: deepClone(DEFAULT_PLAYBACK),

  setActiveTool: (tool) => {
    set((state) => ({
      ...state,
      activeTool: tool,
      selection:
        tool === "select"
          ? state.selection
          : {
              entityIds: [],
              overlayIds: [],
              activeEntityId: null,
              activeOverlayId: null,
            },
    }));
  },

  setSelection: (selection) => {
    set((state) => ({
      ...state,
      selection: {
        ...state.selection,
        ...selection,
      },
    }));
  },

  clearSelection: () => {
    set((state) => ({
      ...state,
      selection: {
        entityIds: [],
        overlayIds: [],
        activeEntityId: null,
        activeOverlayId: null,
      },
    }));
  },

  setBoardSettings: (updates) => {
    applyBoardMutation(set, get, (draft) => {
      const previousPreset = draft.settings.pitchPreset;
      const normalizedUpdates: Partial<BoardSettings> = {
        ...updates,
      };

      draft.settings = {
        ...draft.settings,
        ...normalizedUpdates,
        training: {
          ...draft.settings.training,
          ...(normalizedUpdates.training ?? {}),
        },
      };

      if (
        normalizedUpdates.pitchPreset &&
        normalizedUpdates.pitchPreset !== previousPreset
      ) {
        scaleSnapshotToPreset(
          draft,
          previousPreset,
          normalizedUpdates.pitchPreset,
        );
      }
    });
  },

  addEntity: (input) => {
    applyBoardMutation(set, get, (draft) => {
      const id = uuidv4();
      const kind = input.kind;
      let initialVisibility = true;

      let nextEntity: TacticalEntity;

      if (kind === "player" || kind === "goalkeeper") {
        const team = input.team ?? "home";
        const number = input.number ?? getNextTeamNumber(draft.entities, team);
        const isStarter = input.isStarter ?? true;
        initialVisibility = isStarter;
        nextEntity = {
          id,
          kind,
          team,
          number,
          name: input.name ?? `${team === "home" ? "H" : "A"}${number}`,
          label: input.label ?? `${number}`,
          color: input.color ?? (team === "home" ? "#2563eb" : "#f59e0b"),
          avatarUrl: input.avatarUrl,
          jerseyStyle:
            input.jerseyStyle ??
            (kind === "goalkeeper"
              ? "bordered"
              : team === "home"
                ? "striped"
                : "solid"),
          isStarter,
          radius: kind === "goalkeeper" ? 2.3 : 2.1,
          rotation: 0,
          defaultPosition: input.position,
        };
      } else {
        const defaults = EQUIPMENT_DEFAULTS[kind];

        nextEntity = {
          id,
          kind,
          label: input.label ?? defaults.label,
          color: input.color ?? defaults.color,
          radius: defaults.radius,
          rotation: 0,
          defaultPosition: input.position,
        };
      }

      draft.entities[id] = nextEntity;
      draft.frames.forEach((frame) => {
        frame.entityStates[id] = {
          ...createFrameEntityState(input.position),
          visible: initialVisibility,
        };
      });
    });
  },

  updateEntity: (entityId, updates) => {
    applyBoardMutation(set, get, (draft) => {
      const current = draft.entities[entityId];
      if (!current) {
        return false;
      }

      const nextEntity = {
        ...current,
        ...updates,
        id: current.id,
        kind: current.kind,
      } as TacticalEntity;

      draft.entities[entityId] = nextEntity;
    });
  },

  rotateEntity: (entityId, deltaDegrees, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const entity = draft.entities[entityId];
      if (!entity) {
        return false;
      }

      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const current = frame.entityStates[entityId];
      const basePosition = current?.position ?? entity.defaultPosition;
      const nextRotation = normalizeRotation(
        (current?.rotation ?? entity.rotation ?? 0) + deltaDegrees,
      );

      frame.entityStates[entityId] = {
        position: basePosition,
        rotation: nextRotation,
        visible: current?.visible ?? true,
      };
    });
  },

  moveEntity: (entityId, position, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const existing = frame.entityStates[entityId];
      frame.entityStates[entityId] = {
        position,
        rotation: existing?.rotation ?? 0,
        visible: existing?.visible ?? true,
      };
    });
  },

  removePlayerFromPitch: (playerId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const entity = draft.entities[playerId];
      if (!entity || !isTeamEntity(entity)) {
        return false;
      }

      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const current = frame.entityStates[playerId];
      if (!current || current.visible === false) {
        return false;
      }

      frame.entityStates[playerId] = {
        ...current,
        visible: false,
      };
    });
  },

  returnPlayerToPitch: (playerId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const entity = draft.entities[playerId];
      if (!entity || !isTeamEntity(entity)) {
        return false;
      }

      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const current = frame.entityStates[playerId];
      if (current?.visible === true) {
        return false;
      }

      if (
        getTeamOnPitchCount(frame, draft.entities, entity.team) >=
        MAX_PLAYERS_ON_PITCH
      ) {
        return false;
      }

      frame.entityStates[playerId] = {
        position: getReturnPositionForPlayer(frame, draft.entities, entity),
        rotation: current?.rotation ?? 0,
        visible: true,
      };
    });
  },

  placePlayerOnPitch: (playerId, position, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const entity = draft.entities[playerId];
      if (!entity || !isTeamEntity(entity)) {
        return false;
      }

      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const current = frame.entityStates[playerId];
      if (current?.visible === true) {
        return false;
      }

      if (
        getTeamOnPitchCount(frame, draft.entities, entity.team) >=
        MAX_PLAYERS_ON_PITCH
      ) {
        return false;
      }

      const dimensions =
        PITCH_PRESET_DIMENSIONS[draft.settings.pitchPreset] ?? PITCH_DIMENSIONS;

      frame.entityStates[playerId] = {
        position: {
          x: clamp(position.x, 0, dimensions.width),
          y: clamp(position.y, 0, dimensions.height),
        },
        rotation: current?.rotation ?? entity.rotation ?? 0,
        visible: true,
      };
    });
  },

  substitutePlayers: (benchPlayerId, fieldPlayerId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const benchPlayer = draft.entities[benchPlayerId];
      const fieldPlayer = draft.entities[fieldPlayerId];

      if (
        !benchPlayer ||
        !fieldPlayer ||
        !isTeamEntity(benchPlayer) ||
        !isTeamEntity(fieldPlayer) ||
        benchPlayer.team !== fieldPlayer.team ||
        benchPlayer.id === fieldPlayer.id
      ) {
        return false;
      }

      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const benchState = frame.entityStates[benchPlayerId] ?? {
        ...createFrameEntityState(benchPlayer.defaultPosition),
        visible: false,
      };
      const fieldState = frame.entityStates[fieldPlayerId] ?? {
        ...createFrameEntityState(fieldPlayer.defaultPosition),
        visible: true,
      };

      if (benchState.visible || !fieldState.visible) {
        return false;
      }

      frame.entityStates[benchPlayerId] = {
        ...benchState,
        position: fieldState.position,
        rotation: fieldState.rotation ?? 0,
        visible: true,
      };

      frame.entityStates[fieldPlayerId] = {
        ...fieldState,
        position: benchPlayer.defaultPosition,
        rotation: benchState.rotation ?? 0,
        visible: false,
      };
    });
  },

  removeEntity: (entityId) => {
    applyBoardMutation(set, get, (draft) => {
      const entity = draft.entities[entityId];
      if (!entity) {
        return false;
      }

      delete draft.entities[entityId];

      draft.frames.forEach((frame) => {
        const fallbackPoint =
          frame.entityStates[entityId]?.position ?? entity.defaultPosition;

        delete frame.entityStates[entityId];

        frame.overlays.lines = frame.overlays.lines.map((line) => ({
          ...line,
          start: convertAnchorAfterEntityDelete(
            line.start,
            entityId,
            fallbackPoint,
          ),
          end: convertAnchorAfterEntityDelete(
            line.end,
            entityId,
            fallbackPoint,
          ),
        }));
      });
    });

    set((state) => ({
      ...state,
      selection:
        state.selection.activeEntityId === entityId
          ? {
              ...state.selection,
              activeEntityId: null,
              entityIds: state.selection.entityIds.filter(
                (id) => id !== entityId,
              ),
            }
          : state.selection,
    }));
  },

  addLine: (input, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const startPoint = resolveAnchorPoint(input.start, frame, draft.entities);
      const endPoint = resolveAnchorPoint(input.end, frame, draft.entities);
      const defaults = createDefaultControlPoints(startPoint, endPoint);

      const line: TacticalLine = {
        id: uuidv4(),
        type: input.type,
        color: input.color ?? LINE_COLORS[input.type],
        width: input.width ?? 0.9,
        opacity: input.opacity ?? 1,
        start: input.start,
        end: input.end,
        controlPoint1: input.controlPoint1 ?? defaults.controlPoint1,
        controlPoint2: input.controlPoint2 ?? defaults.controlPoint2,
      };

      frame.overlays.lines = [...frame.overlays.lines, line];
    });
  },

  updateLine: (lineId, updates, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const lineIndex = frame.overlays.lines.findIndex(
        (line) => line.id === lineId,
      );
      if (lineIndex < 0) {
        return false;
      }

      const current = frame.overlays.lines[lineIndex];
      frame.overlays.lines[lineIndex] = {
        ...current,
        ...updates,
        id: current.id,
      };
    });
  },

  updateLineControlPoint: (lineId, controlPointKey, point, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const lineIndex = frame.overlays.lines.findIndex(
        (line) => line.id === lineId,
      );
      if (lineIndex < 0) {
        return false;
      }

      frame.overlays.lines[lineIndex] = {
        ...frame.overlays.lines[lineIndex],
        [controlPointKey]: point,
      };
    });
  },

  removeLine: (lineId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const beforeCount = frame.overlays.lines.length;
      frame.overlays.lines = frame.overlays.lines.filter(
        (line) => line.id !== lineId,
      );

      if (frame.overlays.lines.length === beforeCount) {
        return false;
      }
    });

    set((state) => ({
      ...state,
      selection:
        state.selection.activeOverlayId === lineId
          ? {
              ...state.selection,
              activeOverlayId: null,
              overlayIds: state.selection.overlayIds.filter(
                (id) => id !== lineId,
              ),
            }
          : state.selection,
    }));
  },

  addFreehand: (input, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame || input.points.length < 2) {
        return false;
      }

      frame.overlays.freehand.push({
        id: uuidv4(),
        points: input.points,
        color: input.color ?? "#0f172a",
        width: input.width ?? 0.7,
        opacity: input.opacity ?? 0.9,
      });
    });
  },

  updateFreehand: (strokeId, updates, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const index = frame.overlays.freehand.findIndex(
        (stroke) => stroke.id === strokeId,
      );
      if (index < 0) {
        return false;
      }

      frame.overlays.freehand[index] = {
        ...frame.overlays.freehand[index],
        ...updates,
        id: strokeId,
      };
    });
  },

  removeFreehand: (strokeId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const before = frame.overlays.freehand.length;
      frame.overlays.freehand = frame.overlays.freehand.filter(
        (stroke) => stroke.id !== strokeId,
      );
      if (frame.overlays.freehand.length === before) {
        return false;
      }
    });
  },

  addPolygon: (input, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame || input.points.length < 3) {
        return false;
      }

      frame.overlays.polygons.push({
        id: uuidv4(),
        points: input.points,
        label: input.label,
        stroke: input.stroke ?? "#22c55e",
        strokeWidth: input.strokeWidth ?? 0.42,
        fill: input.fill ?? "#22c55e",
        opacity: input.opacity ?? 0.22,
      });
    });
  },

  updatePolygon: (polygonId, updates, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const index = frame.overlays.polygons.findIndex(
        (polygon) => polygon.id === polygonId,
      );
      if (index < 0) {
        return false;
      }

      frame.overlays.polygons[index] = {
        ...frame.overlays.polygons[index],
        ...updates,
        id: polygonId,
      };
    });
  },

  removePolygon: (polygonId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const before = frame.overlays.polygons.length;
      frame.overlays.polygons = frame.overlays.polygons.filter(
        (polygon) => polygon.id !== polygonId,
      );
      if (frame.overlays.polygons.length === before) {
        return false;
      }
    });
  },

  addText: (input, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame || !input.text.trim()) {
        return false;
      }

      frame.overlays.texts.push({
        id: uuidv4(),
        text: input.text,
        position: input.position,
        color: input.color ?? "#e2e8f0",
        fontSize: input.fontSize ?? 2,
        align: input.align ?? "left",
        maxWidth: input.maxWidth,
      });
    });
  },

  updateText: (textId, updates, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const index = frame.overlays.texts.findIndex(
        (text) => text.id === textId,
      );
      if (index < 0) {
        return false;
      }

      frame.overlays.texts[index] = {
        ...frame.overlays.texts[index],
        ...updates,
        id: textId,
      };
    });
  },

  removeText: (textId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const before = frame.overlays.texts.length;
      frame.overlays.texts = frame.overlays.texts.filter(
        (text) => text.id !== textId,
      );
      if (frame.overlays.texts.length === before) {
        return false;
      }
    });
  },

  addRuler: (input, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      frame.overlays.rulers.push({
        id: uuidv4(),
        start: input.start,
        end: input.end,
        color: input.color ?? "#f8fafc",
        width: input.width ?? 0.4,
        unit: "m",
      });
    });
  },

  updateRuler: (rulerId, updates, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const index = frame.overlays.rulers.findIndex(
        (ruler) => ruler.id === rulerId,
      );
      if (index < 0) {
        return false;
      }

      frame.overlays.rulers[index] = {
        ...frame.overlays.rulers[index],
        ...updates,
        id: rulerId,
      };
    });
  },

  removeRuler: (rulerId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const before = frame.overlays.rulers.length;
      frame.overlays.rulers = frame.overlays.rulers.filter(
        (ruler) => ruler.id !== rulerId,
      );
      if (frame.overlays.rulers.length === before) {
        return false;
      }
    });
  },

  removeOverlayById: (overlayId, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const beforeCount =
        frame.overlays.lines.length +
        frame.overlays.freehand.length +
        frame.overlays.polygons.length +
        frame.overlays.texts.length +
        frame.overlays.rulers.length;

      frame.overlays.lines = frame.overlays.lines.filter(
        (line) => line.id !== overlayId,
      );
      frame.overlays.freehand = frame.overlays.freehand.filter(
        (stroke) => stroke.id !== overlayId,
      );
      frame.overlays.polygons = frame.overlays.polygons.filter(
        (polygon) => polygon.id !== overlayId,
      );
      frame.overlays.texts = frame.overlays.texts.filter(
        (text) => text.id !== overlayId,
      );
      frame.overlays.rulers = frame.overlays.rulers.filter(
        (ruler) => ruler.id !== overlayId,
      );

      const afterCount =
        frame.overlays.lines.length +
        frame.overlays.freehand.length +
        frame.overlays.polygons.length +
        frame.overlays.texts.length +
        frame.overlays.rulers.length;

      if (beforeCount === afterCount) {
        return false;
      }
    });

    set((state) => ({
      ...state,
      selection:
        state.selection.activeOverlayId === overlayId
          ? {
              ...state.selection,
              activeOverlayId: null,
              overlayIds: state.selection.overlayIds.filter(
                (id) => id !== overlayId,
              ),
            }
          : state.selection,
    }));
  },

  addFrame: (name) => {
    applyBoardMutation(set, get, (draft) => {
      const activeIndex = getFrameIndex(draft.frames, draft.activeFrameId);
      const sourceIndex = activeIndex >= 0 ? activeIndex : 0;
      const sourceFrame = draft.frames[sourceIndex];
      if (!sourceFrame) {
        return false;
      }

      const nextIndex = sourceIndex + 1;
      const nextFrame: TimelineFrame = {
        ...deepClone(sourceFrame),
        id: uuidv4(),
        name: name ?? `Quadro ${draft.frames.length + 1}`,
      };

      draft.frames.splice(nextIndex, 0, nextFrame);
      draft.activeFrameId = nextFrame.id;
    });
  },

  duplicateFrame: (frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const sourceId = frameId ?? draft.activeFrameId;
      const sourceIndex = getFrameIndex(draft.frames, sourceId);
      if (sourceIndex < 0) {
        return false;
      }

      const sourceFrame = draft.frames[sourceIndex];
      const clone: TimelineFrame = {
        ...deepClone(sourceFrame),
        id: uuidv4(),
        name: `${sourceFrame.name} Cópia`,
      };

      draft.frames.splice(sourceIndex + 1, 0, clone);
      draft.activeFrameId = clone.id;
    });
  },

  removeFrame: (frameId) => {
    applyBoardMutation(set, get, (draft) => {
      if (draft.frames.length <= 1) {
        return false;
      }

      const index = getFrameIndex(draft.frames, frameId);
      if (index < 0) {
        return false;
      }

      draft.frames.splice(index, 1);

      if (draft.activeFrameId === frameId) {
        const fallback = draft.frames[Math.max(index - 1, 0)];
        draft.activeFrameId = fallback.id;
      }
    });
  },

  setActiveFrame: (frameId) => {
    set((state) => {
      const exists = state.frames.some((frame) => frame.id === frameId);
      if (!exists) {
        return state;
      }

      return {
        ...state,
        activeFrameId: frameId,
        playback: resetPlayback(state.playback),
      };
    });
  },

  updateFrameDuration: (frameId, durationMs) => {
    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId);
      if (!frame) {
        return false;
      }

      frame.durationMs = clamp(durationMs, 300, 10000);
    });
  },

  applyFormation: (team, formation, frameId) => {
    if (!FORMATION_PRESETS.includes(formation)) {
      return;
    }

    applyBoardMutation(set, get, (draft) => {
      const frame = getFrameById(draft.frames, frameId ?? draft.activeFrameId);
      if (!frame) {
        return false;
      }

      const dimensions = getDimensionsByPreset(draft.settings.pitchPreset);

      const gk = getGoalkeeperForFormation(frame, draft.entities, team);
      const outfieldPlayers = getVisiblePlayersForFormation(
        frame,
        draft.entities,
        team,
      );

      const outfieldPositions = buildOutfieldPositions(
        formation,
        team,
        dimensions,
      );

      if (gk) {
        const gkOffset = (8 / 105) * dimensions.width;
        frame.entityStates[gk.id] = {
          ...frame.entityStates[gk.id],
          position:
            team === "home"
              ? { x: gkOffset, y: dimensions.height / 2 }
              : { x: dimensions.width - gkOffset, y: dimensions.height / 2 },
          rotation: frame.entityStates[gk.id]?.rotation ?? 0,
          visible: frame.entityStates[gk.id]?.visible ?? true,
        };
      }

      outfieldPlayers.forEach((player, index) => {
        const target = outfieldPositions[index];
        if (!target) {
          return;
        }

        frame.entityStates[player.id] = {
          ...frame.entityStates[player.id],
          position: target,
          rotation: frame.entityStates[player.id]?.rotation ?? 0,
          visible: frame.entityStates[player.id]?.visible ?? true,
        };
      });
    });
  },

  swapSides: () => {
    applyBoardMutation(set, get, (draft) => {
      const pitchWidth = getDimensionsByPreset(
        draft.settings.pitchPreset,
      ).width;

      Object.values(draft.entities).forEach((entity) => {
        if (isTeamEntity(entity)) {
          entity.defaultPosition = mirrorPoint(
            entity.defaultPosition,
            pitchWidth,
          );
        }
      });

      draft.frames.forEach((frame) => {
        Object.entries(frame.entityStates).forEach(
          ([entityId, entityState]) => {
            const entity = draft.entities[entityId];
            if (!entity || !isTeamEntity(entity)) {
              return;
            }

            frame.entityStates[entityId] = {
              ...entityState,
              position: mirrorPoint(entityState.position, pitchWidth),
            };
          },
        );

        frame.overlays = mirrorFrameOverlays(frame.overlays, pitchWidth);
      });
    });
  },

  play: () => {
    set((state) => {
      if (state.frames.length < 2) {
        return state;
      }

      const fromIndex = Math.max(
        0,
        getFrameIndex(state.frames, state.activeFrameId),
      );
      const fromFrameId = state.frames[fromIndex]?.id ?? state.frames[0].id;
      const toFrameId = getNextFrameId(
        state.frames,
        fromFrameId,
        state.playback.loop,
      );

      if (!toFrameId) {
        return state;
      }

      return {
        ...state,
        playback: {
          ...state.playback,
          isPlaying: true,
          fromFrameId,
          toFrameId,
          progress: 0,
        },
      };
    });
  },

  pause: () => {
    set((state) => ({
      ...state,
      playback: {
        ...state.playback,
        isPlaying: false,
      },
    }));
  },

  stop: () => {
    set((state) => ({
      ...state,
      playback: resetPlayback(state.playback),
    }));
  },

  tickPlayback: (deltaMs) => {
    set((state) => {
      if (
        !state.playback.isPlaying ||
        !state.playback.fromFrameId ||
        !state.playback.toFrameId
      ) {
        return state;
      }

      const fromFrame = getFrameById(state.frames, state.playback.fromFrameId);
      if (!fromFrame) {
        return {
          ...state,
          playback: resetPlayback(state.playback),
        };
      }

      const speed = clamp(state.playback.speed, 0.25, 3);
      const transitionDuration = Math.max(200, fromFrame.durationMs / speed);
      let progress = state.playback.progress + deltaMs / transitionDuration;
      let fromFrameId: Id | null = state.playback.fromFrameId;
      let toFrameId: Id | null = state.playback.toFrameId;
      let activeFrameId = state.activeFrameId;
      let isPlaying = true;

      while (progress >= 1 && isPlaying && fromFrameId && toFrameId) {
        progress -= 1;
        activeFrameId = toFrameId;
        fromFrameId = toFrameId;
        toFrameId = getNextFrameId(
          state.frames,
          fromFrameId,
          state.playback.loop,
        );

        if (!toFrameId) {
          isPlaying = false;
          fromFrameId = null;
          progress = 0;
        }
      }

      return {
        ...state,
        activeFrameId,
        playback: {
          ...state.playback,
          isPlaying,
          fromFrameId,
          toFrameId,
          progress,
        },
      };
    });
  },

  toggleLoop: () => {
    set((state) => ({
      ...state,
      playback: {
        ...state.playback,
        loop: !state.playback.loop,
      },
    }));
  },

  setPlaybackSpeed: (speed) => {
    set((state) => ({
      ...state,
      playback: {
        ...state.playback,
        speed: clamp(speed, 0.25, 3),
      },
    }));
  },

  undo: () => {
    set((state) => {
      if (state.history.past.length === 0) {
        return state;
      }

      const previous = state.history.past[state.history.past.length - 1];
      const currentSnapshot = snapshotFromState(state);

      return {
        ...state,
        settings: {
          ...deepClone(previous.settings),
          orientation: state.settings.orientation,
        },
        entities: deepClone(previous.entities),
        frames: deepClone(previous.frames),
        activeFrameId: previous.activeFrameId,
        selection: {
          entityIds: [],
          overlayIds: [],
          activeEntityId: null,
          activeOverlayId: null,
        },
        history: {
          ...state.history,
          past: state.history.past.slice(0, -1),
          future: [currentSnapshot, ...state.history.future].slice(
            0,
            state.history.limit,
          ),
        },
        playback: resetPlayback(state.playback),
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.history.future.length === 0) {
        return state;
      }

      const [next, ...remainingFuture] = state.history.future;
      const currentSnapshot = snapshotFromState(state);

      return {
        ...state,
        settings: {
          ...deepClone(next.settings),
          orientation: state.settings.orientation,
        },
        entities: deepClone(next.entities),
        frames: deepClone(next.frames),
        activeFrameId: next.activeFrameId,
        selection: {
          entityIds: [],
          overlayIds: [],
          activeEntityId: null,
          activeOverlayId: null,
        },
        history: {
          ...state.history,
          past: [...state.history.past, currentSnapshot].slice(
            -state.history.limit,
          ),
          future: remainingFuture,
        },
        playback: resetPlayback(state.playback),
      };
    });
  },

  resetBoard: () => {
    const fresh = createInitialSnapshot();
    set((state) => ({
      ...state,
      settings: {
        ...fresh.settings,
        orientation: state.settings.orientation,
      },
      entities: fresh.entities,
      frames: fresh.frames,
      activeFrameId: fresh.activeFrameId,
      selection: {
        entityIds: [],
        overlayIds: [],
        activeEntityId: null,
        activeOverlayId: null,
      },
      history: {
        ...state.history,
        past: [],
        future: [],
      },
      playback: deepClone(DEFAULT_PLAYBACK),
    }));
  },

  exportPlaybook: () => ({
    version: 2,
    savedAt: new Date().toISOString(),
    board: snapshotFromState(get()),
  }),

  importPlaybook: (payload) => {
    if (!payload.board || (payload.version !== 1 && payload.version !== 2)) {
      return;
    }

    const board = deepClone(payload.board);
    const settings: BoardSettings = {
      ...deepClone(DEFAULT_SETTINGS),
      ...board.settings,
      theme: "light",
      pitchPreset: "football-105x68",
      training: {
        ...deepClone(DEFAULT_SETTINGS.training),
        ...(board.settings.training ?? {}),
      },
    };
    const frames: TimelineFrame[] = board.frames.map((frame) => ({
      ...frame,
      overlays: ensureFrameOverlays(frame),
    }));

    set((state) => ({
      ...state,
      settings,
      entities: board.entities,
      frames,
      activeFrameId: board.activeFrameId,
      selection: {
        entityIds: [],
        overlayIds: [],
        activeEntityId: null,
        activeOverlayId: null,
      },
      history: {
        ...state.history,
        past: [],
        future: [],
      },
      playback: deepClone(DEFAULT_PLAYBACK),
    }));
  },

  getRenderableState: () => {
    const state = get();
    const activeFrame =
      getFrameById(state.frames, state.activeFrameId) ?? state.frames[0];

    if (!activeFrame) {
      return {
        frameId: "",
        positions: {},
        overlays: createEmptyOverlays(),
      };
    }

    if (
      state.playback.isPlaying &&
      state.playback.fromFrameId &&
      state.playback.toFrameId
    ) {
      const fromFrame = getFrameById(state.frames, state.playback.fromFrameId);
      const toFrame = getFrameById(state.frames, state.playback.toFrameId);
      if (fromFrame && toFrame) {
        const positions: Record<Id, Point> = {};
        const progress = clamp(state.playback.progress, 0, 1);

        Object.values(state.entities).forEach((entity) => {
          const fromPoint =
            fromFrame.entityStates[entity.id]?.position ??
            entity.defaultPosition;
          const toPoint =
            toFrame.entityStates[entity.id]?.position ?? fromPoint;
          positions[entity.id] = lerpPoint(fromPoint, toPoint, progress);
        });

        return {
          frameId: fromFrame.id,
          positions,
          overlays: fromFrame.overlays,
        };
      }
    }

    return {
      frameId: activeFrame.id,
      positions: getFramePositions(activeFrame, state.entities),
      overlays: activeFrame.overlays,
    };
  },
}));

export type { TacticalBoardStore };
