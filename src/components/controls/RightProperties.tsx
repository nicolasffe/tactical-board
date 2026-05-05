"use client";

import { Trash2 } from "lucide-react";

import { useTacticalBoardStore } from "@/src/store";
import type { TacticalLine } from "@/src/types";

const fieldClass =
  "rounded-lg border border-slate-300/80 bg-white/94 px-3 py-2 text-sm text-slate-800 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)] outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100";

const colorInputClass =
  "h-9 w-full cursor-pointer rounded-lg border border-slate-300/80 bg-white/94 px-1 py-1 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)]";

const labelClass = "text-xs font-semibold text-slate-500";

const dangerButtonClass =
  "mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100";

export function RightProperties() {
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const selection = useTacticalBoardStore((state) => state.selection);

  const updateEntity = useTacticalBoardStore((state) => state.updateEntity);
  const removeEntity = useTacticalBoardStore((state) => state.removeEntity);
  const updateLine = useTacticalBoardStore((state) => state.updateLine);
  const removeLine = useTacticalBoardStore((state) => state.removeLine);

  const activeFrame =
    frames.find((frame) => frame.id === activeFrameId) ?? frames[0];
  const selectedEntity = selection.activeEntityId
    ? entities[selection.activeEntityId]
    : null;
  const selectedLine = selection.activeOverlayId
    ? (activeFrame?.overlays.lines.find(
        (line) => line.id === selection.activeOverlayId,
      ) ?? null)
    : null;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 rounded-xl border border-slate-300/75 bg-white/94 p-4 shadow-[0_24px_64px_-44px_rgba(15,23,42,0.46)] backdrop-blur-xl">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Propriedades
        </h2>
      </header>

      {selectedEntity ? (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Entidade selecionada
          </p>

          <div className="space-y-1">
            <label className={labelClass}>Rotulo</label>
            <input
              className={`${fieldClass} w-full`}
              value={selectedEntity.label}
              onChange={(event) =>
                updateEntity(selectedEntity.id, { label: event.target.value })
              }
            />
          </div>

          {(selectedEntity.kind === "player" ||
            selectedEntity.kind === "goalkeeper") && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>Nome</label>
                <input
                  className={`${fieldClass} w-full`}
                  value={selectedEntity.name}
                  onChange={(event) =>
                    updateEntity(selectedEntity.id, {
                      name: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Numero</label>
                <input
                  className={`${fieldClass} w-full`}
                  type="number"
                  min={1}
                  max={99}
                  value={selectedEntity.number}
                  onChange={(event) =>
                    updateEntity(selectedEntity.id, {
                      number:
                        Number(event.target.value) || selectedEntity.number,
                      label: String(
                        Number(event.target.value) || selectedEntity.number,
                      ),
                    })
                  }
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className={labelClass}>Cor</label>
            <input
              className={colorInputClass}
              type="color"
              value={selectedEntity.color}
              onChange={(event) =>
                updateEntity(selectedEntity.id, { color: event.target.value })
              }
            />
          </div>

          <button
            type="button"
            className={dangerButtonClass}
            onClick={() => removeEntity(selectedEntity.id)}
          >
            <Trash2 size={15} />
            Remover entidade
          </button>
        </section>
      ) : selectedLine ? (
        <LineProperties
          line={selectedLine}
          onUpdate={updateLine}
          onDelete={removeLine}
        />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-500">
          Selecione um jogador, equipamento ou linha tatica para editar os
          detalhes.
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
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        Linha selecionada
      </p>

      <div className="space-y-1">
        <label className={labelClass}>Tipo</label>
        <select
          className={`${fieldClass} w-full`}
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
        <label className={labelClass}>Cor</label>
        <input
          className={colorInputClass}
          type="color"
          value={line.color}
          onChange={(event) => onUpdate(line.id, { color: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Espessura</label>
        <input
          className="w-full accent-teal-600"
          type="range"
          min={0.4}
          max={2.2}
          step={0.1}
          value={line.width}
          onChange={(event) =>
            onUpdate(line.id, { width: Number(event.target.value) })
          }
        />
      </div>

      <button
        type="button"
        className={dangerButtonClass}
        onClick={() => onDelete(line.id)}
      >
        <Trash2 size={15} />
        Excluir linha
      </button>
    </section>
  );
}
