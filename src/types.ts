export type Id = string;

export interface Point {
  x: number;
  y: number;
}

export interface PitchDimensions {
  width: number;
  height: number;
}

export const PITCH_DIMENSIONS: PitchDimensions = {
  width: 105,
  height: 68,
};

export type PitchView = "full" | "half";
export type TeamSide = "home" | "away";
export type EntityKind = "player" | "goalkeeper" | "ball" | "cone" | "mannequin";
export type DrawTool = "select" | "pass" | "run" | "dribble";
export type LineType = "pass" | "run" | "dribble";
export type ControlPointKey = "controlPoint1" | "controlPoint2";

export type FormationPreset = "4-4-2" | "4-3-3" | "3-5-2" | "4-2-3-1";

export const FORMATION_PRESETS: readonly FormationPreset[] = [
  "4-4-2",
  "4-3-3",
  "3-5-2",
  "4-2-3-1",
];

export interface BoardSettings {
  pitchView: PitchView;
  showGrid: boolean;
  showZones: boolean;
  showPlayerNames: boolean;
  snapToEntities: boolean;
}

interface TacticalEntityBase {
  id: Id;
  kind: EntityKind;
  label: string;
  color: string;
  radius: number;
  rotation: number;
  defaultPosition: Point;
  locked?: boolean;
}

export interface PlayerEntity extends TacticalEntityBase {
  kind: "player" | "goalkeeper";
  team: TeamSide;
  number: number;
  name: string;
}

export interface EquipmentEntity extends TacticalEntityBase {
  kind: "ball" | "cone" | "mannequin";
}

export type TacticalEntity = PlayerEntity | EquipmentEntity;

export interface FrameEntityState {
  position: Point;
  rotation: number;
  visible: boolean;
}

export type AnchorTarget =
  | {
      kind: "entity";
      entityId: Id;
      offset?: Point;
    }
  | {
      kind: "free";
      point: Point;
    };

export interface TacticalLine {
  id: Id;
  type: LineType;
  color: string;
  width: number;
  opacity: number;
  start: AnchorTarget;
  end: AnchorTarget;
  controlPoint1: Point;
  controlPoint2: Point;
}

export interface TimelineFrame {
  id: Id;
  name: string;
  durationMs: number;
  entityStates: Record<Id, FrameEntityState>;
  lines: TacticalLine[];
}

export interface BoardSelection {
  entityId: Id | null;
  lineId: Id | null;
}

export interface PlaybackState {
  isPlaying: boolean;
  fromFrameId: Id | null;
  toFrameId: Id | null;
  progress: number;
  loop: boolean;
  speed: number;
}

export interface TacticalBoardSnapshot {
  settings: BoardSettings;
  entities: Record<Id, TacticalEntity>;
  frames: TimelineFrame[];
  activeFrameId: Id;
}

export interface BoardHistory {
  past: TacticalBoardSnapshot[];
  future: TacticalBoardSnapshot[];
  limit: number;
}

export interface RenderBoardState {
  positions: Record<Id, Point>;
  lines: TacticalLine[];
  frameId: Id;
}

export interface TacticalBoardExport {
  version: 1;
  savedAt: string;
  board: TacticalBoardSnapshot;
}

export interface NewLineInput {
  type: LineType;
  color?: string;
  width?: number;
  start: AnchorTarget;
  end: AnchorTarget;
  controlPoint1?: Point;
  controlPoint2?: Point;
  opacity?: number;
}

export interface AddEntityInput {
  kind: EntityKind;
  position: Point;
  team?: TeamSide;
  number?: number;
  name?: string;
  label?: string;
  color?: string;
}
