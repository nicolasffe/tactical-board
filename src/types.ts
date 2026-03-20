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
export type BoardMode = "match" | "training";
export type BoardOrientation = "landscape" | "portrait-rotated";
export type PitchStyle =
  | "realistic-grass"
  | "blueprint"
  | "minimal-light"
  | "minimal-dark";
export type PitchPreset = "football-105x68" | "futsal-40x20" | "society-60x40";
export const PITCH_PRESET_DIMENSIONS: Record<PitchPreset, PitchDimensions> = {
  "football-105x68": { width: 105, height: 68 },
  "society-60x40": { width: 60, height: 40 },
  "futsal-40x20": { width: 40, height: 20 },
};
export type UiTheme = "light" | "dark" | "high-contrast";
export type TeamSide = "home" | "away";
export type EntityKind =
  | "player"
  | "goalkeeper"
  | "ball"
  | "cone"
  | "mannequin";
export type DrawTool =
  | "select"
  | "lasso"
  | "pass"
  | "run"
  | "dribble"
  | "freehand"
  | "polygon"
  | "text";
export type LineType = "pass" | "run" | "dribble";
export type ControlPointKey = "controlPoint1" | "controlPoint2";

export type FormationPreset =
  | "4-4-2"
  | "4-3-3"
  | "4-5-1"
  | "3-5-2"
  | "4-4-1-1"
  | "4-2-2-2"
  | "4-2-3-1"
  | "4-1-4-1"
  | "3-4-1-2"
  | "3-4-3"
  | "5-3-2"
  | "5-4-1";

export const FORMATION_PRESETS: readonly FormationPreset[] = [
  "4-4-2",
  "4-3-3",
  "4-5-1",
  "3-5-2",
  "4-4-1-1",
  "4-2-2-2",
  "4-2-3-1",
  "4-1-4-1",
  "3-4-1-2",
  "3-4-3",
  "5-3-2",
  "5-4-1",
];

export interface TrainingSettings {
  focus: "half-attacking" | "half-defending" | "full";
  visibleTeams: TeamSide[];
  emphasizeEquipment: boolean;
}

export interface BoardSettings {
  mode: BoardMode;
  orientation: BoardOrientation;
  pitchStyle: PitchStyle;
  pitchPreset: PitchPreset;
  theme: UiTheme;
  pitchView: PitchView;
  showGrid: boolean;
  showZones: boolean;
  showPlayerNames: boolean;
  snapToEntities: boolean;
  training: TrainingSettings;
}

export type JerseyStyle = "solid" | "striped" | "bordered";

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
  avatarUrl?: string;
  jerseyStyle?: JerseyStyle;
  isStarter?: boolean;
}

export interface BenchDragPreview {
  playerId: Id;
  playerName: string;
  playerNumber: number;
  team: TeamSide;
  color: string;
  jerseyStyle?: JerseyStyle;
  clientX: number;
  clientY: number;
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

export interface FreehandStroke {
  id: Id;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
}

export interface TacticalPolygon {
  id: Id;
  label?: string;
  points: Point[];
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity: number;
}

export interface TacticalText {
  id: Id;
  text: string;
  position: Point;
  color: string;
  fontSize: number;
  align: "left" | "center" | "right";
  maxWidth?: number;
}

export interface DistanceRuler {
  id: Id;
  start: AnchorTarget;
  end: AnchorTarget;
  color: string;
  width: number;
  unit: "m";
}

export interface FrameOverlays {
  lines: TacticalLine[];
  freehand: FreehandStroke[];
  polygons: TacticalPolygon[];
  texts: TacticalText[];
  rulers: DistanceRuler[];
}

export interface TimelineFrame {
  id: Id;
  name: string;
  durationMs: number;
  entityStates: Record<Id, FrameEntityState>;
  overlays: FrameOverlays;
}

export interface BoardSelection {
  entityIds: Id[];
  overlayIds: Id[];
  activeEntityId: Id | null;
  activeOverlayId: Id | null;
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
  overlays: FrameOverlays;
  frameId: Id;
}

export interface TacticalBoardExport {
  version: 2;
  savedAt: string;
  board: TacticalBoardSnapshot;
}

export interface TacticalBoardExportV1 {
  version: 1;
  savedAt: string;
  board: {
    settings: Omit<
      BoardSettings,
      | "mode"
      | "orientation"
      | "pitchStyle"
      | "pitchPreset"
      | "theme"
      | "training"
    > &
      Partial<
        Pick<
          BoardSettings,
          | "mode"
          | "orientation"
          | "pitchStyle"
          | "pitchPreset"
          | "theme"
          | "training"
        >
      >;
    entities: Record<Id, TacticalEntity>;
    frames: Array<
      Omit<TimelineFrame, "overlays"> & {
        lines?: TacticalLine[];
        overlays?: FrameOverlays;
      }
    >;
    activeFrameId: Id;
  };
}

export type TacticalBoardImport = TacticalBoardExport | TacticalBoardExportV1;

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
  avatarUrl?: string;
  jerseyStyle?: JerseyStyle;
  isStarter?: boolean;
}

export interface AddFreehandInput {
  points: Point[];
  color?: string;
  width?: number;
  opacity?: number;
}

export interface AddPolygonInput {
  points: Point[];
  label?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
}

export interface AddTextInput {
  position: Point;
  text: string;
  color?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number;
}

export interface AddRulerInput {
  start: AnchorTarget;
  end: AnchorTarget;
  color?: string;
  width?: number;
}
