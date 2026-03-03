"use client";

import {
  Grid3X3,
  MoveRight,
  MousePointer2,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import { useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import { FORMATION_PRESETS } from "@/src/types";
import type { FormationPreset, TeamSide } from "@/src/types";

interface SimpleControlsProps {
  onClose: () => void;
}

const sectionClass = "mt-2 rounded-xl border border-slate-200/85 bg-white/70 p-2";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";

export function SimpleControls({ onClose }: SimpleControlsProps) {
  const activeTool = useTacticalBoardStore((state) => state.activeTool);
  const settings = useTacticalBoardStore((state) => state.settings);
  const history = useTacticalBoardStore((state) => state.history);

  const setActiveTool = useTacticalBoardStore((state) => state.setActiveTool);
  const setBoardSettings = useTacticalBoardStore((state) => state.setBoardSettings);
  const applyFormation = useTacticalBoardStore((state) => state.applyFormation);
  const undo = useTacticalBoardStore((state) => state.undo);
  const redo = useTacticalBoardStore((state) => state.redo);
  const resetBoard = useTacticalBoardStore((state) => state.resetBoard);

  const [team, setTeam] = useState<TeamSide>("home");
  const [formation, setFormation] = useState<FormationPreset>("4-3-3");

  return (
    <section className="w-[min(92vw,400px)] rounded-2xl border border-white/80 bg-white/88 p-3 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Painel
          </p>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Sparkles size={14} className="text-sky-600" />
            Controles do Quadro
          </h2>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          <X size={14} />
        </button>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Ferramentas
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            className={`${buttonClass} ${activeTool === "select" ? "border-sky-300 bg-sky-50 text-sky-900" : ""}`}
            onClick={() => setActiveTool("select")}
          >
            <MousePointer2 size={13} />
            Sel.
          </button>
          <button
            type="button"
            className={`${buttonClass} ${activeTool === "pass" ? "border-sky-300 bg-sky-50 text-sky-900" : ""}`}
            onClick={() => setActiveTool("pass")}
          >
            <Send size={13} />
            Passe
          </button>
          <button
            type="button"
            className={`${buttonClass} ${activeTool === "run" ? "border-sky-300 bg-sky-50 text-sky-900" : ""}`}
            onClick={() => setActiveTool("run")}
          >
            <MoveRight size={13} />
            Corr.
          </button>
          <button
            type="button"
            className={`${buttonClass} ${activeTool === "dribble" ? "border-sky-300 bg-sky-50 text-sky-900" : ""}`}
            onClick={() => setActiveTool("dribble")}
          >
            <Waves size={13} />
            Drib.
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Ações
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" className={buttonClass} disabled={history.past.length === 0} onClick={undo}>
            <Undo2 size={13} />
            Desf.
          </button>
          <button type="button" className={buttonClass} disabled={history.future.length === 0} onClick={redo}>
            <Redo2 size={13} />
            Ref.
          </button>
          <button type="button" className={buttonClass} onClick={resetBoard}>
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Visual
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              setBoardSettings({ pitchView: settings.pitchView === "full" ? "half" : "full" })
            }
          >
            <Grid3X3 size={13} />
            {settings.pitchView === "full" ? "Meio campo" : "Inteiro"}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setBoardSettings({ showGrid: !settings.showGrid })}
          >
            <Grid3X3 size={13} />
            {settings.showGrid ? "Sem grade" : "Com grade"}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setBoardSettings({ showZones: !settings.showZones })}
          >
            <Grid3X3 size={13} />
            {settings.showZones ? "Sem zonas" : "Com zonas"}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setBoardSettings({ showPlayerNames: !settings.showPlayerNames })}
          >
            <MousePointer2 size={13} />
            {settings.showPlayerNames ? "Sem nomes" : "Com nomes"}
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Formação
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
            value={team}
            onChange={(event) => setTeam(event.target.value as TeamSide)}
          >
            <option value="home">Casa</option>
            <option value="away">Fora</option>
          </select>
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
            value={formation}
            onChange={(event) => setFormation(event.target.value as FormationPreset)}
          >
            {FORMATION_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
            onClick={() => applyFormation(team, formation)}
          >
            Aplicar
          </button>
        </div>
      </div>
    </section>
  );
}
