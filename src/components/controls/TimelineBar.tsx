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
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";

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
  const controlsDisabled = isExportingGif;
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
          disabled={controlsDisabled}
          title="Adicionar quadro"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          className={iconButtonClass}
          onClick={() => duplicateFrame()}
          disabled={controlsDisabled}
          title="Duplicar quadro"
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          disabled={controlsDisabled || frames.length <= 1 || !activeFrame}
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
            disabled={controlsDisabled}
            title="Reproduzir"
          >
            <Play size={15} />
          </button>
        ) : (
          <button
            type="button"
            className={`${iconButtonClass} border-sky-200 bg-sky-50 text-sky-700`}
            onClick={pause}
            disabled={controlsDisabled}
            title="Pausar"
          >
            <Pause size={15} />
          </button>
        )}

        <button
          type="button"
          className={iconButtonClass}
          onClick={stop}
          disabled={controlsDisabled}
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
          disabled={controlsDisabled}
          title="Repetir em loop"
        >
          <Repeat size={15} />
        </button>

        {onExportGif ? (
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 sm:text-xs"
            onClick={onExportGif}
            disabled={isExportingGif}
            title="Exportar animação em GIF"
          >
            <Download size={14} />
            {gifButtonLabel}
          </button>
        ) : null}

        <div className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:ml-auto sm:w-auto sm:justify-normal">
          <input
            className="h-1.5 flex-1 accent-sky-500 sm:w-20 sm:flex-none"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={playback.speed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            disabled={controlsDisabled}
            title="Velocidade"
          />
          <span className="w-7 text-right text-[10px] font-semibold text-slate-600">
            {playback.speed.toFixed(1)}x
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
          <div className="flex items-center gap-2">
            {frames.map((frame, index) => {
              const isActive = frame.id === activeFrameId;
              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => setActiveFrame(frame.id)}
                  disabled={controlsDisabled}
                  className={`min-w-[76px] shrink-0 rounded-2xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
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
          </div>
        </div>

        {activeFrame && (
          <div className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:ml-auto sm:w-auto sm:justify-normal">
            <input
              className="h-8 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-sky-300 sm:w-20 sm:flex-none sm:text-xs"
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
              disabled={controlsDisabled}
              title="Duração do quadro em ms"
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
