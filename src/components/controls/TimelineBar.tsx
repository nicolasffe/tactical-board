"use client";

import {
  Copy,
  Pause,
  Play,
  Plus,
  Repeat,
  Square,
  Trash2,
} from "lucide-react";

import { useTacticalBoardStore } from "@/src/store";

const controlButton =
  "inline-flex items-center gap-2 rounded-md border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800";

export function TimelineBar() {
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const playback = useTacticalBoardStore((state) => state.playback);

  const setActiveFrame = useTacticalBoardStore((state) => state.setActiveFrame);
  const addFrame = useTacticalBoardStore((state) => state.addFrame);
  const duplicateFrame = useTacticalBoardStore((state) => state.duplicateFrame);
  const removeFrame = useTacticalBoardStore((state) => state.removeFrame);
  const updateFrameDuration = useTacticalBoardStore((state) => state.updateFrameDuration);
  const play = useTacticalBoardStore((state) => state.play);
  const pause = useTacticalBoardStore((state) => state.pause);
  const stop = useTacticalBoardStore((state) => state.stop);
  const toggleLoop = useTacticalBoardStore((state) => state.toggleLoop);
  const setPlaybackSpeed = useTacticalBoardStore((state) => state.setPlaybackSpeed);

  const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0];

  return (
    <footer className="rounded-xl border border-slate-800 bg-[#0a1730] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={controlButton} onClick={() => addFrame()}>
          <Plus size={15} />
          Adicionar Quadro
        </button>
        <button type="button" className={controlButton} onClick={() => duplicateFrame()}>
          <Copy size={15} />
          Duplicar
        </button>
        <button
          type="button"
          disabled={frames.length <= 1 || !activeFrame}
          className={`${controlButton} disabled:cursor-not-allowed disabled:opacity-45`}
          onClick={() => activeFrame && removeFrame(activeFrame.id)}
        >
          <Trash2 size={15} />
          Remover
        </button>

        {!playback.isPlaying ? (
          <button
            type="button"
            className={`${controlButton} border-[#19d3c5]/60 text-[#9bf7f0]`}
            onClick={play}
          >
            <Play size={15} />
            Reproduzir
          </button>
        ) : (
          <button
            type="button"
            className={`${controlButton} border-[#19d3c5]/60 text-[#9bf7f0]`}
            onClick={pause}
          >
            <Pause size={15} />
            Pausar
          </button>
        )}

        <button type="button" className={controlButton} onClick={stop}>
          <Square size={14} />
          Parar
        </button>

        <button
          type="button"
          className={`${controlButton} ${playback.loop ? "border-[#2f6bff]/65 text-[#9cb8ff]" : ""}`}
          onClick={toggleLoop}
        >
          <Repeat size={15} />
          Repetir
        </button>

        <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-300">
          Velocidade
          <input
            className="accent-[#19d3c5]"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={playback.speed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          />
          <span className="w-8 text-right">{playback.speed.toFixed(1)}x</span>
        </label>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {frames.map((frame, index) => {
          const isActive = frame.id === activeFrameId;
          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => setActiveFrame(frame.id)}
              className={`min-w-[130px] rounded-md border px-3 py-2 text-left transition ${
                isActive
                  ? "border-[#19d3c5]/70 bg-[#19d3c5]/13 text-[#b5f9f3]"
                  : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                Passo {index + 1}
              </p>
              <p className="text-sm font-semibold">{frame.name}</p>
            </button>
          );
        })}
      </div>

      {activeFrame && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          <span>Duração do Quadro em ms</span>
          <input
            className="w-28 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100"
            type="number"
            min={300}
            max={10000}
            value={activeFrame.durationMs}
            onChange={(event) =>
              updateFrameDuration(activeFrame.id, Number(event.target.value) || 300)
            }
          />
        </div>
      )}
    </footer>
  );
}
