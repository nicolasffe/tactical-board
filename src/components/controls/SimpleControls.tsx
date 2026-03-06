"use client";

import {
  Check,
  Circle,
  DraftingCompass,
  Grid3X3,
  Highlighter,
  ScanLine,
  MoveRight,
  MousePointer2,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Triangle,
  Type,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import { useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import { FORMATION_PRESETS } from "@/src/types";
import type {
  BoardMode,
  DrawTool,
  FormationPreset,
  PitchStyle,
  TeamSide,
} from "@/src/types";

interface SimpleControlsProps {
  onClose: () => void;
}

const sectionClass =
  "mt-2 rounded-xl border border-slate-200/85 bg-white/70 p-2";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";
const toolButtonClass =
  "relative inline-flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-300 will-change-transform hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]";
const activeToolButtonClass =
  "border-slate-400 bg-slate-100 text-slate-900 ring-1 ring-slate-300 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.35)]";

export function SimpleControls({ onClose }: SimpleControlsProps) {
  const activeTool = useTacticalBoardStore((state) => state.activeTool);
  const settings = useTacticalBoardStore((state) => state.settings);
  const history = useTacticalBoardStore((state) => state.history);
  const entities = useTacticalBoardStore((state) => state.entities);

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

  const [team, setTeam] = useState<TeamSide>("home");
  const [formation, setFormation] = useState<FormationPreset>("4-3-3");
  const [trainingSeed, setTrainingSeed] = useState(0);
  const [clickedTool, setClickedTool] = useState<DrawTool | null>(null);

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
        training: {
          ...settings.training,
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

  const getTrainingAnchor = () => {
    if (settings.training.focus === "half-defending") {
      return { x: 26.25, y: 34 };
    }

    if (settings.training.focus === "half-attacking") {
      return { x: 78.75, y: 34 };
    }

    return { x: 52.5, y: 34 };
  };

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
    <section className="max-h-[calc(100vh-7rem)] w-[min(90vw,360px)] overflow-y-auto rounded-2xl border border-white/80 bg-white/88 p-3 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Painel
          </p>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Sparkles size={14} className="text-sky-600" />
            Controles do Quadro
          </h2>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          <X size={14} />
        </button>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Treino
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
            value={settings.mode}
            onChange={(event) => onChangeMode(event.target.value as BoardMode)}
          >
            <option value="match">Modo Jogo</option>
            <option value="training">Modo Treino</option>
          </select>

          {settings.mode === "training" && (
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
              value={settings.training.focus}
              onChange={(event) =>
                setBoardSettings({
                  training: {
                    ...settings.training,
                    focus: event.target.value as typeof settings.training.focus,
                  },
                })
              }
            >
              <option value="half-attacking">Meio Ofensivo</option>
              <option value="half-defending">Meio Defensivo</option>
              <option value="full">Campo Completo</option>
            </select>
          )}

          {settings.mode === "training" && (
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
              value={settings.training.visibleTeams[0] ?? "home"}
              onChange={(event) =>
                onChangeTrainingTeam(event.target.value as TeamSide)
              }
            >
              <option value="home">Time Casa</option>
              <option value="away">Time Visitante</option>
            </select>
          )}
        </div>

        {settings.mode === "training" && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={buttonClass}
              onClick={addTrainingCone}
            >
              <Triangle size={13} />+ Cone
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={addTrainingConeLine}
            >
              <Grid3X3 size={13} />
              Linha Cones
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={addTrainingMannequin}
            >
              <Grid3X3 size={13} />+ Manequim
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={addTrainingBall}
            >
              <Circle size={13} />+ Bola
            </button>
            <button
              type="button"
              className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
              onClick={clearTrainingEquipment}
            >
              Limpar equipamentos
            </button>
          </div>
        )}
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Ferramentas
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "select" ? activeToolButtonClass : ""} ${clickedTool === "select" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("select")}
            aria-pressed={activeTool === "select"}
          >
            {activeTool === "select" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <MousePointer2 size={13} className="relative z-10" />
            <span className="relative z-10">Sel.</span>
          </button>
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "pass" ? activeToolButtonClass : ""} ${clickedTool === "pass" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("pass")}
            aria-pressed={activeTool === "pass"}
          >
            {activeTool === "pass" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <Send size={13} className="relative z-10" />
            <span className="relative z-10">Passe</span>
          </button>
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "run" ? activeToolButtonClass : ""} ${clickedTool === "run" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("run")}
            aria-pressed={activeTool === "run"}
          >
            {activeTool === "run" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <MoveRight size={13} className="relative z-10" />
            <span className="relative z-10">Corr.</span>
          </button>
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "dribble" ? activeToolButtonClass : ""} ${clickedTool === "dribble" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("dribble")}
            aria-pressed={activeTool === "dribble"}
          >
            {activeTool === "dribble" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <Waves size={13} className="relative z-10" />
            <span className="relative z-10">Drib.</span>
          </button>
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "freehand" ? activeToolButtonClass : ""} ${clickedTool === "freehand" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("freehand")}
            aria-pressed={activeTool === "freehand"}
          >
            {activeTool === "freehand" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <Highlighter size={13} className="relative z-10" />
            <span className="relative z-10">Livre</span>
          </button>
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "polygon" ? activeToolButtonClass : ""} ${clickedTool === "polygon" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("polygon")}
            aria-pressed={activeTool === "polygon"}
          >
            {activeTool === "polygon" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <DraftingCompass size={13} className="relative z-10" />
            <span className="relative z-10">Zona</span>
          </button>
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "text" ? activeToolButtonClass : ""} ${clickedTool === "text" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("text")}
            aria-pressed={activeTool === "text"}
          >
            {activeTool === "text" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <Type size={13} className="relative z-10" />
            <span className="relative z-10">Texto</span>
          </button>
          <button
            type="button"
            className={`${toolButtonClass} ${activeTool === "lasso" ? activeToolButtonClass : ""} ${clickedTool === "lasso" ? "tool-click-pop" : ""}`}
            onClick={() => handleToolSelect("lasso")}
            aria-pressed={activeTool === "lasso"}
          >
            {activeTool === "lasso" && (
              <>
                <span className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-slate-200" />
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Check size={9} strokeWidth={3} />
                </span>
              </>
            )}
            <ScanLine size={13} className="relative z-10" />
            <span className="relative z-10">Lasso</span>
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Visual
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
            value={settings.pitchStyle}
            onChange={(event) =>
              setBoardSettings({ pitchStyle: event.target.value as PitchStyle })
            }
          >
            <option value="realistic-grass">Grama Realista</option>
            <option value="blueprint">Blueprint</option>
            <option value="minimal-light">Minimalista Claro</option>
            <option value="minimal-dark">Minimalista Escuro</option>
          </select>

          <button
            type="button"
            className={buttonClass}
            onClick={() => setBoardSettings({ showGrid: !settings.showGrid })}
          >
            <Grid3X3 size={13} />
            {settings.showGrid ? "Sem grade" : "Com grade"}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setBoardSettings({ showZones: !settings.showZones })}
          >
            <Grid3X3 size={13} />
            {settings.showZones ? "Sem zonas" : "Com zonas"}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              setBoardSettings({ showPlayerNames: !settings.showPlayerNames })
            }
          >
            <MousePointer2 size={13} />
            {settings.showPlayerNames ? "Sem nomes" : "Com nomes"}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              setBoardSettings({ snapToEntities: !settings.snapToEntities })
            }
          >
            <MousePointer2 size={13} />
            {settings.snapToEntities ? "Snap ON" : "Snap OFF"}
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Formação
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
            value={team}
            onChange={(event) => setTeam(event.target.value as TeamSide)}
          >
            <option value="home">Casa</option>
            <option value="away">Fora</option>
          </select>
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
            value={formation}
            onChange={(event) =>
              setFormation(event.target.value as FormationPreset)
            }
          >
            {FORMATION_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
            onClick={() => applyFormation(team, formation)}
          >
            Aplicar
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Ações
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            className={buttonClass}
            disabled={history.past.length === 0}
            onClick={undo}
          >
            <Undo2 size={13} />
            Desf.
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={history.future.length === 0}
            onClick={redo}
          >
            <Redo2 size={13} />
            Ref.
          </button>
          <button type="button" className={buttonClass} onClick={resetBoard}>
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
