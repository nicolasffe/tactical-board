import type {
  PitchDimensions,
  PitchStyle,
  TrainingFieldLayout,
  UiTheme,
} from "@/src/types";

interface PitchLayerProps {
  dimensions: PitchDimensions;
  showGrid: boolean;
  showZones: boolean;
  trainingFieldLayout: TrainingFieldLayout;
  pitchStyle: PitchStyle;
  theme: UiTheme;
}

const penaltyAreaWidth = 16.5;
const penaltyAreaHeight = 40.32;
const goalAreaWidth = 5.5;
const goalAreaHeight = 18.32;
const goalFrameDepth = 2;
const goalFrameWidth = 7.32;
const centerCircleRadius = 9.15;

interface PitchPalette {
  surface: string;
  stripeA?: string;
  stripeB?: string;
  markings: string;
  grid: string;
  zonesStroke: string;
  zonesFill: string;
}

const getPitchPalette = (
  pitchStyle: PitchStyle,
  theme: UiTheme,
): PitchPalette => {
  if (pitchStyle === "tactical-pad") {
    return {
      surface: "#76a43f",
      stripeA: "rgba(232, 255, 188, 0.14)",
      stripeB: "rgba(40, 78, 32, 0.12)",
      markings:
        theme === "high-contrast" ? "#ffffff" : "rgba(236, 247, 218, 0.82)",
      grid: "rgba(236, 247, 218, 0.24)",
      zonesStroke: "rgba(236, 247, 218, 0.42)",
      zonesFill: "rgba(236, 247, 218, 0.1)",
    };
  }

  if (pitchStyle === "blueprint") {
    return {
      surface: "#0b2b4d",
      stripeA: "rgba(148, 200, 255, 0.06)",
      stripeB: "rgba(56, 139, 219, 0.12)",
      markings: theme === "high-contrast" ? "#ffffff" : "#a5d8ff",
      grid: "rgba(165, 216, 255, 0.22)",
      zonesStroke: "rgba(165, 216, 255, 0.5)",
      zonesFill: "rgba(59, 130, 246, 0.16)",
    };
  }

  if (pitchStyle === "minimal-light") {
    return {
      surface: "#f1f5f9",
      markings: "#334155",
      grid: "rgba(51, 65, 85, 0.14)",
      zonesStroke: "rgba(51, 65, 85, 0.26)",
      zonesFill: "rgba(148, 163, 184, 0.12)",
    };
  }

  if (pitchStyle === "minimal-dark") {
    return {
      surface: "#0f172a",
      markings: theme === "high-contrast" ? "#ffffff" : "#cbd5e1",
      grid: "rgba(148, 163, 184, 0.2)",
      zonesStroke: "rgba(203, 213, 225, 0.3)",
      zonesFill: "rgba(148, 163, 184, 0.12)",
    };
  }

  return {
    surface: "url(#pitchGradient)",
    stripeA: "rgba(255,255,255,0.1)",
    stripeB: "rgba(15,23,42,0.08)",
    markings: theme === "high-contrast" ? "#ffffff" : "rgba(248,250,252,0.94)",
    grid: "rgba(15,23,42,0.22)",
    zonesStroke: "rgba(15,23,42,0.32)",
    zonesFill: "rgba(248,250,252,0.08)",
  };
};

interface TrainingLayoutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const getTrainingLayoutLines = (
  layout: TrainingFieldLayout,
  inset: number,
  width: number,
  height: number,
): TrainingLayoutLine[] => {
  if (layout === "none") {
    return [];
  }

  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  const x = (ratio: number) => inset + innerWidth * ratio;
  const y = (ratio: number) => inset + innerHeight * ratio;
  const vertical = (
    ratio: number,
    start = 0,
    end = 1,
  ): TrainingLayoutLine => ({
    x1: x(ratio),
    y1: y(start),
    x2: x(ratio),
    y2: y(end),
  });
  const horizontal = (
    ratio: number,
    start = 0,
    end = 1,
  ): TrainingLayoutLine => ({
    x1: x(start),
    y1: y(ratio),
    x2: x(end),
    y2: y(ratio),
  });

  switch (layout) {
    case "vertical-halves":
      return [vertical(0.5)];
    case "horizontal-halves":
      return [horizontal(0.5)];
    case "horizontal-thirds":
      return [horizontal(1 / 3), horizontal(2 / 3)];
    case "horizontal-fourths":
      return [horizontal(0.25), horizontal(0.5), horizontal(0.75)];
    case "vertical-thirds":
      return [vertical(1 / 3), vertical(2 / 3)];
    case "vertical-fifths":
      return [vertical(0.2), vertical(0.4), vertical(0.6), vertical(0.8)];
    case "quarters":
      return [vertical(0.5), horizontal(0.5)];
    case "six-zones":
      return [vertical(1 / 3), vertical(2 / 3), horizontal(0.5)];
    case "central-corridor":
      return [vertical(0.34), vertical(0.66)];
    case "wide-channels":
      return [vertical(0.18), vertical(0.82)];
    case "attacking-third":
      return [vertical(2 / 3)];
    case "defensive-third":
      return [vertical(1 / 3)];
    case "attacking-channels":
      return [vertical(2 / 3), horizontal(1 / 3, 2 / 3, 1), horizontal(2 / 3, 2 / 3, 1)];
    case "defensive-channels":
      return [vertical(1 / 3), horizontal(1 / 3, 0, 1 / 3), horizontal(2 / 3, 0, 1 / 3)];
    default:
      return [];
  }
};

export function PitchLayer({
  dimensions,
  showGrid,
  showZones,
  trainingFieldLayout,
  pitchStyle,
  theme,
}: PitchLayerProps) {
  const width = dimensions.width;
  const height = dimensions.height;
  const scaleX = width / 105;
  const scaleY = height / 68;
  const scaledPenaltyAreaWidth = penaltyAreaWidth * scaleX;
  const scaledPenaltyAreaHeight = penaltyAreaHeight * scaleY;
  const scaledGoalAreaWidth = goalAreaWidth * scaleX;
  const scaledGoalAreaHeight = goalAreaHeight * scaleY;
  const scaledGoalFrameDepth = goalFrameDepth * scaleX;
  const scaledGoalFrameWidth = goalFrameWidth * scaleY;
  const scaledCenterCircleRadius =
    centerCircleRadius * Math.min(scaleX, scaleY);
  const scaledPenaltySpotDistance = 11 * scaleX;
  const goalTop = (height - scaledGoalFrameWidth) / 2;
  const goalBottom = goalTop + scaledGoalFrameWidth;
  const goalInset = 0.8;
  const goalVisualDepth = Math.max(1.4, scaledGoalFrameDepth + 0.5);
  const palette = getPitchPalette(pitchStyle, theme);
  const isTacticalPad = pitchStyle === "tactical-pad";
  const hasStripes =
    pitchStyle === "realistic-grass" ||
    pitchStyle === "blueprint" ||
    isTacticalPad;
  const stripePatternWidth = isTacticalPad ? 10.5 : 14;
  const stripeWidth = stripePatternWidth / 2;
  const stripeOpacity = isTacticalPad ? 0.9 : 0.52;
  const touchlineInset = isTacticalPad ? 0.95 : 0.8;
  const markingStrokeWidth = isTacticalPad ? 0.42 : 0.35;
  const goalLineOpacity = pitchStyle === "blueprint" ? 0.74 : 1;
  const leftPenaltySpotX = touchlineInset + scaledPenaltySpotDistance;
  const rightPenaltySpotX = width - touchlineInset - scaledPenaltySpotDistance;
  const penaltyArcRadius = centerCircleRadius * Math.min(scaleX, scaleY);
  const penaltyArcOffsetX = Math.max(
    0,
    scaledPenaltyAreaWidth - scaledPenaltySpotDistance,
  );
  const penaltyArcOffsetY = Math.sqrt(
    Math.max(0, penaltyArcRadius ** 2 - penaltyArcOffsetX ** 2),
  );
  const leftPenaltyArcX = touchlineInset + scaledPenaltyAreaWidth;
  const rightPenaltyArcX = width - touchlineInset - scaledPenaltyAreaWidth;
  const trainingLayoutStroke =
    isTacticalPad || pitchStyle === "realistic-grass"
      ? "rgba(236, 247, 218, 0.58)"
      : palette.zonesStroke;
  const trainingLayoutLines = getTrainingLayoutLines(
    trainingFieldLayout,
    touchlineInset,
    width,
    height,
  );

  return (
    <g>
      <defs>
        <linearGradient id="pitchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4f9767" />
          <stop offset="38%" stopColor="#3f8758" />
          <stop offset="100%" stopColor="#2f6947" />
        </linearGradient>

        <radialGradient id="pitchLight" cx="50%" cy="42%" r="72%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="58%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(15,23,42,0.12)" />
        </radialGradient>

        <pattern
          id="pitchStripes"
          width={stripePatternWidth}
          height={height}
          patternUnits="userSpaceOnUse"
        >
          <rect
            width={stripeWidth}
            height={height}
            fill={palette.stripeA ?? "rgba(255,255,255,0.06)"}
          />
          <rect
            x={stripeWidth}
            width={stripeWidth}
            height={height}
            fill={palette.stripeB ?? "transparent"}
          />
        </pattern>

        <pattern
          id="goalNetPattern"
          width="2.6"
          height="2.6"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 0 0 L 2.6 2.6 M 2.6 0 L 0 2.6"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="0.08"
          />
        </pattern>
      </defs>

      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={palette.surface}
        rx={1}
      />
      {hasStripes && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#pitchStripes)"
          opacity={stripeOpacity}
          rx={1}
        />
      )}
      {pitchStyle === "realistic-grass" && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#pitchLight)"
          opacity={0.95}
          rx={1}
        />
      )}

      <g>
        <g opacity={goalLineOpacity}>
          <rect
            x={goalInset}
            y={goalTop}
            width={goalVisualDepth}
            height={scaledGoalFrameWidth}
            fill="url(#goalNetPattern)"
            opacity={0.72}
          />
          <line
            x1={goalInset}
            y1={goalTop}
            x2={goalInset + goalVisualDepth}
            y2={goalTop}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={0.24}
          />
          <line
            x1={goalInset}
            y1={goalBottom}
            x2={goalInset + goalVisualDepth}
            y2={goalBottom}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={0.24}
          />
          <line
            x1={goalInset + goalVisualDepth}
            y1={goalTop}
            x2={goalInset + goalVisualDepth}
            y2={goalBottom}
            stroke="rgba(255,255,255,0.72)"
            strokeWidth={0.18}
          />
        </g>

        <g opacity={goalLineOpacity}>
          <rect
            x={width - goalInset - goalVisualDepth}
            y={goalTop}
            width={goalVisualDepth}
            height={scaledGoalFrameWidth}
            fill="url(#goalNetPattern)"
            opacity={0.72}
          />
          <line
            x1={width - goalInset - goalVisualDepth}
            y1={goalTop}
            x2={width - goalInset}
            y2={goalTop}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={0.24}
          />
          <line
            x1={width - goalInset - goalVisualDepth}
            y1={goalBottom}
            x2={width - goalInset}
            y2={goalBottom}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={0.24}
          />
          <line
            x1={width - goalInset - goalVisualDepth}
            y1={goalTop}
            x2={width - goalInset - goalVisualDepth}
            y2={goalBottom}
            stroke="rgba(255,255,255,0.72)"
            strokeWidth={0.18}
          />
        </g>
      </g>

      <g stroke={palette.markings} strokeWidth={markingStrokeWidth} fill="none">
        <rect
          x={touchlineInset}
          y={touchlineInset}
          width={width - touchlineInset * 2}
          height={height - touchlineInset * 2}
          rx={0.35}
        />
        <line
          x1={width / 2}
          y1={touchlineInset}
          x2={width / 2}
          y2={height - touchlineInset}
        />
        <circle cx={width / 2} cy={height / 2} r={scaledCenterCircleRadius} />
        <circle
          cx={width / 2}
          cy={height / 2}
          r={0.55}
          fill={palette.markings}
        />

        <rect
          x={touchlineInset}
          y={(height - scaledPenaltyAreaHeight) / 2}
          width={scaledPenaltyAreaWidth}
          height={scaledPenaltyAreaHeight}
        />
        <rect
          x={width - scaledPenaltyAreaWidth - touchlineInset}
          y={(height - scaledPenaltyAreaHeight) / 2}
          width={scaledPenaltyAreaWidth}
          height={scaledPenaltyAreaHeight}
        />

        <rect
          x={touchlineInset}
          y={(height - scaledGoalAreaHeight) / 2}
          width={scaledGoalAreaWidth}
          height={scaledGoalAreaHeight}
        />
        <rect
          x={width - scaledGoalAreaWidth - touchlineInset}
          y={(height - scaledGoalAreaHeight) / 2}
          width={scaledGoalAreaWidth}
          height={scaledGoalAreaHeight}
        />

        <circle
          cx={leftPenaltySpotX}
          cy={height / 2}
          r={0.45}
          fill={palette.markings}
        />
        <circle
          cx={rightPenaltySpotX}
          cy={height / 2}
          r={0.45}
          fill={palette.markings}
        />
        <path
          d={`M ${leftPenaltyArcX} ${height / 2 - penaltyArcOffsetY} A ${penaltyArcRadius} ${penaltyArcRadius} 0 0 1 ${leftPenaltyArcX} ${height / 2 + penaltyArcOffsetY}`}
        />
        <path
          d={`M ${rightPenaltyArcX} ${height / 2 - penaltyArcOffsetY} A ${penaltyArcRadius} ${penaltyArcRadius} 0 0 0 ${rightPenaltyArcX} ${height / 2 + penaltyArcOffsetY}`}
        />

        <rect
          x={goalInset}
          y={goalTop}
          width={scaledGoalFrameDepth}
          height={scaledGoalFrameWidth}
        />
        <rect
          x={width - scaledGoalFrameDepth - goalInset}
          y={goalTop}
          width={scaledGoalFrameDepth}
          height={scaledGoalFrameWidth}
        />
      </g>

      {showGrid && (
        <g stroke={palette.grid} strokeWidth={0.18}>
          {Array.from({ length: 10 }, (_, index) => {
            const x = ((index + 1) * width) / 11;
            return (
              <line key={`grid-v-${index}`} x1={x} y1={0} x2={x} y2={height} />
            );
          })}
          {Array.from({ length: 6 }, (_, index) => {
            const y = ((index + 1) * height) / 7;
            return (
              <line key={`grid-h-${index}`} x1={0} y1={y} x2={width} y2={y} />
            );
          })}
        </g>
      )}

      {showZones && (
        <g
          stroke={palette.zonesStroke}
          fill={palette.zonesFill}
          strokeWidth={0.28}
        >
          <rect x={0} y={0} width={width / 3} height={height} />
          <rect x={width / 3} y={0} width={width / 3} height={height} />
          <rect x={(2 * width) / 3} y={0} width={width / 3} height={height} />
        </g>
      )}

      {trainingLayoutLines.length > 0 && (
        <g
          stroke={trainingLayoutStroke}
          strokeWidth={isTacticalPad ? 0.32 : 0.26}
          strokeDasharray="1.6 1.35"
          strokeLinecap="round"
          fill="none"
          pointerEvents="none"
        >
          {trainingLayoutLines.map((line, index) => (
            <line
              key={`${trainingFieldLayout}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </g>
      )}
    </g>
  );
}
