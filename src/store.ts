"use client";

import { create } from "zustand";
import type { StoreApi } from "zustand";
import { v4 as uuidv4 } from "uuid";

import type {
  AddEntityInput,
  AnchorTarget,
  BoardHistory,
  BoardSelection,
  BoardSettings,
  ControlPointKey,
  FormationPreset,
  FrameEntityState,
  Id,
  NewLineInput,
  PlaybackState,
  Point,
  PlayerEntity,
  RenderBoardState,
  TacticalBoardExport,
  TacticalBoardSnapshot,
  TacticalEntity,
  TacticalLine,
  TeamSide,
  TimelineFrame,
} from "./types";
import {
  FORMATION_PRESETS,
  PITCH_DIMENSIONS,
} from "./types";

const HISTORY_LIMIT = 100;

const LINE_COLORS: Record<TacticalLine["type"], string> = {
  pass: "#19d3c5",
  run: "#2f6bff",
  dribble: "#f59e0b",
};

const DEFAULT_SETTINGS: BoardSettings = {
  pitchView: "full",
  showGrid: false,
  showZones: false,
  showPlayerNames: false,
  snapToEntities: true,
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
  activeTool: "select" | "pass" | "run" | "dribble";
  selection: BoardSelection;
  history: BoardHistory;
  playback: PlaybackState;
  setActiveTool: (tool: TacticalBoardStore["activeTool"]) => void;
  setSelection: (selection: Partial<BoardSelection>) => void;
  clearSelection: () => void;
  setBoardSettings: (updates: Partial<BoardSettings>) => void;
  addEntity: (input: AddEntityInput) => void;
  updateEntity: (entityId: Id, updates: Partial<TacticalEntity>) => void;
  moveEntity: (entityId: Id, position: Point, frameId?: Id) => void;
  removePlayerFromPitch: (playerId: Id, frameId?: Id) => void;
  returnPlayerToPitch: (playerId: Id, frameId?: Id) => void;
  removeEntity: (entityId: Id) => void;
  addLine: (input: NewLineInput, frameId?: Id) => void;
  updateLine: (lineId: Id, updates: Partial<TacticalLine>, frameId?: Id) => void;
  updateLineControlPoint: (
    lineId: Id,
    controlPointKey: ControlPointKey,
    point: Point,
    frameId?: Id,
  ) => void;
  removeLine: (lineId: Id, frameId?: Id) => void;
  addFrame: (name?: string) => void;
  duplicateFrame: (frameId?: Id) => void;
  removeFrame: (frameId: Id) => void;
  setActiveFrame: (frameId: Id) => void;
  updateFrameDuration: (frameId: Id, durationMs: number) => void;
  applyFormation: (team: TeamSide, formation: FormationPreset, frameId?: Id) => void;
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
  importPlaybook: (payload: TacticalBoardExport) => void;
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
): entity is PlayerEntity & { kind: "player" } =>
  entity.kind === "player";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const lerpPoint = (from: Point, to: Point, t: number): Point => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
});

const deepClone = <T,>(value: T): T => structuredClone(value);

const createFrameEntityState = (position: Point): FrameEntityState => ({
  position,
  rotation: 0,
  visible: true,
});

const mirrorForAway = (point: Point): Point => ({
  x: PITCH_DIMENSIONS.width - point.x,
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
): Point[] => {
  const rows = parseFormation(formation);
  const lineStartX = 22;
  const lineEndX = 70;
  const spacing = rows.length > 1 ? (lineEndX - lineStartX) / (rows.length - 1) : 0;

  const positions = rows.flatMap((count, rowIndex) => {
    const x = lineStartX + spacing * rowIndex;
    const laneGap = PITCH_DIMENSIONS.height / (count + 1);
    return Array.from({ length: count }, (_, laneIndex) => ({
      x,
      y: laneGap * (laneIndex + 1),
    }));
  });

  return team === "away" ? positions.map(mirrorForAway) : positions;
};

const buildTeamEntities = (
  team: TeamSide,
  formation: FormationPreset,
  color: string,
): TacticalEntity[] => {
  const sidePrefix = team === "home" ? "H" : "A";
  const goalkeeperPoint = team === "home" ? { x: 8, y: 34 } : { x: 97, y: 34 };
  const outfieldPositions = buildOutfieldPositions(formation, team);

  const goalkeeper: TacticalEntity = {
    id: `${team}-gk`,
    kind: "goalkeeper",
    label: `${sidePrefix}1`,
    team,
    number: 1,
    name: `${sidePrefix} GK`,
    color,
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
      radius: 2.1,
      rotation: 0,
      defaultPosition: position,
    } satisfies TacticalEntity;
  });

  return [goalkeeper, ...outfield];
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
      createFrameEntityState(deepClone(entity.defaultPosition)),
    ]),
  );

const createFrame = (
  name: string,
  entities: Record<Id, TacticalEntity>,
  durationMs = 1800,
): TimelineFrame => ({
  id: uuidv4(),
  name,
  durationMs,
  entityStates: createFrameStatesFromEntities(entities),
  lines: [],
});

const createInitialSnapshot = (): TacticalBoardSnapshot => {
  const entities = toEntityMap([
    ...buildTeamEntities("home", "4-3-3", "#19d3c5"),
    ...buildTeamEntities("away", "4-4-2", "#2f6bff"),
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

const snapshotFromState = (state: TacticalBoardStore): TacticalBoardSnapshot => ({
  settings: deepClone(state.settings),
  entities: deepClone(state.entities),
  frames: deepClone(state.frames),
  activeFrameId: state.activeFrameId,
});

const getFrameIndex = (frames: TimelineFrame[], frameId: Id): number =>
  frames.findIndex((frame) => frame.id === frameId);

const getFrameById = (frames: TimelineFrame[], frameId: Id): TimelineFrame | undefined =>
  frames.find((frame) => frame.id === frameId);

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

const createDefaultControlPoints = (start: Point, end: Point): Pick<TacticalLine, "controlPoint1" | "controlPoint2"> => ({
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
    return loop ? frames[0]?.id ?? null : null;
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
    entityId: null,
    lineId: null,
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
      selection: tool === "select" ? state.selection : { entityId: null, lineId: null },
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
        entityId: null,
        lineId: null,
      },
    }));
  },

  setBoardSettings: (updates) => {
    applyBoardMutation(set, get, (draft) => {
      draft.settings = {
        ...draft.settings,
        ...updates,
      };
    });
  },

  addEntity: (input) => {
    applyBoardMutation(set, get, (draft) => {
      const id = uuidv4();
      const kind = input.kind;

      let nextEntity: TacticalEntity;

      if (kind === "player" || kind === "goalkeeper") {
        const team = input.team ?? "home";
        const number = input.number ?? getNextTeamNumber(draft.entities, team);
        nextEntity = {
          id,
          kind,
          team,
          number,
          name: input.name ?? `${team === "home" ? "H" : "A"}${number}`,
          label: input.label ?? `${number}`,
          color: input.color ?? (team === "home" ? "#19d3c5" : "#2f6bff"),
          radius: kind === "goalkeeper" ? 2.3 : 2.1,
          rotation: 0,
          defaultPosition: input.position,
        };
      } else {
        nextEntity = {
          id,
          kind,
          label:
            input.label ??
            (kind === "ball" ? "Bola" : kind === "cone" ? "Cone" : "Manequim"),
          color:
            input.color ??
            (kind === "ball"
              ? "#f8fafc"
              : kind === "cone"
                ? "#fb923c"
                : "#94a3b8"),
          radius: kind === "ball" ? 1.2 : kind === "cone" ? 1.4 : 1.8,
          rotation: 0,
          defaultPosition: input.position,
        };
      }

      draft.entities[id] = nextEntity;
      draft.frames.forEach((frame) => {
        frame.entityStates[id] = createFrameEntityState(input.position);
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

      frame.entityStates[playerId] = {
        position: current?.position ?? entity.defaultPosition,
        rotation: current?.rotation ?? 0,
        visible: true,
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

        frame.lines = frame.lines.map((line) => ({
          ...line,
          start: convertAnchorAfterEntityDelete(line.start, entityId, fallbackPoint),
          end: convertAnchorAfterEntityDelete(line.end, entityId, fallbackPoint),
        }));
      });
    });

    set((state) => ({
      ...state,
      selection:
        state.selection.entityId === entityId
          ? { ...state.selection, entityId: null }
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

      frame.lines = [...frame.lines, line];
    });
  },

  updateLine: (lineId, updates, frameId) => {
    applyBoardMutation(set, get, (draft) => {
      const targetFrameId = frameId ?? draft.activeFrameId;
      const frame = getFrameById(draft.frames, targetFrameId);
      if (!frame) {
        return false;
      }

      const lineIndex = frame.lines.findIndex((line) => line.id === lineId);
      if (lineIndex < 0) {
        return false;
      }

      const current = frame.lines[lineIndex];
      frame.lines[lineIndex] = {
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

      const lineIndex = frame.lines.findIndex((line) => line.id === lineId);
      if (lineIndex < 0) {
        return false;
      }

      frame.lines[lineIndex] = {
        ...frame.lines[lineIndex],
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

      const beforeCount = frame.lines.length;
      frame.lines = frame.lines.filter((line) => line.id !== lineId);

      if (frame.lines.length === beforeCount) {
        return false;
      }
    });

    set((state) => ({
      ...state,
      selection:
        state.selection.lineId === lineId
          ? { ...state.selection, lineId: null }
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

      const gk = Object.values(draft.entities).find(
        (entity) => isGoalkeeperEntity(entity) && entity.team === team,
      );

      const outfieldPlayers = Object.values(draft.entities)
        .filter(isOutfieldPlayerEntity)
        .filter((entity) => entity.team === team)
        .sort((a, b) => a.number - b.number);

      const outfieldPositions = buildOutfieldPositions(formation, team);

      if (gk) {
        frame.entityStates[gk.id] = {
          ...frame.entityStates[gk.id],
          position: team === "home" ? { x: 8, y: 34 } : { x: 97, y: 34 },
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

  play: () => {
    set((state) => {
      if (state.frames.length < 2) {
        return state;
      }

      const fromIndex = Math.max(0, getFrameIndex(state.frames, state.activeFrameId));
      const fromFrameId = state.frames[fromIndex]?.id ?? state.frames[0].id;
      const toFrameId = getNextFrameId(state.frames, fromFrameId, state.playback.loop);

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
        toFrameId = getNextFrameId(state.frames, fromFrameId, state.playback.loop);

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
        settings: deepClone(previous.settings),
        entities: deepClone(previous.entities),
        frames: deepClone(previous.frames),
        activeFrameId: previous.activeFrameId,
        selection: { entityId: null, lineId: null },
        history: {
          ...state.history,
          past: state.history.past.slice(0, -1),
          future: [currentSnapshot, ...state.history.future].slice(0, state.history.limit),
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
        settings: deepClone(next.settings),
        entities: deepClone(next.entities),
        frames: deepClone(next.frames),
        activeFrameId: next.activeFrameId,
        selection: { entityId: null, lineId: null },
        history: {
          ...state.history,
          past: [...state.history.past, currentSnapshot].slice(-state.history.limit),
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
      settings: fresh.settings,
      entities: fresh.entities,
      frames: fresh.frames,
      activeFrameId: fresh.activeFrameId,
      selection: { entityId: null, lineId: null },
      history: {
        ...state.history,
        past: [],
        future: [],
      },
      playback: deepClone(DEFAULT_PLAYBACK),
    }));
  },

  exportPlaybook: () => ({
    version: 1,
    savedAt: new Date().toISOString(),
    board: snapshotFromState(get()),
  }),

  importPlaybook: (payload) => {
    if (payload.version !== 1 || !payload.board) {
      return;
    }

    const board = deepClone(payload.board);
    set((state) => ({
      ...state,
      settings: board.settings,
      entities: board.entities,
      frames: board.frames,
      activeFrameId: board.activeFrameId,
      selection: { entityId: null, lineId: null },
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
        lines: [],
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
            fromFrame.entityStates[entity.id]?.position ?? entity.defaultPosition;
          const toPoint =
            toFrame.entityStates[entity.id]?.position ?? fromPoint;
          positions[entity.id] = lerpPoint(fromPoint, toPoint, progress);
        });

        return {
          frameId: fromFrame.id,
          positions,
          lines: fromFrame.lines,
        };
      }
    }

    return {
      frameId: activeFrame.id,
      positions: getFramePositions(activeFrame, state.entities),
      lines: activeFrame.lines,
    };
  },
}));

export type { TacticalBoardStore };
