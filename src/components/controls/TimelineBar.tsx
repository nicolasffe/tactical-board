"use client";

import {
  CircleGauge,
  Clapperboard,
  Clock,
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
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300/80 bg-white/94 text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45";

const controlGroupClass =
  "inline-flex min-w-0 items-center gap-1 rounded-lg border border-slate-300/80 bg-slate-50/90 p-1 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.38)]";

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
    <footer className="rounded-lg border border-slate-300/80 bg-white/96 p-2 shadow-[0_20px_52px_-32px_rgba(15,23,42,0.48)] ring-1 ring-white/70 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className={controlGroupClass}>
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
        </div>

        <div className={controlGroupClass}>
          {!playback.isPlaying ? (
            <button
              type="button"
              className="inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md border border-teal-300 bg-teal-50 px-3 text-teal-800 shadow-sm transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={play}
              disabled={controlsDisabled}
              title="Reproduzir"
            >
              <Play size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md border border-teal-300 bg-teal-50 px-3 text-teal-800 shadow-sm transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-45"
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
              playback.loop
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : ""
            }`}
            onClick={toggleLoop}
            disabled={controlsDisabled}
            title="Repetir em loop"
          >
            <Repeat size={15} />
          </button>
        </div>

        {onExportGif ? (
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300/80 bg-white/94 px-3 text-[11px] font-semibold text-slate-700 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.38)] transition hover:border-teal-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 sm:text-xs"
            onClick={onExportGif}
            disabled={isExportingGif}
            title="Exportar animação em GIF"
          >
            <Download size={14} />
            {gifButtonLabel}
          </button>
        ) : null}

        <div className="flex h-10 w-full min-w-[180px] items-center gap-2 rounded-lg border border-slate-300/80 bg-white/94 px-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.38)] sm:ml-auto sm:w-auto">
          <CircleGauge size={14} className="shrink-0 text-slate-500" />
          <input
            className="h-1.5 flex-1 accent-sky-500 sm:w-24 sm:flex-none"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={playback.speed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            disabled={controlsDisabled}
            title="Velocidade"
          />
          <span className="w-8 text-right text-[10px] font-semibold text-slate-600">
            {playback.speed.toFixed(1)}x
          </span>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-slate-300/80 bg-slate-50/85 p-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-white/84 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 ring-1 ring-slate-200/85">
            <Clapperboard size={13} />
            Quadros
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
            <div className="flex items-center gap-1.5">
              {frames.map((frame, index) => {
                const isActive = frame.id === activeFrameId;
                return (
                  <button
                    key={frame.id}
                    type="button"
                    onClick={() => setActiveFrame(frame.id)}
                    disabled={controlsDisabled}
                    className={`relative h-10 min-w-[78px] shrink-0 overflow-hidden rounded-md border px-2.5 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      isActive
                        ? "border-teal-300 bg-white text-slate-950 shadow-sm ring-1 ring-teal-100"
                        : "border-slate-300/80 bg-white/76 text-slate-600 hover:border-teal-300 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`absolute inset-x-2 top-1 h-0.5 rounded-full ${
                        isActive ? "bg-teal-500" : "bg-slate-300"
                      }`}
                      aria-hidden="true"
                    />
                    <p className="pt-1 text-[10px] font-bold leading-none">
                      #{index + 1}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] leading-none">
                      {frame.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {activeFrame && (
            <label className="flex h-9 w-full min-w-[150px] items-center gap-2 rounded-md border border-slate-300/80 bg-white/94 px-2.5 shadow-sm sm:w-auto">
              <Clock size={13} className="shrink-0 text-slate-500" />
              <input
                className="h-7 min-w-0 flex-1 rounded-md border border-slate-300/80 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-teal-300 sm:w-20 sm:flex-none sm:text-xs"
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
              <span className="text-[10px] font-semibold text-slate-500">
                ms
              </span>
            </label>
          )}
        </div>
      </div>

      {gifExportError ? (
        <p className="mt-2 text-[11px] font-semibold text-rose-600">
          {gifExportError}
        </p>
      ) : null}
    </footer>
  );
}
