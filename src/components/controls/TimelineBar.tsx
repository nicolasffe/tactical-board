"use client";

import {
  Copy,
  Download,
  Pause,
  Play,
  Plus,
  Repeat,
  Square,
  Trash2,
} from "lucide-react";

import { useTacticalBoardStore } from "@/src/store";

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";

interface TimelineBarProps {
  onExportGif?: () => void;
  isExportingGif?: boolean;
  gifExportProgress?: number;
  gifExportError?: string | null;
}

export function TimelineBar({
  onExportGif,
  isExportingGif = false,
  gifExportProgress = 0,
  gifExportError = null,
}: TimelineBarProps) {
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const playback = useTacticalBoardStore((state) => state.playback);

  const setActiveFrame = useTacticalBoardStore((state) => state.setActiveFrame);
  const addFrame = useTacticalBoardStore((state) => state.addFrame);
  const duplicateFrame = useTacticalBoardStore((state) => state.duplicateFrame);
  const removeFrame = useTacticalBoardStore((state) => state.removeFrame);
  const updateFrameDuration = useTacticalBoardStore(
    (state) => state.updateFrameDuration,
  );
  const play = useTacticalBoardStore((state) => state.play);
  const pause = useTacticalBoardStore((state) => state.pause);
  const stop = useTacticalBoardStore((state) => state.stop);
  const toggleLoop = useTacticalBoardStore((state) => state.toggleLoop);
  const setPlaybackSpeed = useTacticalBoardStore(
    (state) => state.setPlaybackSpeed,
  );

  const activeFrame =
    frames.find((frame) => frame.id === activeFrameId) ?? frames[0];
  const gifButtonLabel = isExportingGif
    ? `${Math.round(gifExportProgress * 100)}%`
    : "GIF";

  return (
    <footer className="rounded-[22px] border border-slate-200/80 bg-white/96 p-2 shadow-[0_20px_52px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={iconButtonClass}
          onClick={() => addFrame()}
          title="Adicionar quadro"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          className={iconButtonClass}
          onClick={() => duplicateFrame()}
          title="Duplicar quadro"
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          disabled={frames.length <= 1 || !activeFrame}
          className={iconButtonClass}
          onClick={() => activeFrame && removeFrame(activeFrame.id)}
          title="Remover quadro"
        >
          <Trash2 size={15} />
        </button>

        {!playback.isPlaying ? (
          <button
            type="button"
            className={`${iconButtonClass} border-sky-200 bg-sky-50 text-sky-700`}
            onClick={play}
            title="Play"
          >
            <Play size={15} />
          </button>
        ) : (
          <button
            type="button"
            className={`${iconButtonClass} border-sky-200 bg-sky-50 text-sky-700`}
            onClick={pause}
            title="Pause"
          >
            <Pause size={15} />
          </button>
        )}

        <button
          type="button"
          className={iconButtonClass}
          onClick={stop}
          title="Parar"
        >
          <Square size={14} />
        </button>

        <button
          type="button"
          className={`${iconButtonClass} ${
            playback.loop ? "border-indigo-200 bg-indigo-50 text-indigo-700" : ""
          }`}
          onClick={toggleLoop}
          title="Loop"
        >
          <Repeat size={15} />
        </button>

        {onExportGif ? (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onExportGif}
            disabled={isExportingGif}
            title="Exportar animacao em GIF"
          >
            <Download size={14} />
            {gifButtonLabel}
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <input
            className="h-1.5 w-20 accent-sky-500"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={playback.speed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            title="Velocidade"
          />
          <span className="w-7 text-right text-[10px] font-semibold text-slate-600">
            {playback.speed.toFixed(1)}x
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5">
        {frames.map((frame, index) => {
          const isActive = frame.id === activeFrameId;
          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => setActiveFrame(frame.id)}
              className={`min-w-[76px] rounded-2xl border px-3 py-2 text-left transition ${
                isActive
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <p className="text-[10px] font-semibold">#{index + 1}</p>
              <p className="truncate text-[10px]">{frame.name}</p>
            </button>
          );
        })}

        {activeFrame && (
          <div className="ml-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <input
              className="h-8 w-20 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-300"
              type="number"
              min={300}
              max={10000}
              value={activeFrame.durationMs}
              onChange={(event) =>
                updateFrameDuration(
                  activeFrame.id,
                  Number(event.target.value) || 300,
                )
              }
              title="Duracao do quadro em ms"
            />
            <span className="text-[10px] font-semibold text-slate-500">ms</span>
          </div>
        )}
      </div>

      {gifExportError ? (
        <p className="mt-2 text-[11px] font-semibold text-rose-600">
          {gifExportError}
        </p>
      ) : null}
    </footer>
  );
}
