"use client";

import Image from "next/image";
import { Eye, EyeOff, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import { PITCH_PRESET_DIMENSIONS } from "@/src/types";
import type {
  BenchDragPreview,
  JerseyStyle,
  Point,
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

const getTeamTone = (team: TeamSide) =>
  team === "home"
    ? {
        strong:
          "border-sky-200/80 bg-[linear-gradient(135deg,#38bdf8,#2563eb)] text-white",
        count: "bg-sky-500/14 text-sky-200",
      }
    : {
        strong:
          "border-amber-200/80 bg-[linear-gradient(135deg,#f59e0b,#ea580c)] text-white",
        count: "bg-amber-400/18 text-amber-100",
      };

const getPlayerStatusMeta = (
  isOnPitch: boolean,
  canEnterDirectly: boolean,
) => {
  if (isOnPitch) {
    return {
      dotClass: "bg-emerald-500",
      accentClass: "bg-emerald-500/80",
      cardClass:
        "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] shadow-[0_18px_34px_-30px_rgba(15,23,42,0.28)] hover:border-slate-300 hover:-translate-y-0.5",
    };
  }

  if (canEnterDirectly) {
    return {
      dotClass: "bg-sky-500",
      accentClass: "bg-sky-500/80",
      cardClass:
        "border-emerald-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.86))] shadow-[0_18px_34px_-30px_rgba(16,185,129,0.24)] hover:border-emerald-300 hover:-translate-y-0.5",
    };
  }

  return {
    dotClass: "bg-amber-500",
    accentClass: "bg-amber-500/80",
    cardClass:
      "border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.86))] shadow-[0_18px_34px_-30px_rgba(245,158,11,0.22)] hover:border-amber-300 hover:-translate-y-0.5",
  };
};

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

interface PlayerAvatarProps {
  player: PlayerEntity;
  jerseyStyle: React.CSSProperties;
}

function PlayerAvatar({ player, jerseyStyle }: PlayerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (player.avatarUrl && !imageFailed) {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[13px] border border-white/80 bg-slate-100 shadow-sm sm:h-10 sm:w-10">
        <Image
          src={player.avatarUrl}
          alt={player.name}
          fill
          sizes="40px"
          className="object-cover"
          loading="lazy"
          unoptimized
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border border-white/70 bg-white/50 p-1 shadow-sm sm:h-10 sm:w-10">
      <div
        className="flex h-full w-full items-center justify-center rounded-[10px] text-[10px] font-semibold text-white shadow-sm"
        style={jerseyStyle}
      >
        {player.kind === "goalkeeper" ? "GK" : "P"}
      </div>
    </div>
  );
}

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
  const placePlayerOnPitch = useTacticalBoardStore(
    (state) => state.placePlayerOnPitch,
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
  const suppressClickPlayerIdRef = useRef<string | null>(null);

  const activeFrame = useMemo(
    () => frames.find((frame) => frame.id === activeFrameId) ?? frames[0],
    [activeFrameId, frames],
  );

  const teamSummary = useMemo(() => {
    const players = Object.values(entities).filter(isPlayerEntity);
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
  }, [activeFrame, entities]);

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
    if (suppressClickPlayerIdRef.current === player.id) {
      suppressClickPlayerIdRef.current = null;
      return;
    }

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
    const sourceElement = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    let hasDragged = false;

    const cleanup = () => {
      if (sourceElement.hasPointerCapture(pointerId)) {
        sourceElement.releasePointerCapture(pointerId);
      }

      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      dragCleanupRef.current = null;
      onBenchDragChange?.(null);
    };

    const isValidSubstitutionTarget = (
      fieldPlayerId: string | null,
    ): fieldPlayerId is string => {
      if (!fieldPlayerId) {
        return false;
      }

      const fieldPlayer = entities[fieldPlayerId];
      const fieldPlayerVisible =
        activeFrame?.entityStates[fieldPlayerId]?.visible ?? true;

      return Boolean(
        fieldPlayer &&
          isPlayerEntity(fieldPlayer) &&
          fieldPlayerVisible &&
          fieldPlayer.team === player.team &&
          fieldPlayer.id !== player.id,
      );
    };

    const getSubstitutionTarget = (clientX: number, clientY: number) => {
      for (const element of document.elementsFromPoint(clientX, clientY)) {
        const fieldPlayerId = element
          .closest("[data-player-drop-id]")
          ?.getAttribute("data-player-drop-id") ?? null;

        if (isValidSubstitutionTarget(fieldPlayerId)) {
          const targetPlayer = entities[fieldPlayerId];

          return isPlayerEntity(targetPlayer)
            ? { playerId: targetPlayer.id, playerName: targetPlayer.name }
            : null;
        }
      }

      let closestTargetId: string | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      document.querySelectorAll("[data-player-drop-id]").forEach((element) => {
        const fieldPlayerId = element.getAttribute("data-player-drop-id");
        if (!isValidSubstitutionTarget(fieldPlayerId)) {
          return;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(clientX - centerX, clientY - centerY);
        const targetRadius = Math.max(
          44,
          Math.min(76, Math.max(rect.width, rect.height) * 1.35),
        );

        if (distance <= targetRadius && distance < closestDistance) {
          closestDistance = distance;
          closestTargetId = fieldPlayerId;
        }
      });

      if (!closestTargetId) {
        return null;
      }

      const targetPlayer = entities[closestTargetId];

      return isPlayerEntity(targetPlayer)
        ? { playerId: targetPlayer.id, playerName: targetPlayer.name }
        : null;
    };

    const getFieldDropPoint = (clientX: number, clientY: number): Point | null => {
      const topElement = document.elementFromPoint(clientX, clientY);
      if (!topElement?.closest('[data-board-drop-area="true"]')) {
        return null;
      }

      const boardLayer = document.querySelector<SVGGElement>(
        '[data-board-drop-area="true"]',
      );
      const svg = boardLayer?.ownerSVGElement;
      const matrix = boardLayer?.getScreenCTM();
      if (!boardLayer || !svg || !matrix) {
        return null;
      }

      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      const dimensions = PITCH_PRESET_DIMENSIONS[settings.pitchPreset];

      return {
        x: Math.max(0, Math.min(dimensions.width, transformed.x)),
        y: Math.max(0, Math.min(dimensions.height, transformed.y)),
      };
    };

    const finishSubstitution = (clientX: number, clientY: number) => {
      const targetPlayer = getSubstitutionTarget(clientX, clientY);
      if (targetPlayer) {
        substitutePlayers(player.id, targetPlayer.playerId);
        return;
      }

      if (onPitchCount >= MAX_PLAYERS_ON_PITCH) {
        return;
      }

      const fieldDropPoint = getFieldDropPoint(clientX, clientY);
      if (!fieldDropPoint) {
        return;
      }

      placePlayerOnPitch(player.id, fieldDropPoint);
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
      const targetPlayer = getSubstitutionTarget(
        nativeEvent.clientX,
        nativeEvent.clientY,
      );
      const fieldDropPoint =
        !targetPlayer && onPitchCount < MAX_PLAYERS_ON_PITCH
          ? getFieldDropPoint(nativeEvent.clientX, nativeEvent.clientY)
          : null;

      onBenchDragChange?.({
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        team: player.team,
        color: player.color,
        jerseyStyle: player.jerseyStyle,
        clientX: nativeEvent.clientX,
        clientY: nativeEvent.clientY,
        targetPlayerId: targetPlayer?.playerId,
        targetPlayerName: targetPlayer?.playerName,
        fieldDropPoint: fieldDropPoint ?? undefined,
      });
    };

    const handleWindowPointerUp = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== pointerId) {
        return;
      }

      if (hasDragged) {
        suppressClickPlayerIdRef.current = player.id;
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
    sourceElement.setPointerCapture(pointerId);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
  };

  return (
    <aside
      className={`relative w-full overflow-hidden rounded-t-[24px] border-x-0 border-b-0 border-t border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,245,249,0.9))] p-1.5 shadow-[0_-26px_68px_-44px_rgba(15,23,42,0.42)] ring-1 ring-slate-200/70 backdrop-blur-2xl sm:rounded-t-[26px] sm:p-2 ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-x-10 top-0 h-14 rounded-full bg-white/60 blur-2xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex min-w-0 flex-1 rounded-[18px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(241,245,249,0.82))] p-1 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.2)]">
          <TabButton
            label="Casa"
            meta={`${teamSummary.home.onPitch}/${teamSummary.home.total}`}
            tone="home"
            active={teamFilter === "home"}
            onClick={() => {
              dragCleanupRef.current?.();
              setTeamFilter("home");
            }}
          />
          <TabButton
            label="Visitante"
            meta={`${teamSummary.away.onPitch}/${teamSummary.away.total}`}
            tone="away"
            active={teamFilter === "away"}
            onClick={() => {
              dragCleanupRef.current?.();
              setTeamFilter("away");
            }}
          />
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-wrap sm:justify-end">
          <span className="inline-flex h-9 items-center rounded-[16px] border border-slate-200/90 bg-white/92 px-3 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
            {onPitchCount}/{MAX_PLAYERS_ON_PITCH}
          </span>

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
              className="inline-flex h-9 items-center gap-2 rounded-[16px] border border-slate-200/90 bg-white/94 px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
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

      <div className="relative mt-2 flex gap-1.5 overflow-x-auto pb-0.5 pr-0.5">
        {filteredPlayers.map((player) => {
          const isOnPitch = activeFrame?.entityStates[player.id]?.visible ?? true;
          const canEnterDirectly =
            !isOnPitch && onPitchCount < MAX_PLAYERS_ON_PITCH;
          const needsDragSubstitution = !isOnPitch && !canEnterDirectly;
          const statusMeta = getPlayerStatusMeta(isOnPitch, canEnterDirectly);
          const teamTone = getTeamTone(player.team);
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
              className={`group relative min-w-[118px] overflow-hidden rounded-[18px] border px-2 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 sm:min-w-[130px] sm:rounded-[20px] sm:px-2.5 sm:py-2.5 ${statusMeta.cardClass}`}
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
              style={{ touchAction: needsDragSubstitution ? "none" : "pan-x" }}
            >
              <span
                className={`absolute inset-x-3 top-0 h-[2px] rounded-full ${statusMeta.accentClass}`}
                aria-hidden="true"
              />

              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-[14px] border text-sm font-bold shadow-sm sm:h-9 sm:w-9 ${teamTone.strong}`}
                >
                  {player.number}
                </span>

                <div className="flex items-center gap-1.5">
                  {onOpenEditor ? (
                    <button
                      type="button"
                      data-player-card-action="edit"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-[12px] border border-slate-200/90 bg-white/94 text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
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
                    className={`h-2.5 w-2.5 rounded-full ${statusMeta.dotClass} shadow-[0_0_0_4px_rgba(255,255,255,0.9)]`}
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <PlayerAvatar player={player} jerseyStyle={jerseyStyle} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold tracking-[-0.01em] text-slate-900 sm:text-[13px]">
                    {player.name}
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
  meta: string;
  tone: TeamSide;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, meta, tone, active, onClick }: TabButtonProps) {
  const countClass = getTeamTone(tone).count;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 min-w-[112px] flex-1 items-center justify-between gap-2 rounded-[14px] px-3 text-left transition ${
        active
          ? "bg-[linear-gradient(135deg,#0f172a,#1e293b)] text-white shadow-[0_16px_30px_-24px_rgba(15,23,42,0.36)]"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <span className="truncate text-[11px] font-semibold">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          active ? countClass : "bg-slate-100 text-slate-500"
        }`}
      >
        {meta}
      </span>
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-[16px] border border-slate-200/90 bg-white/94 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
