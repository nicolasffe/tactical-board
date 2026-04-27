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
  "rounded-md border border-slate-700/70 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#19d3c5]";

export function TopControls({ onExportPng, onExportJson }: TopControlsProps) {
  const applyFormation = useTacticalBoardStore((state) => state.applyFormation);

  const [team, setTeam] = useState<TeamSide>("home");
  const [formation, setFormation] = useState<FormationPreset>("4-3-3");

  return (
    <header className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-[#0a1730] p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
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
        className="rounded-md border border-[#19d3c5]/60 bg-[#19d3c5]/14 px-3 py-2 text-sm font-semibold text-[#a9f7f1] transition hover:bg-[#19d3c5]/22"
        onClick={() => applyFormation(team, formation)}
      >
        Aplicar
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700/70 bg-slate-900/65 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          onClick={onExportPng}
        >
          <Download size={16} />
          Baixar PNG
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-[#2f6bff]/55 bg-[#2f6bff]/14 px-3 py-2 text-sm font-semibold text-[#cad8ff] transition hover:bg-[#2f6bff]/25"
          onClick={onExportJson}
        >
          <Save size={16} />
          Salvar JSON
        </button>
      </div>
    </header>
  );
}
