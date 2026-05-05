"use client";

import {
  ArrowRightLeft,
  Check,
  Circle,
  Download,
  DraftingCompass,
  Fence,
  Goal,
  Highlighter,
  LayoutDashboard,
  Map as MapIcon,
  MoveRight,
  MousePointer2,
  Palette,
  Rows3,
  ScanLine,
  Send,
  Shirt,
  SquarePen,
  Triangle,
  Type,
  UsersRound,
  Waves,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useTacticalBoardStore } from "@/src/store";
import { FORMATION_PRESETS, PITCH_PRESET_DIMENSIONS } from "@/src/types";
import type {
  BoardMode,
  DrawTool,
  FormationPreset,
  PitchDimensions,
  PitchView,
  PlayerEntity,
  PitchStyle,
  TacticalEntity,
  TeamSide,
  TrainingFieldLayout,
} from "@/src/types";
import { OptionField } from "./OptionField";

interface SimpleControlsProps {
  onClose: () => void;
  onSaveTactic: () => void;
  onOpenPlayers?: () => void;
  onOpenPlayerEditor?: () => void;
}

const panelClass =
  "max-h-[min(calc(100svh-5.5rem),48rem)] w-[min(calc(100vw-1rem),348px)] max-w-full overflow-y-auto rounded-xl border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,250,0.92))] p-2.5 shadow-[0_34px_88px_-46px_rgba(15,23,42,0.58)] ring-1 ring-white/70 backdrop-blur-2xl sm:max-h-[calc(100svh-2rem)] sm:p-3";

const sectionClass =
  "rounded-lg border border-slate-200/95 bg-white/88 p-2.5 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.32)] sm:p-3";

const subtleButtonClass =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-300/80 bg-white/92 px-3 text-[11px] font-semibold text-slate-700 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)] transition hover:border-teal-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 sm:text-xs";

const activeSubtleButtonClass =
  "border-teal-300 bg-teal-50 text-teal-800 ring-1 ring-teal-100";

interface TrainingFieldLayoutOption {
  value: TrainingFieldLayout;
  label: string;
}

const trainingFieldLayoutOptions: TrainingFieldLayoutOption[] = [
  { value: "none", label: "Sem divisão" },
  { value: "vertical-halves", label: "2 meios" },
  { value: "horizontal-halves", label: "2 faixas" },
  { value: "horizontal-thirds", label: "3 faixas" },
  { value: "horizontal-fourths", label: "4 faixas" },
  { value: "vertical-thirds", label: "3 setores" },
  { value: "vertical-fifths", label: "5 corredores" },
  { value: "quarters", label: "4 quadrantes" },
  { value: "six-zones", label: "6 zonas" },
  { value: "central-corridor", label: "Corredor central" },
  { value: "wide-channels", label: "Laterais" },
  { value: "attacking-third", label: "Terço ofensivo" },
  { value: "defensive-third", label: "Terço defensivo" },
  { value: "attacking-channels", label: "Finalização" },
  { value: "defensive-channels", label: "Construção" },
];

const getTrainingFieldLayoutOption = (
  value: TrainingFieldLayout,
): TrainingFieldLayoutOption => {
  const option = trainingFieldLayoutOptions.find((item) => item.value === value);
  if (!option) {
    throw new Error(`Unknown training field layout: ${value}`);
  }

  return option;
};

const trainingFieldLayoutGroups: Array<{
  label: string;
  options: TrainingFieldLayoutOption[];
}> = [
  {
    label: "Básicas",
    options: ([
      "none",
      "vertical-halves",
      "horizontal-halves",
      "quarters",
      "six-zones",
    ] as TrainingFieldLayout[]).map(getTrainingFieldLayoutOption),
  },
  {
    label: "Faixas",
    options: ([
      "horizontal-thirds",
      "horizontal-fourths",
      "attacking-third",
      "defensive-third",
    ] as TrainingFieldLayout[]).map(getTrainingFieldLayoutOption),
  },
  {
    label: "Corredores",
    options: ([
      "vertical-thirds",
      "vertical-fifths",
      "central-corridor",
      "wide-channels",
    ] as TrainingFieldLayout[]).map(getTrainingFieldLayoutOption),
  },
  {
    label: "Treino",
    options: (["attacking-channels", "defensive-channels"] as TrainingFieldLayout[]).map(
      getTrainingFieldLayoutOption,
    ),
  },
];

const trainingPitchViewOptions: Array<{
  value: PitchView;
  label: string;
}> = [
  { value: "full", label: "Inteiro" },
  { value: "left-half", label: "Meio esq." },
  { value: "right-half", label: "Meio dir." },
];

const isPlayerEntity = (entity: TacticalEntity): entity is PlayerEntity =>
  entity.kind === "player" || entity.kind === "goalkeeper";

const isTrainingEquipmentEntity = (entity: TacticalEntity): boolean =>
  entity.kind === "ball" ||
  entity.kind === "cone" ||
  entity.kind === "mannequin" ||
  entity.kind === "portableGoal" ||
  entity.kind === "miniGoal" ||
  entity.kind === "hurdle";

const pitchStyleOptions: Array<{ value: PitchStyle; label: string }> = [
  { value: "tactical-pad", label: "Prancheta tática" },
  { value: "realistic-grass", label: "Grama" },
  { value: "blueprint", label: "Planta técnica" },
  { value: "minimal-light", label: "Claro" },
  { value: "minimal-dark", label: "Escuro" },
];

const teamOptions: Array<{ value: TeamSide; label: string }> = [
  { value: "home", label: "Casa" },
  { value: "away", label: "Visitante" },
];

const formationOptions = FORMATION_PRESETS.map((preset) => ({
  value: preset,
  label: preset,
}));

export function SimpleControls({
  onClose,
  onSaveTactic,
  onOpenPlayers,
  onOpenPlayerEditor,
}: SimpleControlsProps) {
  const activeTool = useTacticalBoardStore((state) => state.activeTool);
  const settings = useTacticalBoardStore((state) => state.settings);
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

  const onChangeTrainingFieldLayout = (fieldLayout: TrainingFieldLayout) => {
    setBoardSettings({
      training: {
        ...settings.training,
        fieldLayout,
      },
    });
  };

  const onChangeTrainingPitchView = (pitchView: PitchView) => {
    setBoardSettings({ pitchView });
  };

  const getCurrentPitchDimensions = (): PitchDimensions =>
    PITCH_PRESET_DIMENSIONS[settings.pitchPreset] ??
    PITCH_PRESET_DIMENSIONS["football-105x68"];

  const clampTrainingPoint = (
    point: { x: number; y: number },
    margin = 5,
  ) => {
    const dimensions = getCurrentPitchDimensions();

    return {
      x: Math.min(
        dimensions.width - margin,
        Math.max(margin, point.x),
      ),
      y: Math.min(
        dimensions.height - margin,
        Math.max(margin, point.y),
      ),
    };
  };

  const getTrainingAnchor = () => {
    const dimensions = getCurrentPitchDimensions();
    const x =
      settings.pitchView === "left-half"
        ? dimensions.width * 0.25
        : settings.pitchView === "right-half" || settings.pitchView === "half"
          ? dimensions.width * 0.75
          : dimensions.width * 0.5;

    return { x, y: dimensions.height * 0.5 };
  };

  const getNextTrainingPoint = () => {
    const anchor = getTrainingAnchor();
    const row = Math.floor(trainingSeed / 4) % 3;
    const col = trainingSeed % 4;

    return clampTrainingPoint({
      x: anchor.x - 6 + col * 4,
      y: anchor.y - 6 + row * 6,
    });
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
        position: clampTrainingPoint({
          x: anchor.x,
          y: anchor.y - 12 + index * 6,
        }),
      });
    });
  };

  const addTrainingMannequin = () => {
    const anchor = getTrainingAnchor();

    addEntity({
      kind: "mannequin",
      position: clampTrainingPoint({ x: anchor.x + 8, y: anchor.y }),
    });
  };

  const addTrainingBall = () => {
    addEntity({
      kind: "ball",
      position: getTrainingAnchor(),
    });
  };

  const addTrainingBallCluster = () => {
    const anchor = getTrainingAnchor();

    [
      { x: 0, y: 0 },
      { x: 2.6, y: -1.8 },
      { x: -2.6, y: -1.8 },
      { x: 2.6, y: 1.8 },
      { x: -2.6, y: 1.8 },
    ].forEach((offset) => {
      addEntity({
        kind: "ball",
        position: clampTrainingPoint({
          x: anchor.x + offset.x,
          y: anchor.y + offset.y,
        }),
      });
    });
  };

  const addTrainingPortableGoal = () => {
    const anchor = getTrainingAnchor();

    addEntity({
      kind: "portableGoal",
      position: clampTrainingPoint({ x: anchor.x + 10, y: anchor.y }, 9),
    });
  };

  const addTrainingMiniGoal = () => {
    const anchor = getTrainingAnchor();

    addEntity({
      kind: "miniGoal",
      position: clampTrainingPoint({ x: anchor.x - 10, y: anchor.y }, 7),
    });
  };

  const addTrainingHurdle = () => {
    const anchor = getTrainingAnchor();

    addEntity({
      kind: "hurdle",
      position: clampTrainingPoint({ x: anchor.x, y: anchor.y + 10 }),
    });
  };

  const clearTrainingEquipment = () => {
    Object.values(entities)
      .filter(isTrainingEquipmentEntity)
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
          <h2 className="truncate text-sm font-bold text-slate-950 sm:text-[15px]">
            Ferramentas
          </h2>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300/80 bg-white/94 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)] transition hover:border-teal-300 hover:bg-white"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-3">
        <SectionCard icon={UsersRound} title="Jogadores">
          <div className="grid grid-cols-2 gap-2">
            <CountPill label="Casa" value={squadSummary.home} tone="home" />
            <CountPill
              label="Visitante"
              value={squadSummary.away}
              tone="away"
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {onOpenPlayers ? (
              <ActionButton
                icon={UsersRound}
                label="Jogadores"
                onClick={onOpenPlayers}
                variant="primary"
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
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300/80 bg-white/92 px-3.5 text-xs font-semibold text-slate-700 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)] transition hover:border-teal-300 hover:bg-white"
            onClick={swapSides}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600">
              <ArrowRightLeft size={15} />
            </span>
            <span className="text-xs font-semibold text-slate-800">
              Inverter lados
            </span>
          </button>
        </SectionCard>

        <SectionCard icon={LayoutDashboard} title="Modo">
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

              <div className="mt-2 grid grid-cols-3 gap-2">
                {trainingPitchViewOptions.map((option) => (
                  <MiniPitchViewButton
                    key={option.value}
                    option={option}
                    active={
                      settings.pitchView === option.value ||
                      (settings.pitchView === "half" &&
                        option.value === "right-half")
                    }
                    onClick={() => onChangeTrainingPitchView(option.value)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="mt-3 rounded-lg border border-sky-200/90 bg-sky-50/75 p-2 shadow-[0_16px_34px_-28px_rgba(14,165,233,0.42)] ring-1 ring-white/70">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-sky-200 bg-white/86 text-sky-700">
                  <MapIcon size={14} />
                </span>
                <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-700">
                  Divisão do campo
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-white/86 px-2.5 py-1 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
                {
                  getTrainingFieldLayoutOption(settings.training.fieldLayout)
                    .label
                }
              </span>
            </div>

            <div className="space-y-2">
              {trainingFieldLayoutGroups.map((group) => (
                <div key={group.label}>
                  <div className="mb-1 flex items-center gap-1.5 px-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500/80" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {group.label}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((option) => (
                      <MiniFieldLayoutButton
                        key={option.value}
                        option={option}
                        active={settings.training.fieldLayout === option.value}
                        onClick={() => onChangeTrainingFieldLayout(option.value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {settings.mode === "training" && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ActionButton icon={Triangle} label="Cone" onClick={addTrainingCone} />
                <ActionButton
                  icon={Rows3}
                  label="Linha"
                  onClick={addTrainingConeLine}
                />
                <ActionButton
                  icon={Shirt}
                  label="Manequim"
                  onClick={addTrainingMannequin}
                />
                <ActionButton icon={Circle} label="Bola" onClick={addTrainingBall} />
                <ActionButton
                  icon={Circle}
                  label="Bolas"
                  onClick={addTrainingBallCluster}
                />
                <ActionButton
                  icon={Goal}
                  label="Gol"
                  onClick={addTrainingPortableGoal}
                />
                <ActionButton
                  icon={Goal}
                  label="Mini gol"
                  onClick={addTrainingMiniGoal}
                />
                <ActionButton
                  icon={Fence}
                  label="Barreira"
                  onClick={addTrainingHurdle}
                />
              </div>

              <button
                type="button"
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
                onClick={clearTrainingEquipment}
              >
                Limpar
              </button>

              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                Selecione um equipamento no campo para girar ou excluir sem
                abrir outro painel.
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard icon={MousePointer2} title="Ferramentas">
          <div className="grid grid-cols-2 gap-2">
            <ToolTile
              shortLabel="Seleção"
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
              shortLabel="Laço"
              icon={ScanLine}
              active={activeTool === "lasso"}
              clicked={clickedTool === "lasso"}
              onClick={() => handleToolSelect("lasso")}
            />
          </div>
        </SectionCard>

        <SectionCard icon={Palette} title="Visual">
          <OptionField
            icon={Palette}
            options={pitchStyleOptions}
            value={settings.pitchStyle}
            onChange={(nextValue) =>
              setBoardSettings({ pitchStyle: nextValue as PitchStyle })
            }
            title="Estilo visual do campo"
          />

          <div className="mt-2 grid grid-cols-1 gap-2">
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
          </div>
        </SectionCard>

        <SectionCard icon={DraftingCompass} title="Formação">
          <div className="grid grid-cols-2 gap-2">
            <OptionField
              icon={UsersRound}
              options={teamOptions}
              value={team}
              onChange={(nextValue) => setTeam(nextValue as TeamSide)}
              title="Selecionar time"
            />

            <OptionField
              icon={DraftingCompass}
              options={formationOptions}
              value={formation}
              onChange={(nextValue) =>
                setFormation(nextValue as FormationPreset)
              }
              title="Selecionar formação"
            />
          </div>

          <button
            type="button"
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-[0_18px_38px_-28px_rgba(15,23,42,0.55)] transition hover:bg-slate-800"
            onClick={() => applyFormation(team, formation)}
          >
            Aplicar
          </button>
        </SectionCard>

        <SectionCard icon={Download} title="Arquivo">
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300/80 bg-white/92 px-3 text-xs font-semibold text-slate-700 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)] transition hover:border-teal-300 hover:bg-white"
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

interface MiniPitchViewButtonProps {
  option: (typeof trainingPitchViewOptions)[number];
  active: boolean;
  onClick: () => void;
}

const getMiniPitchViewBox = (pitchView: PitchView): string => {
  if (pitchView === "left-half") {
    return "0 0 48 60";
  }

  if (pitchView === "right-half" || pitchView === "half") {
    return "48 0 48 60";
  }

  return "0 0 96 60";
};

function MiniPitchViewButton({
  option,
  active,
  onClick,
}: MiniPitchViewButtonProps) {
  return (
    <button
      type="button"
      className={`relative min-w-0 overflow-hidden rounded-lg border p-1.5 text-left shadow-[0_14px_30px_-26px_rgba(15,23,42,0.34)] transition hover:border-teal-300 hover:bg-white ${
        active
          ? "border-teal-300 bg-teal-50 ring-1 ring-teal-100"
          : "border-slate-300/80 bg-white/92"
      }`}
      onClick={onClick}
      aria-pressed={active}
      title={option.label}
    >
      {active ? (
        <span className="absolute right-1.5 top-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm">
          <Check size={10} strokeWidth={3} />
        </span>
      ) : null}

      <svg
        viewBox={getMiniPitchViewBox(option.value)}
        className="block aspect-[8/5] w-full rounded-md bg-[#6f9d3d]"
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <rect
            key={`pitch-view-stripe-${option.value}-${index}`}
            x={index * 12}
            y={0}
            width={12}
            height={60}
            fill={index % 2 === 0 ? "#7faa47" : "#68983a"}
          />
        ))}
        <rect
          x={7}
          y={5}
          width={82}
          height={50}
          fill="none"
          stroke="rgba(238,247,224,0.78)"
          strokeWidth={0.9}
        />
        <line
          x1={48}
          y1={5}
          x2={48}
          y2={55}
          stroke="rgba(238,247,224,0.68)"
          strokeWidth={0.8}
        />
        <circle
          cx={48}
          cy={30}
          r={7.2}
          fill="none"
          stroke="rgba(238,247,224,0.62)"
          strokeWidth={0.7}
        />
        <rect
          x={7}
          y={18}
          width={16}
          height={24}
          fill="none"
          stroke="rgba(238,247,224,0.72)"
          strokeWidth={0.75}
        />
        <rect
          x={73}
          y={18}
          width={16}
          height={24}
          fill="none"
          stroke="rgba(238,247,224,0.72)"
          strokeWidth={0.75}
        />
        <rect
          x={7}
          y={24}
          width={7}
          height={12}
          fill="none"
          stroke="rgba(238,247,224,0.7)"
          strokeWidth={0.65}
        />
        <rect
          x={82}
          y={24}
          width={7}
          height={12}
          fill="none"
          stroke="rgba(238,247,224,0.7)"
          strokeWidth={0.65}
        />
      </svg>

      <span className="mt-1 block truncate px-0.5 text-[9.5px] font-semibold text-slate-700 sm:text-[10px]">
        {option.label}
      </span>
    </button>
  );
}

interface MiniFieldLayoutButtonProps {
  option: TrainingFieldLayoutOption;
  active: boolean;
  onClick: () => void;
}

interface MiniFieldLayoutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const getMiniFieldLayoutLines = (
  layout: TrainingFieldLayout,
): MiniFieldLayoutLine[] => {
  if (layout === "none") {
    return [];
  }

  const insetX = 7;
  const insetY = 5;
  const innerWidth = 82;
  const innerHeight = 50;
  const x = (ratio: number) => insetX + innerWidth * ratio;
  const y = (ratio: number) => insetY + innerHeight * ratio;
  const vertical = (
    ratio: number,
    start = 0,
    end = 1,
  ): MiniFieldLayoutLine => ({
    x1: x(ratio),
    y1: y(start),
    x2: x(ratio),
    y2: y(end),
  });
  const horizontal = (
    ratio: number,
    start = 0,
    end = 1,
  ): MiniFieldLayoutLine => ({
    x1: x(start),
    y1: y(ratio),
    x2: x(end),
    y2: y(ratio),
  });

  switch (layout) {
    case "vertical-halves":
      return [vertical(0.5)];
    case "horizontal-halves":
      return [horizontal(0.5)];
    case "horizontal-thirds":
      return [horizontal(1 / 3), horizontal(2 / 3)];
    case "horizontal-fourths":
      return [horizontal(0.25), horizontal(0.5), horizontal(0.75)];
    case "vertical-thirds":
      return [vertical(1 / 3), vertical(2 / 3)];
    case "vertical-fifths":
      return [vertical(0.2), vertical(0.4), vertical(0.6), vertical(0.8)];
    case "quarters":
      return [vertical(0.5), horizontal(0.5)];
    case "six-zones":
      return [vertical(1 / 3), vertical(2 / 3), horizontal(0.5)];
    case "central-corridor":
      return [vertical(0.34), vertical(0.66)];
    case "wide-channels":
      return [vertical(0.18), vertical(0.82)];
    case "attacking-third":
      return [vertical(2 / 3)];
    case "defensive-third":
      return [vertical(1 / 3)];
    case "attacking-channels":
      return [
        vertical(2 / 3),
        horizontal(1 / 3, 2 / 3, 1),
        horizontal(2 / 3, 2 / 3, 1),
      ];
    case "defensive-channels":
      return [
        vertical(1 / 3),
        horizontal(1 / 3, 0, 1 / 3),
        horizontal(2 / 3, 0, 1 / 3),
      ];
    default:
      return [];
  }
};

function MiniFieldLayoutButton({
  option,
  active,
  onClick,
}: MiniFieldLayoutButtonProps) {
  const layoutLines = getMiniFieldLayoutLines(option.value);

  return (
    <button
      type="button"
      className={`relative overflow-hidden rounded-lg border p-1.5 text-left shadow-[0_14px_30px_-26px_rgba(15,23,42,0.34)] transition hover:border-teal-300 hover:bg-white ${
        active
          ? "border-teal-300 bg-teal-50 ring-1 ring-teal-100"
          : "border-slate-300/80 bg-white/92"
      }`}
      onClick={onClick}
      aria-pressed={active}
      title={option.label}
    >
      {active ? (
        <span className="absolute right-2 top-2 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm">
          <Check size={10} strokeWidth={3} />
        </span>
      ) : null}

      <svg
        viewBox="0 0 96 60"
        className="block aspect-[8/5] w-full rounded-md bg-[#6f9d3d]"
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <rect
            key={`stripe-${index}`}
            x={index * 12}
            y={0}
            width={12}
            height={60}
            fill={index % 2 === 0 ? "#7faa47" : "#68983a"}
          />
        ))}
        <rect
          x={7}
          y={5}
          width={82}
          height={50}
          fill="none"
          stroke="rgba(238,247,224,0.78)"
          strokeWidth={0.9}
        />
        <line
          x1={48}
          y1={5}
          x2={48}
          y2={55}
          stroke="rgba(238,247,224,0.62)"
          strokeWidth={0.7}
        />
        <circle
          cx={48}
          cy={30}
          r={7.2}
          fill="none"
          stroke="rgba(238,247,224,0.62)"
          strokeWidth={0.7}
        />
        <rect
          x={7}
          y={18}
          width={16}
          height={24}
          fill="none"
          stroke="rgba(238,247,224,0.72)"
          strokeWidth={0.75}
        />
        <rect
          x={73}
          y={18}
          width={16}
          height={24}
          fill="none"
          stroke="rgba(238,247,224,0.72)"
          strokeWidth={0.75}
        />
        <rect
          x={7}
          y={24}
          width={7}
          height={12}
          fill="none"
          stroke="rgba(238,247,224,0.7)"
          strokeWidth={0.65}
        />
        <rect
          x={82}
          y={24}
          width={7}
          height={12}
          fill="none"
          stroke="rgba(238,247,224,0.7)"
          strokeWidth={0.65}
        />
        <g
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={1}
          strokeDasharray="3 2.2"
          strokeLinecap="round"
        >
          {layoutLines.map((line, index) => (
            <line
              key={`${option.value}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </g>
      </svg>

      <span className="mt-1 block truncate px-0.5 text-[10px] font-semibold text-slate-700">
        {option.label}
      </span>
    </button>
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
        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-slate-50 text-slate-600">
          <Icon size={14} />
        </div>
        <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

interface CountPillProps {
  label: string;
  value: string;
  tone: "home" | "away";
}

function CountPill({ label, value, tone }: CountPillProps) {
  const toneClass =
    tone === "home"
      ? "bg-sky-500 shadow-sky-200/80"
      : "bg-amber-500 shadow-amber-200/80";

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/92 px-3 py-2.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)]">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_0_5px] ${toneClass}`}
          aria-hidden="true"
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[15px] font-bold tracking-[-0.02em] text-slate-900">
        {value}
      </p>
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
      className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)] transition ${
        active
          ? "border-teal-300 bg-teal-50 text-teal-800 ring-1 ring-teal-100"
          : "border-slate-300/80 bg-white/92 text-slate-600 hover:border-teal-300 hover:bg-white"
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
  variant?: "default" | "primary";
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 min-w-0 items-center gap-2.5 rounded-lg border px-3 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.34)] transition sm:text-xs ${
        variant === "primary"
          ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
          : "border-slate-300/80 bg-white/92 text-slate-700 hover:border-teal-300 hover:bg-white"
      }`}
    >
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
          variant === "primary"
            ? "border-white/15 bg-white/10 text-white"
            : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        <Icon size={14} className="shrink-0" />
      </span>
      <span className="truncate text-[11px] font-semibold sm:text-xs">
        {label}
      </span>
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
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
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
      className={`relative flex min-h-[56px] flex-col items-start justify-between overflow-hidden rounded-lg border px-2.5 py-2.5 text-left shadow-[0_14px_30px_-26px_rgba(15,23,42,0.34)] transition-all duration-200 sm:min-h-[62px] sm:px-3 sm:py-3 ${
        active
          ? "border-teal-300 bg-white/96 text-slate-950 ring-1 ring-teal-100"
          : "border-slate-300/80 bg-white/92 text-slate-700 hover:border-teal-300 hover:bg-white"
      } ${clicked ? "scale-[0.985]" : ""}`}
    >
      <span
        className={`absolute inset-y-2 left-0 w-[3px] rounded-r-full ${
          active ? "bg-teal-500" : "bg-transparent"
        }`}
        aria-hidden="true"
      />

      <div
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
          active
            ? "border-teal-200 bg-teal-50 text-teal-700"
            : "border-slate-200/90 bg-slate-50"
        }`}
      >
        <Icon size={15} />
      </div>

      <span className="text-[11px] font-semibold leading-tight sm:text-xs">
        {shortLabel}
      </span>
    </button>
  );
}
