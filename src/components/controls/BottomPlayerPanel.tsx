"use client";

import { Eye, EyeOff, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import type {
  BenchDragPreview,
  JerseyStyle,
  PlayerEntity,
  TacticalEntity,
  TeamSide,
} from "@/src/types";

interface BottomPlayerPanelProps {
  onClose?: () => void;
  onOpenEditor?: () => void;
  onBenchDragChange?: (drag: BenchDragPreview | null) => void;
  className?: string;
}

const isPlayerEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

const MAX_PLAYERS_ON_PITCH = 11;

const getBadgeTone = (team: TeamSide) =>
  team === "home"
    ? "border-sky-200/80 bg-sky-500 text-white"
    : "border-amber-200/80 bg-amber-500 text-white";

const getJerseyBackground = (color: string, jerseyStyle?: JerseyStyle) => {
  if (jerseyStyle === "striped") {
    return {
      backgroundImage: `linear-gradient(90deg, ${color} 0%, ${color} 30%, rgba(255,255,255,0.86) 30%, rgba(255,255,255,0.86) 42%, ${color} 42%, ${color} 68%, rgba(15,23,42,0.16) 68%, rgba(15,23,42,0.16) 76%, ${color} 76%, ${color} 100%)`,
    };
  }

  if (jerseyStyle === "bordered") {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.14), rgba(15,23,42,0.18)), linear-gradient(90deg, rgba(255,255,255,0.78), rgba(255,255,255,0.78))`,
      backgroundColor: color,
      backgroundSize: "100% 100%, calc(100% - 8px) calc(100% - 8px)",
      backgroundPosition: "center, center",
      backgroundRepeat: "no-repeat",
    };
  }

  return {
    backgroundImage:
      "linear-gradient(145deg, rgba(255,255,255,0.18), rgba(15,23,42,0.16))",
    backgroundColor: color,
  };
};

export function BottomPlayerPanel({
  onClose,
  onOpenEditor,
  onBenchDragChange,
  className,
}: BottomPlayerPanelProps) {
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);
  const settings = useTacticalBoardStore((state) => state.settings);

  const removePlayerFromPitch = useTacticalBoardStore(
    (state) => state.removePlayerFromPitch,
  );
  const returnPlayerToPitch = useTacticalBoardStore(
    (state) => state.returnPlayerToPitch,
  );
  const substitutePlayers = useTacticalBoardStore(
    (state) => state.substitutePlayers,
  );
  const setBoardSettings = useTacticalBoardStore(
    (state) => state.setBoardSettings,
  );
  const setSelection = useTacticalBoardStore((state) => state.setSelection);

  const [teamFilter, setTeamFilter] = useState<TeamSide>("home");
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const activeFrame = useMemo(
    () => frames.find((frame) => frame.id === activeFrameId) ?? frames[0],
    [activeFrameId, frames],
  );

  const filteredPlayers = useMemo(() => {
    return Object.values(entities)
      .filter(isPlayerEntity)
      .filter((player) => player.team === teamFilter)
      .sort((a, b) => {
        const aVisible = activeFrame?.entityStates[a.id]?.visible ?? true;
        const bVisible = activeFrame?.entityStates[b.id]?.visible ?? true;

        if (aVisible !== bVisible) {
          return aVisible ? -1 : 1;
        }

        return a.number - b.number;
      });
  }, [activeFrame, entities, teamFilter]);

  const onPitchCount = useMemo(
    () =>
      filteredPlayers.filter(
        (player) => activeFrame?.entityStates[player.id]?.visible ?? true,
      ).length,
    [filteredPlayers, activeFrame],
  );

  useEffect(
    () => () => {
      dragCleanupRef.current?.();
      onBenchDragChange?.(null);
    },
    [onBenchDragChange],
  );

  const handlePlayerCardClick = (player: PlayerEntity) => {
    const isOnPitch = activeFrame?.entityStates[player.id]?.visible ?? true;

    if (isOnPitch) {
      removePlayerFromPitch(player.id);
      return;
    }

    if (onPitchCount < MAX_PLAYERS_ON_PITCH) {
      returnPlayerToPitch(player.id);
    }
  };

  const handleBenchCardPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    player: PlayerEntity,
  ) => {
    const isOnPitch = activeFrame?.entityStates[player.id]?.visible ?? true;
    if (isOnPitch) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-player-card-action]")) {
      return;
    }

    event.preventDefault();

    dragCleanupRef.current?.();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let hasDragged = false;

    const cleanup = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      dragCleanupRef.current = null;
      onBenchDragChange?.(null);
    };

    const finishSubstitution = (clientX: number, clientY: number) => {
      const dropTarget = document
        .elementFromPoint(clientX, clientY)
        ?.closest("[data-player-drop-id]");
      const fieldPlayerId = dropTarget?.getAttribute("data-player-drop-id");
      if (!fieldPlayerId) {
        return;
      }

      const fieldPlayer = entities[fieldPlayerId];
      const fieldPlayerVisible =
        activeFrame?.entityStates[fieldPlayerId]?.visible ?? true;

      if (
        !fieldPlayer ||
        !isPlayerEntity(fieldPlayer) ||
        !fieldPlayerVisible ||
        fieldPlayer.team !== player.team ||
        fieldPlayer.id === player.id
      ) {
        return;
      }

      substitutePlayers(player.id, fieldPlayer.id);
    };

    const handleWindowPointerMove = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== pointerId) {
        return;
      }

      const moveDistance = Math.hypot(
        nativeEvent.clientX - startX,
        nativeEvent.clientY - startY,
      );

      if (!hasDragged && moveDistance < 6) {
        return;
      }

      hasDragged = true;
      onBenchDragChange?.({
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        team: player.team,
        color: player.color,
        jerseyStyle: player.jerseyStyle,
        clientX: nativeEvent.clientX,
        clientY: nativeEvent.clientY,
      });
    };

    const handleWindowPointerUp = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== pointerId) {
        return;
      }

      if (hasDragged) {
        finishSubstitution(nativeEvent.clientX, nativeEvent.clientY);
      } else if (onPitchCount < MAX_PLAYERS_ON_PITCH) {
        returnPlayerToPitch(player.id);
      }

      cleanup();
    };

    const handleWindowPointerCancel = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== pointerId) {
        return;
      }

      cleanup();
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
  };

  return (
    <aside
      className={`w-[min(calc(100vw-1rem),980px)] rounded-[24px] border border-white/75 bg-white/88 p-2 shadow-[0_28px_72px_-36px_rgba(15,23,42,0.42)] ring-1 ring-slate-200/60 backdrop-blur-2xl sm:rounded-[26px] sm:p-2.5 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
            <TabButton
              label="Casa"
              active={teamFilter === "home"}
              onClick={() => {
                dragCleanupRef.current?.();
                setTeamFilter("home");
              }}
            />
            <TabButton
              label="Visitante"
              active={teamFilter === "away"}
              onClick={() => {
                dragCleanupRef.current?.();
                setTeamFilter("away");
              }}
            />
          </div>

          <span className="inline-flex h-9 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm">
            {onPitchCount}/{MAX_PLAYERS_ON_PITCH}
          </span>
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-wrap sm:justify-normal">
          <IconButton
            title={settings.showPlayerNames ? "Ocultar nomes" : "Mostrar nomes"}
            onClick={() =>
              setBoardSettings({
                showPlayerNames: !settings.showPlayerNames,
              })
            }
          >
            {settings.showPlayerNames ? <EyeOff size={15} /> : <Eye size={15} />}
          </IconButton>

          {onOpenEditor ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              onClick={onOpenEditor}
              title="Editar elenco"
            >
              <SquarePen size={14} />
              Editar
            </button>
          ) : null}

          {onClose ? (
            <IconButton title="Fechar jogadores" onClick={onClose}>
              <X size={15} />
            </IconButton>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 pr-0.5">
        {filteredPlayers.map((player) => {
          const isOnPitch = activeFrame?.entityStates[player.id]?.visible ?? true;
          const canEnterDirectly =
            !isOnPitch && onPitchCount < MAX_PLAYERS_ON_PITCH;
          const needsDragSubstitution = !isOnPitch && !canEnterDirectly;
          const jerseyStyle = getJerseyBackground(
            player.color,
            player.jerseyStyle,
          );

          return (
            <div
              key={player.id}
              role="button"
              tabIndex={0}
              onClick={() => handlePlayerCardClick(player)}
              onPointerDown={(event) => handleBenchCardPointerDown(event, player)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handlePlayerCardClick(player);
                }
              }}
              className={`group min-w-[126px] rounded-[20px] border px-2.5 py-2 text-left transition-all duration-200 sm:min-w-[142px] sm:rounded-[22px] sm:px-3 sm:py-2.5 ${
                isOnPitch
                  ? "border-slate-200 bg-white shadow-[0_16px_34px_-28px_rgba(15,23,42,0.34)] hover:border-slate-300 hover:-translate-y-0.5"
                  : canEnterDirectly
                    ? "border-emerald-200 bg-emerald-50/80 shadow-[0_16px_34px_-28px_rgba(5,150,105,0.24)] hover:bg-emerald-100/80 hover:-translate-y-0.5"
                    : "border-amber-200 bg-amber-50/70 shadow-[0_16px_34px_-28px_rgba(180,83,9,0.24)] hover:bg-amber-100/70 hover:-translate-y-0.5"
              }`}
              data-substitution-source={
                needsDragSubstitution ? player.id : undefined
              }
              title={
                isOnPitch
                  ? "Mandar ao banco"
                  : canEnterDirectly
                    ? "Colocar em campo"
                    : "Arraste ate um titular no campo"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-2xl border text-sm font-bold shadow-sm sm:h-9 sm:w-9 ${getBadgeTone(teamFilter)}`}
                >
                  {player.number}
                </span>

                <div className="flex items-center gap-1.5">
                  {onOpenEditor ? (
                    <button
                      type="button"
                      data-player-card-action="edit"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      title={`Editar ${player.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelection({
                          entityIds: [player.id],
                          activeEntityId: player.id,
                          overlayIds: [],
                          activeOverlayId: null,
                        });
                        onOpenEditor();
                      }}
                    >
                      <SquarePen size={12} />
                    </button>
                  ) : null}

                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isOnPitch
                        ? "bg-emerald-500"
                        : canEnterDirectly
                          ? "bg-sky-500"
                          : "bg-amber-500"
                    }`}
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/70 text-[10px] font-semibold text-white shadow-sm sm:h-9 sm:w-9"
                  style={jerseyStyle}
                >
                  {player.kind === "goalkeeper" ? "GK" : "P"}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900 sm:text-sm">
                    {player.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {isOnPitch
                      ? "Campo"
                      : canEnterDirectly
                        ? "Entrar"
                        : "Banco"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-xl px-3 text-xs font-semibold transition ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

interface IconButtonProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function IconButton({ title, onClick, children }: IconButtonProps) {
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
