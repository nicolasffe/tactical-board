"use client";

import { Trash2 } from "lucide-react";

import { useTacticalBoardStore } from "@/src/store";
import type { TacticalLine } from "@/src/types";

const panelClass =
  "rounded-md border border-slate-700/70 bg-slate-900/55 px-3 py-2 text-sm text-slate-100 focus:border-[#19d3c5] focus:outline-none";

export function RightProperties() {
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const selection = useTacticalBoardStore((state) => state.selection);

  const updateEntity = useTacticalBoardStore((state) => state.updateEntity);
  const removeEntity = useTacticalBoardStore((state) => state.removeEntity);
  const updateLine = useTacticalBoardStore((state) => state.updateLine);
  const removeLine = useTacticalBoardStore((state) => state.removeLine);

  const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0];
  const selectedEntity = selection.entityId ? entities[selection.entityId] : null;
  const selectedLine = selection.lineId
    ? activeFrame?.lines.find((line) => line.id === selection.lineId) ?? null
    : null;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 rounded-xl border border-slate-800 bg-[#0a1730] p-4">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Propriedades
        </h2>
      </header>

      {selectedEntity ? (
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Entidade Selecionada</p>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Rótulo</label>
            <input
              className={`${panelClass} w-full`}
              value={selectedEntity.label}
              onChange={(event) =>
                updateEntity(selectedEntity.id, { label: event.target.value })
              }
            />
          </div>

          {(selectedEntity.kind === "player" || selectedEntity.kind === "goalkeeper") && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Nome</label>
                <input
                  className={`${panelClass} w-full`}
                  value={selectedEntity.name}
                  onChange={(event) =>
                    updateEntity(selectedEntity.id, { name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Número</label>
                <input
                  className={`${panelClass} w-full`}
                  type="number"
                  min={1}
                  max={99}
                  value={selectedEntity.number}
                  onChange={(event) =>
                    updateEntity(selectedEntity.id, {
                      number: Number(event.target.value) || selectedEntity.number,
                      label: String(Number(event.target.value) || selectedEntity.number),
                    })
                  }
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Cor</label>
            <input
              className="h-9 w-full cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-1 py-1"
              type="color"
              value={selectedEntity.color}
              onChange={(event) =>
                updateEntity(selectedEntity.id, { color: event.target.value })
              }
            />
          </div>

          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-500/55 bg-red-600/12 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-600/20"
            onClick={() => removeEntity(selectedEntity.id)}
          >
            <Trash2 size={15} />
            Remover Entidade
          </button>
        </section>
      ) : selectedLine ? (
        <LineProperties line={selectedLine} onUpdate={updateLine} onDelete={removeLine} />
      ) : (
        <section className="rounded-md border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
          Selecione um jogador, equipamento ou linha tática para editar os detalhes.
        </section>
      )}
    </aside>
  );
}

interface LinePropertiesProps {
  line: TacticalLine;
  onUpdate: (lineId: string, updates: Partial<TacticalLine>) => void;
  onDelete: (lineId: string) => void;
}

function LineProperties({ line, onUpdate, onDelete }: LinePropertiesProps) {
  return (
    <section className="space-y-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Linha Selecionada</p>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">Tipo</label>
        <select
          className={`${panelClass} w-full`}
          value={line.type}
          onChange={(event) =>
            onUpdate(line.id, {
              type: event.target.value as TacticalLine["type"],
            })
          }
        >
          <option value="pass">Passe</option>
          <option value="run">Corrida</option>
          <option value="dribble">Drible</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">Cor</label>
        <input
          className="h-9 w-full cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-1 py-1"
          type="color"
          value={line.color}
          onChange={(event) => onUpdate(line.id, { color: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">Espessura</label>
        <input
          className="w-full accent-[#19d3c5]"
          type="range"
          min={0.4}
          max={2.2}
          step={0.1}
          value={line.width}
          onChange={(event) => onUpdate(line.id, { width: Number(event.target.value) })}
        />
      </div>

      <button
        type="button"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-500/55 bg-red-600/12 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-600/20"
        onClick={() => onDelete(line.id)}
      >
        <Trash2 size={15} />
        Excluir Linha
      </button>
    </section>
  );
}
