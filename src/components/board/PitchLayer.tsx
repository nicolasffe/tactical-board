import type { PitchDimensions, PitchStyle, UiTheme } from "@/src/types";

interface PitchLayerProps {
  dimensions: PitchDimensions;
  showGrid: boolean;
  showZones: boolean;
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
    stripeA: "rgba(255,255,255,0.06)",
    markings: theme === "high-contrast" ? "#ffffff" : "rgba(248,250,252,0.94)",
    grid: "rgba(15,23,42,0.22)",
    zonesStroke: "rgba(15,23,42,0.32)",
    zonesFill: "rgba(248,250,252,0.08)",
  };
};

export function PitchLayer({
  dimensions,
  showGrid,
  showZones,
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
  const palette = getPitchPalette(pitchStyle, theme);
  const hasStripes =
    pitchStyle === "realistic-grass" || pitchStyle === "blueprint";

  return (
    <g>
      <defs>
        <linearGradient id="pitchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3d7a5e" />
          <stop offset="100%" stopColor="#2f664d" />
        </linearGradient>

        <pattern
          id="pitchStripes"
          width="14"
          height="68"
          patternUnits="userSpaceOnUse"
        >
          <rect
            width="7"
            height="68"
            fill={palette.stripeA ?? "rgba(255,255,255,0.06)"}
          />
          <rect
            x="7"
            width="7"
            height="68"
            fill={palette.stripeB ?? "transparent"}
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
          opacity={0.45}
          rx={1}
        />
      )}

      <g stroke={palette.markings} strokeWidth={0.35} fill="none">
        <rect
          x={0.8}
          y={0.8}
          width={width - 1.6}
          height={height - 1.6}
          rx={0.35}
        />
        <line x1={width / 2} y1={0.8} x2={width / 2} y2={height - 0.8} />
        <circle cx={width / 2} cy={height / 2} r={scaledCenterCircleRadius} />
        <circle
          cx={width / 2}
          cy={height / 2}
          r={0.55}
          fill={palette.markings}
        />

        <rect
          x={0.8}
          y={(height - scaledPenaltyAreaHeight) / 2}
          width={scaledPenaltyAreaWidth}
          height={scaledPenaltyAreaHeight}
        />
        <rect
          x={width - scaledPenaltyAreaWidth - 0.8}
          y={(height - scaledPenaltyAreaHeight) / 2}
          width={scaledPenaltyAreaWidth}
          height={scaledPenaltyAreaHeight}
        />

        <rect
          x={0.8}
          y={(height - scaledGoalAreaHeight) / 2}
          width={scaledGoalAreaWidth}
          height={scaledGoalAreaHeight}
        />
        <rect
          x={width - scaledGoalAreaWidth - 0.8}
          y={(height - scaledGoalAreaHeight) / 2}
          width={scaledGoalAreaWidth}
          height={scaledGoalAreaHeight}
        />

        <circle
          cx={scaledPenaltySpotDistance}
          cy={height / 2}
          r={0.45}
          fill={palette.markings}
        />
        <circle
          cx={width - scaledPenaltySpotDistance}
          cy={height / 2}
          r={0.45}
          fill={palette.markings}
        />

        <rect
          x={0.8}
          y={(height - scaledGoalFrameWidth) / 2}
          width={scaledGoalFrameDepth}
          height={scaledGoalFrameWidth}
        />
        <rect
          x={width - scaledGoalFrameDepth - 0.8}
          y={(height - scaledGoalFrameWidth) / 2}
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
    </g>
  );
}
