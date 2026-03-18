"use client";

import {
  GripHorizontal,
  LayoutPanelLeft,
  Pause,
  Play,
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
  const tickPlayback = useTacticalBoardStore((state) => state.tickPlayback);
  const exportPlaybook = useTacticalBoardStore((state) => state.exportPlaybook);
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
    if (isExportingGif || !svgRef.current) {
      return;
    }

    const storeSnapshot = useTacticalBoardStore.getState();
    const frames = storeSnapshot.frames;
    const previousActiveFrameId = storeSnapshot.activeFrameId;
    const previousPlayback = storeSnapshot.playback;

    if (frames.length === 0) {
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

  const railButtonClass = (active: boolean) =>
    `group pointer-events-auto relative inline-flex h-9 w-9 items-center justify-center rounded-[16px] border shadow-sm transition-all duration-200 sm:h-11 sm:w-11 sm:rounded-2xl ${
      active
        ? "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_16px_38px_-26px_rgba(14,116,144,0.5)]"
        : "border-white/75 bg-white/92 text-slate-700 hover:border-slate-200 hover:bg-white"
    }`;

  return (
    <main className="relative h-[100svh] w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[12%] top-3 h-20 rounded-[28px] border border-white/35 bg-white/20 blur-2xl sm:inset-x-[8%] sm:top-4 sm:h-24 sm:rounded-[32px]" />
        <div className="absolute left-4 top-8 h-44 w-44 rounded-full bg-slate-900/8 blur-3xl sm:left-6 sm:top-10 sm:h-64 sm:w-64" />
        <div className="absolute right-4 top-10 hidden h-44 w-44 rounded-full bg-sky-300/12 blur-3xl sm:block sm:right-8 sm:top-14 sm:h-56 sm:w-56" />
        <div className="absolute bottom-0 left-1/2 h-44 w-[26rem] -translate-x-1/2 rounded-full bg-white/30 blur-3xl sm:h-56 sm:w-[48rem]" />
        <div className="absolute inset-3 rounded-[28px] border border-white/20 sm:inset-6 sm:rounded-[40px] sm:border-white/25" />
      </div>

      <div className="h-full w-full p-1 sm:p-2 lg:p-2.5">
        <div className="relative h-full w-full overflow-hidden rounded-[26px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.44),rgba(255,255,255,0.2))] p-1 shadow-[0_36px_100px_-52px_rgba(15,23,42,0.46)] ring-1 ring-slate-200/55 backdrop-blur-xl sm:rounded-[32px] sm:p-2">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_30%,rgba(15,23,42,0.05)_100%)]" />
          <div className="absolute inset-2 rounded-[22px] border border-white/30 sm:inset-3 sm:rounded-[26px]" />
          <div className="relative h-full w-full overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] sm:rounded-[24px]">
            <BoardCanvas svgRef={svgRef} benchDrag={benchDrag} />
          </div>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute z-30 flex gap-2 rounded-[22px] border border-white/70 bg-white/82 p-1.5 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.38)] backdrop-blur-2xl transition-all duration-300 ${
          isMobile
            ? "left-1/2 top-2 -translate-x-1/2 flex-row"
            : "left-3 top-3 flex-col sm:left-4 sm:top-4"
        }`}
        style={
          isMobile
            ? { top: "calc(env(safe-area-inset-top) + 0.5rem)" }
            : undefined
        }
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
      </div>

      {showLeftPanelUI && (
        <div className="panel-float-in absolute inset-x-2 top-[4.2rem] z-30 pointer-events-auto transition-all duration-300 sm:inset-x-auto sm:left-[5.2rem] sm:top-4">
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
          className={`panel-float-in absolute inset-x-2 z-30 pointer-events-auto transition-all duration-300 sm:left-1/2 sm:inset-x-auto sm:-translate-x-1/2 ${
            showPlaybackPanelUI && isMobile
              ? "bottom-[8.2rem]"
              : "bottom-2 sm:bottom-4"
          }`}
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
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/80 bg-white/94 px-3 py-2 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.42)] backdrop-blur-xl"
            style={{
              left: benchDrag.clientX,
              top: benchDrag.clientY,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm ${
                  benchDrag.team === "home" ? "bg-sky-500" : "bg-amber-500"
                }`}
              >
                {benchDrag.playerNumber}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {benchDrag.playerName}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Solte sobre um jogador
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showPlayerEditor && !isCinematic && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-30 bg-slate-950/12 backdrop-blur-[2px] sm:bg-slate-950/10"
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
          <div className="relative rounded-[24px] border border-white/75 bg-white/88 p-2 shadow-[0_28px_64px_-34px_rgba(15,23,42,0.42)] backdrop-blur-2xl">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <div
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm cursor-grab active:cursor-grabbing"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
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
