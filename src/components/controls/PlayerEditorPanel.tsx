"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Palette,
  Shirt,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import type {
  JerseyStyle,
  PlayerEntity,
  TacticalEntity,
  TeamSide,
} from "@/src/types";

interface PlayerEditorPanelProps {
  onClose?: () => void;
  className?: string;
}

const isPlayerEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

const inputClass =
  "h-10 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 sm:text-xs";

const cardClass =
  "max-h-[min(calc(100svh-6rem),46rem)] w-[min(calc(100vw-1rem),440px)] overflow-y-auto rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] p-3 shadow-[0_28px_72px_-36px_rgba(15,23,42,0.42)] ring-1 ring-slate-200/60 backdrop-blur-2xl sm:max-h-[calc(100svh-2rem)] sm:rounded-[28px] sm:p-4";

const MAX_PLAYERS_ON_PITCH = 11;

const getTeamTone = (team: TeamSide) =>
  team === "home"
    ? {
        soft: "border-sky-200 bg-sky-50 text-sky-800",
        badge: "bg-sky-500 text-white",
        accent: "text-sky-700",
      }
    : {
        soft: "border-amber-200 bg-amber-50 text-amber-800",
        badge: "bg-amber-500 text-white",
        accent: "text-amber-700",
      };

export function PlayerEditorPanel({
  onClose,
  className,
}: PlayerEditorPanelProps) {
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const settings = useTacticalBoardStore((state) => state.settings);
  const selection = useTacticalBoardStore((state) => state.selection);

  const setBoardSettings = useTacticalBoardStore(
    (state) => state.setBoardSettings,
  );
  const setSelection = useTacticalBoardStore((state) => state.setSelection);
  const updateEntity = useTacticalBoardStore((state) => state.updateEntity);
  const removePlayerFromPitch = useTacticalBoardStore(
    (state) => state.removePlayerFromPitch,
  );
  const returnPlayerToPitch = useTacticalBoardStore(
    (state) => state.returnPlayerToPitch,
  );

  const [manualTeamFilter, setManualTeamFilter] = useState<TeamSide>("home");
  const [fallbackPlayerId, setFallbackPlayerId] = useState<string | null>(null);

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

  const selectedEntity = selection.activeEntityId
    ? entities[selection.activeEntityId]
    : null;

  const selectedEntityPlayer =
    selectedEntity && isPlayerEntity(selectedEntity) ? selectedEntity : null;

  const teamFilter = selectedEntityPlayer?.team ?? manualTeamFilter;

  const teamPlayers = useMemo(
    () => players.filter((player) => player.team === teamFilter),
    [players, teamFilter],
  );

  const teamSummary = useMemo(() => {
    const homePlayers = players.filter((player) => player.team === "home");
    const awayPlayers = players.filter((player) => player.team === "away");

    const homeOnPitch = homePlayers.filter(
      (player) => activeFrame?.entityStates[player.id]?.visible ?? true,
    ).length;
    const awayOnPitch = awayPlayers.filter(
      (player) => activeFrame?.entityStates[player.id]?.visible ?? true,
    ).length;

    return {
      home: {
        total: homePlayers.length,
        onPitch: homeOnPitch,
      },
      away: {
        total: awayPlayers.length,
        onPitch: awayOnPitch,
      },
    };
  }, [activeFrame, players]);

  const selectedPlayerId = useMemo(() => {
    if (
      selectedEntityPlayer &&
      selectedEntityPlayer.team === teamFilter
    ) {
      return selectedEntityPlayer.id;
    }

    if (
      fallbackPlayerId &&
      teamPlayers.some((player) => player.id === fallbackPlayerId)
    ) {
      return fallbackPlayerId;
    }

    return teamPlayers[0]?.id ?? null;
  }, [fallbackPlayerId, selectedEntityPlayer, teamFilter, teamPlayers]);

  const selectedPlayer = selectedPlayerId
    ? teamPlayers.find((player) => player.id === selectedPlayerId) ?? null
    : null;

  const selectedIndex = selectedPlayer
    ? teamPlayers.findIndex((player) => player.id === selectedPlayer.id)
    : -1;

  const isOnPitch = selectedPlayer
    ? (activeFrame?.entityStates[selectedPlayer.id]?.visible ?? true)
    : false;
  const teamOnPitchCount = selectedPlayer
    ? teamSummary[selectedPlayer.team].onPitch
    : 0;
  const canEnterPitch = !isOnPitch && teamOnPitchCount < MAX_PLAYERS_ON_PITCH;

  const selectPlayer = (playerId: string) => {
    setFallbackPlayerId(playerId);
    setSelection({
      entityIds: [playerId],
      activeEntityId: playerId,
      overlayIds: [],
      activeOverlayId: null,
    });
  };

  const selectTeam = (team: TeamSide) => {
    setManualTeamFilter(team);

    const firstPlayer = players.find((player) => player.team === team);
    if (firstPlayer) {
      selectPlayer(firstPlayer.id);
    }
  };

  const goToRelativePlayer = (offset: number) => {
    if (selectedIndex < 0 || teamPlayers.length === 0) {
      return;
    }

    const nextIndex =
      (selectedIndex + offset + teamPlayers.length) % teamPlayers.length;
    const nextPlayer = teamPlayers[nextIndex];
    if (!nextPlayer) {
      return;
    }

    selectPlayer(nextPlayer.id);
  };

  if (!selectedPlayer) {
    return (
      <aside className={`${cardClass} ${className ?? ""}`}>
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Jogador
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-950">Editor</h2>
          </div>

          {onClose ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              onClick={onClose}
              aria-label="Fechar painel"
            >
              <X size={15} />
            </button>
          ) : null}
        </header>

        <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Nenhum jogador disponivel.
        </div>
      </aside>
    );
  }

  const tone = getTeamTone(selectedPlayer.team);

  return (
    <aside className={`${cardClass} ${className ?? ""}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Jogador
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-bold tracking-[-0.02em] text-slate-950">
            <UserRound size={17} className="text-sky-600" />
            Editar atleta
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            onClick={() =>
              setBoardSettings({
                showPlayerNames: !settings.showPlayerNames,
              })
            }
            title={settings.showPlayerNames ? "Ocultar nomes" : "Mostrar nomes"}
          >
            {settings.showPlayerNames ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>

          {onClose ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              onClick={onClose}
              aria-label="Fechar painel"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-1 shadow-sm">
        <TeamTabButton
          label={`Casa ${teamSummary.home.onPitch}/${teamSummary.home.total}`}
          active={teamFilter === "home"}
          onClick={() => selectTeam("home")}
        />
        <TeamTabButton
          label={`Visitante ${teamSummary.away.onPitch}/${teamSummary.away.total}`}
          active={teamFilter === "away"}
          onClick={() => selectTeam("away")}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <NavButton
          title="Jogador anterior"
          onClick={() => goToRelativePlayer(-1)}
        >
          <ChevronLeft size={15} />
        </NavButton>

        <div className="flex-1 overflow-x-auto pb-1">
          <div className="flex gap-1.5">
            {teamPlayers.map((player) => {
              const isActive = player.id === selectedPlayer.id;

              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => selectPlayer(player.id)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-xs font-semibold shadow-sm transition ${
                    isActive
                      ? `${tone.soft}`
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                  title={player.name}
                >
                  {player.number}
                </button>
              );
            })}
          </div>
        </div>

        <NavButton
          title="Proximo jogador"
          onClick={() => goToRelativePlayer(1)}
        >
          <ChevronRight size={15} />
        </NavButton>
      </div>

      <section className={`mt-3 rounded-[24px] border p-3 ${tone.soft}`}>
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <span
            className={`inline-flex h-12 w-12 items-center justify-center rounded-[18px] text-base font-bold shadow-sm ${tone.badge}`}
          >
            {selectedPlayer.number}
          </span>

          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-950">
              {selectedPlayer.name}
            </p>
            <p className={`text-[11px] font-semibold ${tone.accent}`}>
              {selectedPlayer.team === "home" ? "Casa" : "Visitante"} -{" "}
              {selectedPlayer.kind === "goalkeeper" ? "Goleiro" : "Linha"}
            </p>
          </div>

          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold sm:ml-auto ${
              isOnPitch
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isOnPitch ? "Campo" : "Banco"}
          </span>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <input
            className={inputClass}
            value={selectedPlayer.name}
            title={`Nome de ${selectedPlayer.name}`}
            onChange={(event) =>
              updateEntity(selectedPlayer.id, { name: event.target.value })
            }
          />
        </div>

        <div className="relative">
          <Shirt
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className={`${inputClass} pl-8`}
            type="number"
            min={1}
            max={99}
            value={selectedPlayer.number}
            title={`Numero de ${selectedPlayer.name}`}
            onChange={(event) => {
              const nextNumber =
                Number(event.target.value) || selectedPlayer.number;

              updateEntity(selectedPlayer.id, {
                number: nextNumber,
                label: String(nextNumber),
              });
            }}
          />
        </div>

        <select
          className={inputClass}
          value={selectedPlayer.jerseyStyle ?? "solid"}
          title={`Estilo da camisa de ${selectedPlayer.name}`}
          onChange={(event) =>
            updateEntity(selectedPlayer.id, {
              jerseyStyle: event.target.value as JerseyStyle,
            })
          }
        >
          <option value="solid">Camisa lisa</option>
          <option value="striped">Listrada</option>
          <option value="bordered">Com borda</option>
        </select>

        <label
          className="inline-flex h-10 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:text-xs"
          title={`Cor de ${selectedPlayer.name}`}
        >
          <Palette size={14} />
          Cor
          <input
            className="absolute h-0 w-0 opacity-0"
            type="color"
            value={selectedPlayer.color}
            onChange={(event) =>
              updateEntity(selectedPlayer.id, { color: event.target.value })
            }
          />
        </label>

        <button
          type="button"
          className={`h-10 min-w-0 rounded-2xl border px-3 text-[11px] font-semibold transition sm:text-xs ${
            selectedPlayer.isStarter === false
              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : `${tone.soft}`
          }`}
          onClick={() =>
            updateEntity(selectedPlayer.id, {
              isStarter: !(selectedPlayer.isStarter ?? true),
            })
          }
        >
          {selectedPlayer.isStarter === false ? "Reserva" : "Titular"}
        </button>

        <button
          type="button"
          className={`h-10 min-w-0 rounded-2xl border px-3 text-[11px] font-semibold transition sm:text-xs ${
            isOnPitch
              ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : canEnterPitch
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          }`}
          disabled={!isOnPitch && !canEnterPitch}
          onClick={() =>
            isOnPitch
              ? removePlayerFromPitch(selectedPlayer.id)
              : returnPlayerToPitch(selectedPlayer.id)
          }
        >
          {isOnPitch
            ? "Ir ao banco"
            : canEnterPitch
              ? "Entrar em campo"
              : "Campo cheio"}
        </button>
      </div>
    </aside>
  );
}

interface NavButtonProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function NavButton({ title, onClick, children }: NavButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

interface TeamTabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TeamTabButton({ label, active, onClick }: TeamTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 truncate rounded-[18px] px-3 py-2 text-[11px] font-semibold transition sm:text-xs ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
