import { PITCH_DIMENSIONS } from "@/src/types";

interface PitchLayerProps {
  showGrid: boolean;
  showZones: boolean;
}

const penaltyAreaWidth = 16.5;
const penaltyAreaHeight = 40.32;
const goalAreaWidth = 5.5;
const goalAreaHeight = 18.32;
const centerCircleRadius = 9.15;

export function PitchLayer({ showGrid, showZones }: PitchLayerProps) {
  const width = PITCH_DIMENSIONS.width;
  const height = PITCH_DIMENSIONS.height;

  return (
    <g>
      <defs>
        <linearGradient id="pitchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3d7a5e" />
          <stop offset="100%" stopColor="#2f664d" />
        </linearGradient>

        <pattern id="pitchStripes" width="14" height="68" patternUnits="userSpaceOnUse">
          <rect width="7" height="68" fill="rgba(255,255,255,0.06)" />
        </pattern>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill="url(#pitchGradient)" rx={1} />
      <rect x={0} y={0} width={width} height={height} fill="url(#pitchStripes)" opacity={0.45} rx={1} />

      <g stroke="rgba(248,250,252,0.94)" strokeWidth={0.35} fill="none">
        <rect x={0.8} y={0.8} width={width - 1.6} height={height - 1.6} rx={0.35} />
        <line x1={width / 2} y1={0.8} x2={width / 2} y2={height - 0.8} />
        <circle cx={width / 2} cy={height / 2} r={centerCircleRadius} />
        <circle cx={width / 2} cy={height / 2} r={0.55} fill="#f8fafc" />

        <rect
          x={0.8}
          y={(height - penaltyAreaHeight) / 2}
          width={penaltyAreaWidth}
          height={penaltyAreaHeight}
        />
        <rect
          x={width - penaltyAreaWidth - 0.8}
          y={(height - penaltyAreaHeight) / 2}
          width={penaltyAreaWidth}
          height={penaltyAreaHeight}
        />

        <rect
          x={0.8}
          y={(height - goalAreaHeight) / 2}
          width={goalAreaWidth}
          height={goalAreaHeight}
        />
        <rect
          x={width - goalAreaWidth - 0.8}
          y={(height - goalAreaHeight) / 2}
          width={goalAreaWidth}
          height={goalAreaHeight}
        />

        <circle cx={11} cy={height / 2} r={0.45} fill="#f8fafc" />
        <circle cx={width - 11} cy={height / 2} r={0.45} fill="#f8fafc" />
      </g>

      {showGrid && (
        <g stroke="rgba(15,23,42,0.22)" strokeWidth={0.18}>
          {Array.from({ length: 10 }, (_, index) => {
            const x = ((index + 1) * width) / 11;
            return <line key={`grid-v-${index}`} x1={x} y1={0} x2={x} y2={height} />;
          })}
          {Array.from({ length: 6 }, (_, index) => {
            const y = ((index + 1) * height) / 7;
            return <line key={`grid-h-${index}`} x1={0} y1={y} x2={width} y2={y} />;
          })}
        </g>
      )}

      {showZones && (
        <g stroke="rgba(15,23,42,0.32)" fill="rgba(248,250,252,0.08)" strokeWidth={0.28}>
          <rect x={0} y={0} width={width / 3} height={height} />
          <rect x={width / 3} y={0} width={width / 3} height={height} />
          <rect x={(2 * width) / 3} y={0} width={width / 3} height={height} />
        </g>
      )}
    </g>
  );
}
