"use client";

import { Palette, Shirt, UserRound, X } from "lucide-react";
import { useMemo } from "react";

import { useTacticalBoardStore } from "@/src/store";
import type { PlayerEntity, TacticalEntity } from "@/src/types";

interface PlayerEditorPanelProps {
  onClose?: () => void;
  className?: string;
}

const isPlayerEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

const cardClass =
  "rounded-3xl border border-slate-200/75 bg-gradient-to-b from-white/95 to-slate-50/90 p-4 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl";

export function PlayerEditorPanel({ onClose, className }: PlayerEditorPanelProps) {
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const settings = useTacticalBoardStore((state) => state.settings);

  const setBoardSettings = useTacticalBoardStore((state) => state.setBoardSettings);
  const updateEntity = useTacticalBoardStore((state) => state.updateEntity);
  const removePlayerFromPitch = useTacticalBoardStore((state) => state.removePlayerFromPitch);
  const returnPlayerToPitch = useTacticalBoardStore((state) => state.returnPlayerToPitch);

  const players = useMemo(
    () =>
      Object.values(entities)
        .filter(isPlayerEntity)
        .sort((a, b) =>
          a.team === b.team ? a.number - b.number : a.team === "home" ? -1 : 1,
        ),
    [entities],
  );

  const activeFrame = useMemo(
    () => frames.find((frame) => frame.id === activeFrameId) ?? frames[0],
    [activeFrameId, frames],
  );

  const homePlayers = players.filter((player) => player.team === "home");
  const awayPlayers = players.filter((player) => player.team === "away");
  const homeOnPitchCount = homePlayers.filter(
    (player) => activeFrame?.entityStates[player.id]?.visible ?? true,
  ).length;
  const awayOnPitchCount = awayPlayers.filter(
    (player) => activeFrame?.entityStates[player.id]?.visible ?? true,
  ).length;

  return (
    <aside className={`${cardClass} w-[min(90vw,360px)] ${className ?? ""}`}>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Roster
          </p>
          <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
            <UserRound size={16} className="text-sky-600" />
            Elenco Completo
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={15} />
          </button>
        )}
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Casa</p>
          <p className="text-sm font-bold text-slate-900">
            {homeOnPitchCount}/{homePlayers.length} em campo
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Visitante</p>
          <p className="text-sm font-bold text-slate-900">
            {awayOnPitchCount}/{awayPlayers.length} em campo
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="grid grid-cols-[52px_1fr_64px_44px_78px] border-b border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>Time</span>
          <span>Nome</span>
          <span>Camisa</span>
          <span>Cor</span>
          <span>Status</span>
        </header>
        <div className="max-h-[420px] overflow-y-auto">
          {players.map((player) => {
            const isOnPitch = activeFrame?.entityStates[player.id]?.visible ?? true;
            return (
              <div
                key={player.id}
                className="grid grid-cols-[52px_1fr_64px_44px_78px] items-center gap-1 border-b border-slate-100 px-2 py-2 last:border-b-0"
              >
                <span
                  className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    player.team === "home"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {player.team === "home" ? "Casa" : "Fora"}
                </span>

                <input
                  className={inputClass}
                  value={player.name}
                  onChange={(event) =>
                    updateEntity(player.id, { name: event.target.value })
                  }
                />

                <div className="relative">
                  <Shirt size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className={`${inputClass} pl-6`}
                    type="number"
                    min={1}
                    max={99}
                    value={player.number}
                    onChange={(event) => {
                      const nextNumber = Number(event.target.value) || player.number;
                      updateEntity(player.id, {
                        number: nextNumber,
                        label: String(nextNumber),
                      });
                    }}
                  />
                </div>

                <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                  <Palette size={11} className="absolute opacity-0" />
                  <input
                    className="h-8 w-8 cursor-pointer appearance-none rounded-md border-0 bg-transparent p-0"
                    type="color"
                    value={player.color}
                    onChange={(event) =>
                      updateEntity(player.id, { color: event.target.value })
                    }
                    title={`Cor de ${player.name}`}
                  />
                </label>

                <button
                  type="button"
                  className={`h-9 rounded-lg border text-[11px] font-semibold transition ${
                    isOnPitch
                      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                  onClick={() =>
                    isOnPitch ? removePlayerFromPitch(player.id) : returnPlayerToPitch(player.id)
                  }
                >
                  {isOnPitch ? "Tirar" : "Colocar"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        onClick={() =>
          setBoardSettings({
            showPlayerNames: !settings.showPlayerNames,
          })
        }
      >
        {settings.showPlayerNames ? "Ocultar nomes em campo" : "Mostrar nomes em campo"}
      </button>
    </aside>
  );
}
