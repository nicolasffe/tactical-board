"use client";

import {
  ArrowRightLeft,
  Check,
  Circle,
  Download,
  DraftingCompass,
  Grid3X3,
  Highlighter,
  MoveRight,
  MousePointer2,
  Redo2,
  RotateCcw,
  ScanLine,
  Send,
  SquarePen,
  Triangle,
  Type,
  Undo2,
  UsersRound,
  Waves,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import { FORMATION_PRESETS } from "@/src/types";
import type {
  BoardMode,
  DrawTool,
  FormationPreset,
  PlayerEntity,
  PitchStyle,
  TacticalEntity,
  TeamSide,
} from "@/src/types";

interface SimpleControlsProps {
  onClose: () => void;
  onSaveTactic: () => void;
  onOpenPlayers?: () => void;
  onOpenPlayerEditor?: () => void;
}

const panelClass =
  "max-h-[calc(100vh-2rem)] w-[min(92vw,340px)] overflow-y-auto rounded-[28px] border border-white/75 bg-white/90 p-3 shadow-[0_28px_72px_-38px_rgba(15,23,42,0.42)] ring-1 ring-slate-200/60 backdrop-blur-2xl";

const sectionClass =
  "rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-3";

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

const subtleButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";

const activeSubtleButtonClass =
  "border-sky-200 bg-sky-50 text-sky-700";

const isPlayerEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

export function SimpleControls({
  onClose,
  onSaveTactic,
  onOpenPlayers,
  onOpenPlayerEditor,
}: SimpleControlsProps) {
  const activeTool = useTacticalBoardStore((state) => state.activeTool);
  const settings = useTacticalBoardStore((state) => state.settings);
  const history = useTacticalBoardStore((state) => state.history);
  const entities = useTacticalBoardStore((state) => state.entities);
  const frames = useTacticalBoardStore((state) => state.frames);
  const activeFrameId = useTacticalBoardStore((state) => state.activeFrameId);

  const setActiveTool = useTacticalBoardStore((state) => state.setActiveTool);
  const setBoardSettings = useTacticalBoardStore(
    (state) => state.setBoardSettings,
  );
  const applyFormation = useTacticalBoardStore((state) => state.applyFormation);
  const addEntity = useTacticalBoardStore((state) => state.addEntity);
  const removeEntity = useTacticalBoardStore((state) => state.removeEntity);
  const undo = useTacticalBoardStore((state) => state.undo);
  const redo = useTacticalBoardStore((state) => state.redo);
  const resetBoard = useTacticalBoardStore((state) => state.resetBoard);
  const swapSides = useTacticalBoardStore((state) => state.swapSides);

  const [team, setTeam] = useState<TeamSide>("home");
  const [formation, setFormation] = useState<FormationPreset>("4-3-3");
  const [trainingSeed, setTrainingSeed] = useState(0);
  const [clickedTool, setClickedTool] = useState<DrawTool | null>(null);

  const activeFrame = useMemo(
    () => frames.find((frame) => frame.id === activeFrameId) ?? frames[0],
    [activeFrameId, frames],
  );

  const squadSummary = useMemo(() => {
    const players = Object.values(entities).filter(isPlayerEntity);
    const homePlayers = players.filter((player) => player.team === "home");
    const awayPlayers = players.filter((player) => player.team === "away");

    const homeVisible = homePlayers.filter(
      (player) => activeFrame?.entityStates[player.id]?.visible ?? true,
    ).length;
    const awayVisible = awayPlayers.filter(
      (player) => activeFrame?.entityStates[player.id]?.visible ?? true,
    ).length;

    return {
      home: `${homeVisible}/${homePlayers.length}`,
      away: `${awayVisible}/${awayPlayers.length}`,
    };
  }, [activeFrame, entities]);

  const handleToolSelect = (tool: DrawTool) => {
    setClickedTool(tool);
    setActiveTool(tool);

    window.setTimeout(() => {
      setClickedTool((current) => (current === tool ? null : current));
    }, 220);
  };

  const onChangeMode = (mode: BoardMode) => {
    if (mode === "training") {
      setBoardSettings({
        mode,
        pitchView: "full",
        training: {
          ...settings.training,
          focus: "full",
          visibleTeams: [settings.training.visibleTeams[0] ?? "home"],
        },
      });
      return;
    }

    setBoardSettings({ mode });
  };

  const onChangeTrainingTeam = (teamSide: TeamSide) => {
    setBoardSettings({
      training: {
        ...settings.training,
        visibleTeams: [teamSide],
      },
    });
  };

  const getTrainingAnchor = () => ({ x: 52.5, y: 34 });

  const getNextTrainingPoint = () => {
    const anchor = getTrainingAnchor();
    const row = Math.floor(trainingSeed / 4) % 3;
    const col = trainingSeed % 4;

    return {
      x: anchor.x - 6 + col * 4,
      y: anchor.y - 6 + row * 6,
    };
  };

  const addTrainingCone = () => {
    addEntity({
      kind: "cone",
      position: getNextTrainingPoint(),
    });
    setTrainingSeed((current) => current + 1);
  };

  const addTrainingConeLine = () => {
    const anchor = getTrainingAnchor();

    Array.from({ length: 5 }, (_, index) => {
      addEntity({
        kind: "cone",
        position: {
          x: anchor.x,
          y: anchor.y - 12 + index * 6,
        },
      });
    });
  };

  const addTrainingMannequin = () => {
    const anchor = getTrainingAnchor();

    addEntity({
      kind: "mannequin",
      position: { x: anchor.x + 8, y: anchor.y },
    });
  };

  const addTrainingBall = () => {
    addEntity({
      kind: "ball",
      position: getTrainingAnchor(),
    });
  };

  const clearTrainingEquipment = () => {
    Object.values(entities)
      .filter(
        (entity) =>
          entity.kind === "ball" ||
          entity.kind === "cone" ||
          entity.kind === "mannequin",
      )
      .forEach((entity) => {
        removeEntity(entity.id);
      });
  };

  return (
    <section className={panelClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Painel
          </p>
          <h2 className="truncate text-sm font-bold text-slate-950">
            Ferramentas
          </h2>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-3">
        <SectionCard icon={UsersRound} title="Jogadores">
          <div className="grid grid-cols-2 gap-2">
            <CountPill label="Casa" value={squadSummary.home} />
            <CountPill label="Visitante" value={squadSummary.away} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {onOpenPlayers ? (
              <ActionButton
                icon={UsersRound}
                label="Jogadores"
                onClick={onOpenPlayers}
              />
            ) : null}
            {onOpenPlayerEditor ? (
              <ActionButton
                icon={SquarePen}
                label="Editar"
                onClick={onOpenPlayerEditor}
              />
            ) : null}
          </div>

          <button
            type="button"
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            onClick={swapSides}
          >
            <ArrowRightLeft size={15} />
            Inverter lados
          </button>
        </SectionCard>

        <SectionCard icon={Grid3X3} title="Modo">
          <div className="grid grid-cols-2 gap-2">
            <SegmentButton
              active={settings.mode === "match"}
              onClick={() => onChangeMode("match")}
              label="Jogo"
            />
            <SegmentButton
              active={settings.mode === "training"}
              onClick={() => onChangeMode("training")}
              label="Treino"
            />
          </div>

          {settings.mode === "training" && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <SegmentButton
                  active={(settings.training.visibleTeams[0] ?? "home") === "home"}
                  onClick={() => onChangeTrainingTeam("home")}
                  label="Casa"
                />
                <SegmentButton
                  active={(settings.training.visibleTeams[0] ?? "home") === "away"}
                  onClick={() => onChangeTrainingTeam("away")}
                  label="Visitante"
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <ActionButton icon={Triangle} label="Cone" onClick={addTrainingCone} />
                <ActionButton
                  icon={Grid3X3}
                  label="Linha"
                  onClick={addTrainingConeLine}
                />
                <ActionButton
                  icon={Grid3X3}
                  label="Manequim"
                  onClick={addTrainingMannequin}
                />
                <ActionButton icon={Circle} label="Bola" onClick={addTrainingBall} />
              </div>

              <button
                type="button"
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
                onClick={clearTrainingEquipment}
              >
                Limpar
              </button>
            </>
          )}
        </SectionCard>

        <SectionCard icon={MousePointer2} title="Ferramentas">
          <div className="grid grid-cols-2 gap-2">
            <ToolTile
              shortLabel="Selecao"
              icon={MousePointer2}
              active={activeTool === "select"}
              clicked={clickedTool === "select"}
              onClick={() => handleToolSelect("select")}
            />
            <ToolTile
              shortLabel="Passe"
              icon={Send}
              active={activeTool === "pass"}
              clicked={clickedTool === "pass"}
              onClick={() => handleToolSelect("pass")}
            />
            <ToolTile
              shortLabel="Corrida"
              icon={MoveRight}
              active={activeTool === "run"}
              clicked={clickedTool === "run"}
              onClick={() => handleToolSelect("run")}
            />
            <ToolTile
              shortLabel="Drible"
              icon={Waves}
              active={activeTool === "dribble"}
              clicked={clickedTool === "dribble"}
              onClick={() => handleToolSelect("dribble")}
            />
            <ToolTile
              shortLabel="Livre"
              icon={Highlighter}
              active={activeTool === "freehand"}
              clicked={clickedTool === "freehand"}
              onClick={() => handleToolSelect("freehand")}
            />
            <ToolTile
              shortLabel="Zona"
              icon={DraftingCompass}
              active={activeTool === "polygon"}
              clicked={clickedTool === "polygon"}
              onClick={() => handleToolSelect("polygon")}
            />
            <ToolTile
              shortLabel="Texto"
              icon={Type}
              active={activeTool === "text"}
              clicked={clickedTool === "text"}
              onClick={() => handleToolSelect("text")}
            />
            <ToolTile
              shortLabel="Lasso"
              icon={ScanLine}
              active={activeTool === "lasso"}
              clicked={clickedTool === "lasso"}
              onClick={() => handleToolSelect("lasso")}
            />
          </div>
        </SectionCard>

        <SectionCard icon={Grid3X3} title="Visual">
          <select
            className={inputClass}
            value={settings.pitchStyle}
            onChange={(event) =>
              setBoardSettings({ pitchStyle: event.target.value as PitchStyle })
            }
            title="Estilo visual do campo"
          >
            <option value="realistic-grass">Grama</option>
            <option value="blueprint">Blueprint</option>
            <option value="minimal-light">Claro</option>
            <option value="minimal-dark">Escuro</option>
          </select>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <ToggleButton
              active={settings.showGrid}
              onClick={() => setBoardSettings({ showGrid: !settings.showGrid })}
              label="Grade"
              icon={Grid3X3}
            />
            <ToggleButton
              active={settings.showZones}
              onClick={() => setBoardSettings({ showZones: !settings.showZones })}
              label="Zonas"
              icon={Grid3X3}
            />
            <ToggleButton
              active={settings.showPlayerNames}
              onClick={() =>
                setBoardSettings({
                  showPlayerNames: !settings.showPlayerNames,
                })
              }
              label="Nomes"
              icon={UsersRound}
            />
            <ToggleButton
              active={settings.snapToEntities}
              onClick={() =>
                setBoardSettings({
                  snapToEntities: !settings.snapToEntities,
                })
              }
              label="Snap"
              icon={MousePointer2}
            />
          </div>
        </SectionCard>

        <SectionCard icon={Grid3X3} title="Formacao">
          <div className="grid grid-cols-2 gap-2">
            <select
              className={inputClass}
              value={team}
              onChange={(event) => setTeam(event.target.value as TeamSide)}
              title="Selecionar time"
            >
              <option value="home">Casa</option>
              <option value="away">Visitante</option>
            </select>

            <select
              className={inputClass}
              value={formation}
              onChange={(event) =>
                setFormation(event.target.value as FormationPreset)
              }
              title="Selecionar formacao"
            >
              {FORMATION_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800"
            onClick={() => applyFormation(team, formation)}
          >
            Aplicar
          </button>
        </SectionCard>

        <SectionCard icon={Download} title="Arquivo">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={subtleButtonClass}
              disabled={history.past.length === 0}
              onClick={undo}
            >
              <Undo2 size={14} />
            </button>

            <button
              type="button"
              className={subtleButtonClass}
              disabled={history.future.length === 0}
              onClick={redo}
            >
              <Redo2 size={14} />
            </button>

            <button
              type="button"
              className={subtleButtonClass}
              onClick={resetBoard}
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <button
            type="button"
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onSaveTactic}
          >
            <Download size={14} />
            Salvar
          </button>
        </SectionCard>
      </div>
    </section>
  );
}

interface SectionCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}

function SectionCard({ icon: Icon, title, children }: SectionCardProps) {
  return (
    <section className={sectionClass}>
      <div className="mb-2 flex items-center gap-2">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
          <Icon size={14} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

interface CountPillProps {
  label: string;
  value: string;
}

function CountPill({ label, value }: CountPillProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

interface SegmentButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function SegmentButton({ active, label, onClick }: SegmentButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-semibold shadow-sm transition ${
        active
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

interface ActionButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
}

function ActionButton({ icon: Icon, label, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

interface ToggleButtonProps {
  active: boolean;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
}

function ToggleButton({
  active,
  label,
  icon: Icon,
  onClick,
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${subtleButtonClass} ${active ? activeSubtleButtonClass : ""}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

interface ToolTileProps {
  shortLabel: string;
  active: boolean;
  clicked: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
}

function ToolTile({
  shortLabel,
  active,
  clicked,
  icon: Icon,
  onClick,
}: ToolTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[66px] flex-col items-start justify-between overflow-hidden rounded-[20px] border px-3 py-2.5 text-left shadow-sm transition-all duration-200 ${
        active
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      } ${clicked ? "scale-[0.985]" : ""}`}
    >
      {active ? (
        <span className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
          <Check size={10} strokeWidth={3} />
        </span>
      ) : null}

      <div className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200/80 bg-white">
        <Icon size={15} />
      </div>

      <span className="text-xs font-semibold">{shortLabel}</span>
    </button>
  );
}
