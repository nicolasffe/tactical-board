"use client";

import {
  Circle,
  Fence,
  Goal,
  Grid3X3,
  MousePointer2,
  MoveRight,
  Redo2,
  RotateCcw,
  Send,
  Triangle,
  Undo2,
  Waves,
} from "lucide-react";

import { useTacticalBoardStore } from "@/src/store";

const baseButtonClass =
  "flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/94 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-white";

const activeButtonClass =
  "border-slate-950 bg-slate-950 text-white shadow-[0_14px_28px_-22px_rgba(15,23,42,0.42)]";

export function LeftToolbar() {
  const activeTool = useTacticalBoardStore((state) => state.activeTool);
  const settings = useTacticalBoardStore((state) => state.settings);
  const history = useTacticalBoardStore((state) => state.history);

  const setActiveTool = useTacticalBoardStore((state) => state.setActiveTool);
  const setBoardSettings = useTacticalBoardStore((state) => state.setBoardSettings);
  const addEntity = useTacticalBoardStore((state) => state.addEntity);
  const undo = useTacticalBoardStore((state) => state.undo);
  const redo = useTacticalBoardStore((state) => state.redo);
  const resetBoard = useTacticalBoardStore((state) => state.resetBoard);

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 rounded-xl border border-slate-300/75 bg-white/94 p-4 shadow-[0_24px_64px_-44px_rgba(15,23,42,0.46)] backdrop-blur-xl">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ferramentas
        </h2>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className={`${baseButtonClass} ${activeTool === "select" ? activeButtonClass : ""}`}
            onClick={() => setActiveTool("select")}
          >
            <MousePointer2 size={16} />
            Selecionar
          </button>
          <button
            type="button"
            className={`${baseButtonClass} ${activeTool === "pass" ? activeButtonClass : ""}`}
            onClick={() => setActiveTool("pass")}
          >
            <Send size={16} />
            Passe
          </button>
          <button
            type="button"
            className={`${baseButtonClass} ${activeTool === "run" ? activeButtonClass : ""}`}
            onClick={() => setActiveTool("run")}
          >
            <MoveRight size={16} />
            Corrida
          </button>
          <button
            type="button"
            className={`${baseButtonClass} ${activeTool === "dribble" ? activeButtonClass : ""}`}
            onClick={() => setActiveTool("dribble")}
          >
            <Waves size={16} />
            Drible
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Equipamentos
        </h2>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              addEntity({
                kind: "ball",
                position: { x: 52.5, y: 34 },
              })
            }
          >
            <Circle size={16} />
            Adicionar bola
          </button>
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              addEntity({
                kind: "cone",
                position: { x: 45, y: 20 },
              })
            }
          >
            <Triangle size={16} />
            Adicionar cone
          </button>
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              addEntity({
                kind: "mannequin",
                position: { x: 60, y: 34 },
              })
            }
          >
            <Grid3X3 size={16} />
            Adicionar manequim
          </button>
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              addEntity({
                kind: "portableGoal",
                position: { x: 68, y: 34 },
              })
            }
          >
            <Goal size={16} />
            Adicionar gol
          </button>
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              addEntity({
                kind: "miniGoal",
                position: { x: 38, y: 34 },
              })
            }
          >
            <Goal size={16} />
            Adicionar mini gol
          </button>
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              addEntity({
                kind: "hurdle",
                position: { x: 52.5, y: 44 },
              })
            }
          >
            <Fence size={16} />
            Adicionar barreira
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Exibição
        </h2>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              setBoardSettings({
                pitchView: settings.pitchView === "full" ? "half" : "full",
              })
            }
          >
            <Grid3X3 size={16} />
            {settings.pitchView === "full"
              ? "Alternar para meio-campo"
              : "Alternar para campo inteiro"}
          </button>
          <button
            type="button"
            className={baseButtonClass}
            onClick={() =>
              setBoardSettings({
                showPlayerNames: !settings.showPlayerNames,
              })
            }
          >
            <MousePointer2 size={16} />
            {settings.showPlayerNames ? "Ocultar nomes" : "Mostrar nomes"}
          </button>
        </div>
      </section>

      <section className="mt-auto space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Histórico
        </h2>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            disabled={history.past.length === 0}
            className={`${baseButtonClass} disabled:cursor-not-allowed disabled:opacity-45`}
            onClick={undo}
          >
            <Undo2 size={16} />
            Desfazer
          </button>
          <button
            type="button"
            disabled={history.future.length === 0}
            className={`${baseButtonClass} disabled:cursor-not-allowed disabled:opacity-45`}
            onClick={redo}
          >
            <Redo2 size={16} />
            Refazer
          </button>
          <button type="button" className={baseButtonClass} onClick={resetBoard}>
            <RotateCcw size={16} />
            Redefinir quadro
          </button>
        </div>
      </section>
    </aside>
  );
}
