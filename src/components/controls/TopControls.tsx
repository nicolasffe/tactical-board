"use client";

import { Download, Save } from "lucide-react";
import { useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import { FORMATION_PRESETS } from "@/src/types";
import type { FormationPreset, TeamSide } from "@/src/types";

interface TopControlsProps {
  onExportPng: () => void;
  onExportJson: () => void;
}

const controlSelectClass =
  "rounded-lg border border-slate-300/80 bg-white/94 px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100";

export function TopControls({ onExportPng, onExportJson }: TopControlsProps) {
  const applyFormation = useTacticalBoardStore((state) => state.applyFormation);

  const [team, setTeam] = useState<TeamSide>("home");
  const [formation, setFormation] = useState<FormationPreset>("4-3-3");

  return (
    <header className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300/75 bg-white/94 p-3 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.44)] backdrop-blur-xl">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Formações predefinidas
      </span>

      <select
        className={controlSelectClass}
        value={team}
        onChange={(event) => setTeam(event.target.value as TeamSide)}
      >
        <option value="home">Time da casa</option>
        <option value="away">Time visitante</option>
      </select>

      <select
        className={controlSelectClass}
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
        className="rounded-lg border border-slate-950 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        onClick={() => applyFormation(team, formation)}
      >
        Aplicar
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/94 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-white"
          onClick={onExportPng}
        >
          <Download size={16} />
          Baixar PNG
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:border-teal-400 hover:bg-teal-100"
          onClick={onExportJson}
        >
          <Save size={16} />
          Salvar JSON
        </button>
      </div>
    </header>
  );
}
