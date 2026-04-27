"use client";

import {
  GripHorizontal,
  LayoutPanelLeft,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Undo2,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BoardCanvas } from "@/src/components/board";
import { BottomPlayerPanel } from "@/src/components/controls/BottomPlayerPanel";
import {
  PlayerEditorPanel,
  SimpleControls,
  TimelineBar,
} from "@/src/components/controls";
import {
  appendGifFrame,
  createGifEncoder,
  downloadGif,
  getSvgExportSize,
  renderSvgToImageData,
  waitForPaint,
} from "@/src/lib/gifExport";
import { useTacticalBoardStore } from "@/src/store";
import type { BenchDragPreview, Id, PlaybackState } from "@/src/types";

export default function TacticalBoard() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const playbackPanelRef = useRef<HTMLDivElement | null>(null);

  const playback = useTacticalBoardStore((state) => state.playback);
  const history = useTacticalBoardStore((state) => state.history);
  const tickPlayback = useTacticalBoardStore((state) => state.tickPlayback);
  const exportPlaybook = useTacticalBoardStore((state) => state.exportPlaybook);
  const undo = useTacticalBoardStore((state) => state.undo);
  const redo = useTacticalBoardStore((state) => state.redo);
  const resetBoard = useTacticalBoardStore((state) => state.resetBoard);
  const setBoardSettings = useTacticalBoardStore(
    (state) => state.setBoardSettings,
  );

  const [showLeftControls, setShowLeftControls] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showPlaybackPanel, setShowPlaybackPanel] = useState(false);
  const [showPlayerEditor, setShowPlayerEditor] = useState(false);
  const [isPlaybackDragged, setIsPlaybackDragged] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [benchDrag, setBenchDrag] = useState<BenchDragPreview | null>(null);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [gifExportProgress, setGifExportProgress] = useState(0);
  const [gifExportError, setGifExportError] = useState<string | null>(null);

  const dragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const playbackPositionRef = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (!playback.isPlaying) {
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;
      tickPlayback(deltaMs);
      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [playback.isPlaying, tickPlayback]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");

    const applyOrientation = (matches: boolean) => {
      setBoardSettings({
        orientation: matches ? "portrait-rotated" : "landscape",
      });
    };

    applyOrientation(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      applyOrientation(event.matches);
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [setBoardSettings]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");

    const applyMobile = (matches: boolean) => {
      setIsMobile(matches);

      if (matches) {
        setShowLeftControls(false);
        setShowBottomPanel(false);
        setIsPlaybackDragged(false);

        if (playbackPanelRef.current) {
          playbackPanelRef.current.style.transform = "";
        }
      } else {
        setShowBottomPanel(true);
      }
    };

    applyMobile(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      applyMobile(event.matches);
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const handleSaveTactic = () => {
    const payload = exportPlaybook();
    const formattedJson = JSON.stringify(payload, null, 2);
    const blob = new Blob([formattedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tatica-${timestamp}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const buildStoppedPlayback = (base: PlaybackState): PlaybackState => ({
    ...base,
    isPlaying: false,
    fromFrameId: null,
    toFrameId: null,
    progress: 0,
  });

  const handleExportGif = async () => {
    if (isExportingGif) {
      return;
    }

    if (!svgRef.current) {
      setGifExportError("Nao foi possivel encontrar o campo para gravar.");
      return;
    }

    const storeSnapshot = useTacticalBoardStore.getState();
    const frames = storeSnapshot.frames;
    const previousActiveFrameId = storeSnapshot.activeFrameId;
    const previousPlayback = storeSnapshot.playback;

    if (frames.length === 0) {
      setGifExportError("Crie pelo menos um quadro antes de gravar.");
      return;
    }

    const safeSpeed = clamp(previousPlayback.speed, 0.25, 3);
    const stoppedPlayback = buildStoppedPlayback(previousPlayback);
    const lastFrame = frames[frames.length - 1];
    const baseSampleMs = 90;
    const maxGifFrames = 140;
    const effectiveDurations = frames.slice(0, -1).map((frame) =>
      Math.max(80, Math.round(frame.durationMs / safeSpeed)),
    );
    const estimatedFrameCount =
      frames.length <= 1
        ? 1
        : 2 +
          effectiveDurations.reduce(
            (total, durationMs) =>
              total + Math.max(1, Math.ceil(durationMs / baseSampleMs)),
            0,
          );
    const sampleMs =
      estimatedFrameCount <= maxGifFrames
        ? baseSampleMs
        : Math.max(
            baseSampleMs,
            Math.ceil(
              effectiveDurations.reduce(
                (total, durationMs) => total + durationMs,
                0,
              ) / Math.max(1, maxGifFrames - 2),
            ),
          );

    const captureSteps: Array<{
      activeFrameId: Id;
      playback: PlaybackState;
      delayMs: number;
    }> =
      frames.length === 1
        ? [
            {
              activeFrameId: frames[0].id,
              playback: stoppedPlayback,
              delayMs: 1400,
            },
          ]
        : [
            {
              activeFrameId: frames[0].id,
              playback: stoppedPlayback,
              delayMs: 140,
            },
            ...frames.slice(0, -1).flatMap((frame, index) => {
              const nextFrame = frames[index + 1];
              const durationMs = effectiveDurations[index];
              const stepCount = Math.max(1, Math.ceil(durationMs / sampleMs));
              const stepDelay = Math.max(50, Math.round(durationMs / stepCount));

              return Array.from({ length: stepCount }, (_, stepIndex) => ({
                activeFrameId: frame.id,
                playback: {
                  ...previousPlayback,
                  isPlaying: true,
                  fromFrameId: frame.id,
                  toFrameId: nextFrame.id,
                  progress: (stepIndex + 1) / stepCount,
                  loop: false,
                },
                delayMs: stepDelay,
              }));
            }),
            {
              activeFrameId: lastFrame.id,
              playback: stoppedPlayback,
              delayMs: 900,
            },
          ];

    try {
      setBenchDrag(null);
      setGifExportError(null);
      setGifExportProgress(0);
      setIsExportingGif(true);

      useTacticalBoardStore.setState({
        activeFrameId: frames[0].id,
        playback: stoppedPlayback,
      });

      if ("fonts" in document) {
        await document.fonts.ready;
      }

      await waitForPaint();

      const exportSize = getSvgExportSize(svgRef.current);
      const workingCanvas = document.createElement("canvas");
      const encoder = createGifEncoder();
      const repeatCount = previousPlayback.loop ? 0 : -1;

      for (let index = 0; index < captureSteps.length; index += 1) {
        const step = captureSteps[index];

        useTacticalBoardStore.setState({
          activeFrameId: step.activeFrameId,
          playback: step.playback,
        });

        await waitForPaint();

        const imageData = await renderSvgToImageData(
          svgRef.current,
          exportSize,
          workingCanvas,
        );

        appendGifFrame(
          encoder,
          {
            rgba: imageData.data,
            width: exportSize.width,
            height: exportSize.height,
            delayMs: step.delayMs,
          },
          index === 0 ? repeatCount : undefined,
        );

        setGifExportProgress((index + 1) / captureSteps.length);
      }

      encoder.finish();

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadGif(encoder.bytes(), `animacao-${timestamp}.gif`);
    } catch (error) {
      setGifExportError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel exportar o GIF.",
      );
    } finally {
      useTacticalBoardStore.setState({
        activeFrameId: previousActiveFrameId,
        playback: previousPlayback,
      });

      await waitForPaint();

      setIsExportingGif(false);
      setGifExportProgress(0);
    }
  };

  const isCinematic = playback.isPlaying;
  const showLeftPanelUI = showLeftControls && !isCinematic;
  const showBottomPanelUI = showBottomPanel && !isCinematic;
  const showPlaybackPanelUI = showPlaybackPanel;

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

  const handlePlaybackDragStart = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (isMobile) {
      return;
    }

    const panel = playbackPanelRef.current;
    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();

    playbackPositionRef.current = {
      x: rect.left,
      y: rect.top,
    };

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    setIsPlaybackDragged(true);

    requestAnimationFrame(() => {
      if (playbackPanelRef.current) {
        playbackPanelRef.current.style.transform = `translate(${playbackPositionRef.current.x}px, ${playbackPositionRef.current.y}px)`;
      }
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePlaybackDragMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const drag = dragStateRef.current;
    const panel = playbackPanelRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !panel) {
      return;
    }

    const maxX = window.innerWidth - panel.offsetWidth - 12;
    const maxY = window.innerHeight - panel.offsetHeight - 12;

    playbackPositionRef.current = {
      x: clamp(event.clientX - drag.offsetX, 12, Math.max(12, maxX)),
      y: clamp(event.clientY - drag.offsetY, 12, Math.max(12, maxY)),
    };

    panel.style.transform = `translate(${playbackPositionRef.current.x}px, ${playbackPositionRef.current.y}px)`;
  };

  const handlePlaybackDragEnd = () => {
    dragStateRef.current = null;
  };

  useEffect(() => {
    if (!showPlaybackPanelUI || !isPlaybackDragged || !playbackPanelRef.current) {
      return;
    }

    playbackPanelRef.current.style.transform = `translate(${playbackPositionRef.current.x}px, ${playbackPositionRef.current.y}px)`;
  }, [isPlaybackDragged, showPlaybackPanelUI]);

  const railButtonClass = (active: boolean, disabled = false) =>
    `group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] border shadow-sm backdrop-blur-md transition-all duration-200 sm:h-10 sm:w-10 sm:rounded-[18px] ${
      disabled
        ? "cursor-not-allowed border-white/18 bg-white/14 text-white/35 shadow-none"
        : active
        ? "border-white/46 bg-white/26 text-white shadow-[0_16px_34px_-26px_rgba(15,23,42,0.62)]"
        : "border-white/18 bg-slate-950/16 text-white/72 hover:border-white/30 hover:bg-white/18 hover:text-white"
    }`;

  return (
    <main className="relative h-screen min-h-[100dvh] w-full overflow-hidden [height:100lvh]">
      <div className="absolute inset-0">
        <BoardCanvas
          svgRef={svgRef}
          benchDrag={benchDrag}
          isExporting={isExportingGif}
        />
      </div>

      <div
        className={`absolute z-30 opacity-60 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100 ${
          isMobile
            ? "left-2 top-2"
            : "left-3 top-3"
        }`}
        style={
          isMobile ? { top: "calc(env(safe-area-inset-top) + 0.5rem)" } : undefined
        }
      >
        <div
          className={`rounded-[18px] border border-white/12 bg-slate-950/10 p-1 shadow-[0_12px_38px_-28px_rgba(15,23,42,0.7)] backdrop-blur-md ${
            isMobile ? "grid grid-cols-3 gap-1" : "flex flex-col gap-1.5"
          }`}
        >
          <button
            type="button"
            className={railButtonClass(showLeftControls)}
            onClick={() => setShowLeftControls((current) => !current)}
            aria-label="Alternar painel"
            title="Painel"
          >
            <LayoutPanelLeft size={15} />
          </button>

          <button
            type="button"
            className={railButtonClass(showBottomPanel)}
            onClick={() => setShowBottomPanel((current) => !current)}
            aria-label="Alternar jogadores"
            title="Jogadores"
          >
            <UsersRound size={15} />
          </button>

          <button
            type="button"
            className={railButtonClass(showPlaybackPanel)}
            onClick={() => setShowPlaybackPanel((current) => !current)}
            aria-label="Alternar animacao"
            title="Animacao"
          >
            {showPlaybackPanel ? <Pause size={15} /> : <Play size={15} />}
          </button>

          <button
            type="button"
            className={railButtonClass(false, history.past.length === 0)}
            onClick={undo}
            aria-label="Desfazer"
            title="Desfazer"
            disabled={history.past.length === 0}
          >
            <Undo2 size={15} />
          </button>

          <button
            type="button"
            className={railButtonClass(false, history.future.length === 0)}
            onClick={redo}
            aria-label="Refazer"
            title="Refazer"
            disabled={history.future.length === 0}
          >
            <Redo2 size={15} />
          </button>

          <button
            type="button"
            className={railButtonClass(false)}
            onClick={resetBoard}
            aria-label="Resetar quadro"
            title="Resetar quadro"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {showLeftPanelUI && (
        <div className="panel-float-in absolute inset-x-2 top-[4.35rem] z-30 pointer-events-auto transition-all duration-300 sm:inset-x-auto sm:left-[4.7rem] sm:top-3">
          <SimpleControls
            onClose={() => setShowLeftControls(false)}
            onSaveTactic={handleSaveTactic}
            onOpenPlayers={() => setShowBottomPanel(true)}
            onOpenPlayerEditor={() => {
              setShowBottomPanel(true);
              setShowPlayerEditor(true);
            }}
          />
        </div>
      )}

      {showBottomPanelUI && (
        <div
          className={`panel-float-in fixed inset-x-0 bottom-0 z-30 transition-all duration-300 ${
            benchDrag
              ? "pointer-events-none translate-y-[110%] opacity-0"
              : "pointer-events-auto translate-y-0 opacity-100"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <BottomPlayerPanel
            onClose={() => setShowBottomPanel(false)}
            onOpenEditor={() => setShowPlayerEditor(true)}
            onBenchDragChange={setBenchDrag}
          />
        </div>
      )}

      {benchDrag ? (
        <div className="pointer-events-none absolute inset-0 z-40">
          <div
            className={`absolute max-w-[min(78vw,320px)] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border px-3 py-2 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.42)] backdrop-blur-xl ${
              benchDrag.targetPlayerName
                ? "border-emerald-200/90 bg-white/96"
                : "border-white/80 bg-white/94"
            }`}
            style={{
              left: benchDrag.clientX,
              top: benchDrag.clientY,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm ${
                  benchDrag.targetPlayerName
                    ? "bg-emerald-500"
                    : benchDrag.team === "home"
                      ? "bg-sky-500"
                      : "bg-amber-500"
                }`}
              >
                {benchDrag.playerNumber}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {benchDrag.playerName}
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {benchDrag.targetPlayerName
                    ? `Solte para trocar com ${benchDrag.targetPlayerName}`
                    : benchDrag.fieldDropPoint
                      ? "Solte para colocar em campo"
                      : "Arraste ate um titular ou area livre"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isExportingGif ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/24 px-4 backdrop-blur-[2px]">
          <div
            className="w-[min(92vw,360px)] rounded-[24px] border border-white/80 bg-white/96 p-4 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-950">
                  Gravando GIF
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Preparando os quadros
                </p>
              </div>
              <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                {Math.round(gifExportProgress * 100)}%
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a,#475569)] transition-[width] duration-200"
                style={{
                  width: `${Math.max(4, Math.round(gifExportProgress * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {showPlayerEditor && !isCinematic && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-30 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.12),rgba(15,23,42,0.18))] backdrop-blur-[3px] sm:bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.1),rgba(15,23,42,0.16))]"
            onClick={() => setShowPlayerEditor(false)}
            aria-label="Fechar editor"
          />

          <div className="panel-float-in absolute inset-x-2 bottom-2 z-40 flex max-h-[calc(100svh-6rem)] items-end justify-center sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:block sm:max-h-none">
            <PlayerEditorPanel onClose={() => setShowPlayerEditor(false)} />
          </div>
        </>
      )}

      {showPlaybackPanelUI && (
        <div
          ref={playbackPanelRef}
          className={`absolute z-30 pointer-events-auto ${
            isPlaybackDragged && !isMobile
              ? "left-0 top-0 w-[min(92vw,420px)]"
              : isMobile
                ? "bottom-2 inset-x-2"
                : "bottom-4 right-4 w-[360px]"
          }`}
        >
          <div className="relative rounded-[26px] border border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,245,249,0.9))] p-2 shadow-[0_34px_84px_-40px_rgba(15,23,42,0.48)] ring-1 ring-slate-200/60 backdrop-blur-2xl">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <div
                className="inline-flex h-9 items-center gap-1.5 rounded-[16px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 text-[11px] font-semibold text-slate-600 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)] cursor-grab active:cursor-grabbing"
                onPointerDown={handlePlaybackDragStart}
                onPointerMove={handlePlaybackDragMove}
                onPointerUp={handlePlaybackDragEnd}
                onPointerCancel={handlePlaybackDragEnd}
                title="Mover animacao"
              >
                <GripHorizontal size={12} />
              </div>

              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[16px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] text-slate-600 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                onClick={() => setShowPlaybackPanel(false)}
                aria-label="Fechar animacao"
              >
                <X size={13} />
              </button>
            </div>

            <TimelineBar
              onExportGif={handleExportGif}
              isExportingGif={isExportingGif}
              gifExportProgress={gifExportProgress}
              gifExportError={gifExportError}
            />
          </div>
        </div>
      )}
    </main>
  );
}
