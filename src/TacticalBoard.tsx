"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Trash2, UserRound } from "lucide-react";

import { BoardCanvas } from "@/src/components/board";
import { PlayerEditorPanel, SimpleControls } from "@/src/components/controls";
import { useBoardRecorder } from "./hooks/useBoardRecorder";
import { useTacticalBoardStore } from "@/src/store";

const isTextEditingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.getAttribute("role") === "textbox"
  );
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export default function TacticalBoard() {
  const svgRef = useRef<SVGSVGElement>(null);
  const boardCaptureRef = useRef<HTMLDivElement>(null);
  const recordStopTimeoutRef = useRef<number | null>(null);
  const finalizePromiseRef = useRef<Promise<void> | null>(null);
  const recordingTaskRef = useRef<Promise<void> | null>(null);
  const playbackStartedForRecordingRef = useRef(false);
  const deterministicRecordingRef = useRef(false);
  const recordingAbortRef = useRef(false);
  const [showControls, setShowControls] = useState(false);
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);

  const selection = useTacticalBoardStore((state) => state.selection);
  const theme = useTacticalBoardStore((state) => state.settings.theme);
  const frames = useTacticalBoardStore((state) => state.frames);
  const playback = useTacticalBoardStore((state) => state.playback);
  const isRecording = useTacticalBoardStore((state) => state.isRecording);
  const countdown = useTacticalBoardStore((state) => state.countdown);
  const setActiveFrame = useTacticalBoardStore((state) => state.setActiveFrame);
  const tickPlayback = useTacticalBoardStore((state) => state.tickPlayback);
  const play = useTacticalBoardStore((state) => state.play);
  const pause = useTacticalBoardStore((state) => state.pause);
  const stop = useTacticalBoardStore((state) => state.stop);
  const startRecording = useTacticalBoardStore((state) => state.startRecording);
  const stopRecording = useTacticalBoardStore((state) => state.stopRecording);
  const undo = useTacticalBoardStore((state) => state.undo);
  const redo = useTacticalBoardStore((state) => state.redo);
  const removeEntity = useTacticalBoardStore((state) => state.removeEntity);
  const removeOverlayById = useTacticalBoardStore(
    (state) => state.removeOverlayById,
  );
  const clearSelection = useTacticalBoardStore((state) => state.clearSelection);
  const setBoardSettings = useTacticalBoardStore(
    (state) => state.setBoardSettings,
  );
  const {
    isSupported: isRecorderSupported,
    startRecording: startBoardRecording,
    stopRecording: stopBoardRecording,
    captureFrame,
    hasLastRecording,
    saveLastRecording,
  } = useBoardRecorder({ svgRef, captureElementRef: boardCaptureRef });

  const handleSaveRecording = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    saveLastRecording(`tactical-board-${timestamp}.gif`);
  }, [saveLastRecording]);

  const finalizeRecording = useCallback(async () => {
    if (finalizePromiseRef.current) {
      await finalizePromiseRef.current;
      return;
    }

    finalizePromiseRef.current = (async () => {
      if (recordStopTimeoutRef.current !== null) {
        window.clearTimeout(recordStopTimeoutRef.current);
        recordStopTimeoutRef.current = null;
      }

      playbackStartedForRecordingRef.current = false;
      deterministicRecordingRef.current = false;
      recordingAbortRef.current = false;
      recordingTaskRef.current = null;

      await stopBoardRecording();
      stopRecording();
    })();

    await finalizePromiseRef.current;
    finalizePromiseRef.current = null;
  }, [stopBoardRecording, stopRecording]);

  const waitForNextPaint = useCallback(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
    [],
  );

  const waitForMs = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), ms);
      }),
    [],
  );

  const runDeterministicRecording = useCallback(async () => {
    const fps = 12;
    const frameIntervalMs = Math.max(16, Math.round(1000 / fps));
    const maxSteps = 20_000;
    const clampedSpeed = clamp(playback.speed, 0.25, 3);

    let stepsCounter = 0;
    for (let index = 0; index < frames.length - 1; index += 1) {
      if (recordingAbortRef.current || stepsCounter >= maxSteps) {
        break;
      }

      const fromFrame = frames[index];
      const toFrame = frames[index + 1];
      const transitionDuration = Math.max(
        200,
        fromFrame.durationMs / clampedSpeed,
      );
      const transitionSteps = Math.max(
        1,
        Math.ceil((transitionDuration / 1000) * fps),
      );

      for (let step = 0; step <= transitionSteps; step += 1) {
        if (recordingAbortRef.current || stepsCounter >= maxSteps) {
          break;
        }

        const progress = step / transitionSteps;
        useTacticalBoardStore.setState((state) => ({
          ...state,
          activeFrameId: fromFrame.id,
          playback: {
            ...state.playback,
            isPlaying: true,
            fromFrameId: fromFrame.id,
            toFrameId: toFrame.id,
            progress,
          },
        }));

        await waitForNextPaint();
        captureFrame();
        await waitForMs(frameIntervalMs);
        stepsCounter += 1;
      }
    }

    const lastFrame = frames[frames.length - 1];
    if (lastFrame) {
      useTacticalBoardStore.setState((state) => ({
        ...state,
        activeFrameId: lastFrame.id,
        playback: {
          ...state.playback,
          isPlaying: false,
          fromFrameId: null,
          toFrameId: null,
          progress: 0,
        },
      }));
      await waitForNextPaint();
      captureFrame();
    }
  }, [captureFrame, frames, playback.speed, waitForMs, waitForNextPaint]);

  const beginRecordingPlayback = useCallback(async () => {
    recordingAbortRef.current = false;
    deterministicRecordingRef.current = true;

    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    const startOptions = {
      fileName: `tactical-board-${timestamp}.gif`,
      format: "gif" as const,
      fps: 12,
      autoDownload: false,
    };

    let started = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      started = await startBoardRecording(startOptions);
      if (started) {
        break;
      }

      await stopBoardRecording();
      await waitForMs(120);
    }

    if (!started) {
      await finalizeRecording();
      return;
    }

    playbackStartedForRecordingRef.current = true;
    await waitForNextPaint();
    captureFrame();

    recordingTaskRef.current = (async () => {
      if (frames.length >= 2) {
        await runDeterministicRecording();
      } else {
        while (!recordingAbortRef.current) {
          await waitForNextPaint();
          captureFrame();
          await waitForMs(83);
        }
      }

      if (recordingAbortRef.current) {
        return;
      }

      stop();
      await finalizeRecording();
    })();
  }, [
    captureFrame,
    finalizeRecording,
    frames,
    runDeterministicRecording,
    startBoardRecording,
    stopBoardRecording,
    stop,
    waitForMs,
    waitForNextPaint,
  ]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      recordingAbortRef.current = true;
      pause();
      await finalizeRecording();
      return;
    }

    if (!isRecorderSupported || countdown !== null) {
      return;
    }

    stop();
    startRecording();
    if (frames.length > 0) {
      setActiveFrame(frames[0].id);
    }
    useTacticalBoardStore.setState({ countdown: 3 });
  }, [
    countdown,
    finalizeRecording,
    frames,
    isRecorderSupported,
    isRecording,
    pause,
    startRecording,
    setActiveFrame,
    stop,
  ]);

  useEffect(() => {
    const media = window.matchMedia(
      "(max-width: 1024px) and (orientation: portrait)",
    );

    const applyOrientation = (matches: boolean) => {
      setBoardSettings({
        orientation: matches ? "portrait-rotated" : "landscape",
      });
    };

    applyOrientation(media.matches);
    const listener = (event: MediaQueryListEvent) =>
      applyOrientation(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [setBoardSettings]);

  useEffect(() => {
    document.body.dataset.uiTheme = theme;
    return () => {
      delete document.body.dataset.uiTheme;
    };
  }, [theme]);

  useEffect(() => {
    if (!playback.isPlaying) {
      return undefined;
    }

    if (deterministicRecordingRef.current) {
      return undefined;
    }

    let animationFrame = 0;
    let captureAnimationFrame = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      tickPlayback(delta);

      if (isRecording) {
        captureAnimationFrame = requestAnimationFrame(() => {
          captureFrame();
        });
      }

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(captureAnimationFrame);
    };
  }, [captureFrame, isRecording, playback.isPlaying, tickPlayback]);

  useEffect(() => {
    if (countdown === null) {
      return undefined;
    }

    if (countdown <= 0) {
      useTacticalBoardStore.setState({ countdown: null });
      void beginRecordingPlayback();
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      useTacticalBoardStore.setState({ countdown: countdown - 1 });
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [beginRecordingPlayback, countdown]);

  useEffect(() => {
    if (
      !isRecording ||
      deterministicRecordingRef.current ||
      playback.isPlaying ||
      !playbackStartedForRecordingRef.current
    ) {
      return;
    }

    void finalizeRecording();
  }, [finalizeRecording, isRecording, playback.isPlaying]);

  useEffect(() => {
    return () => {
      if (recordStopTimeoutRef.current !== null) {
        window.clearTimeout(recordStopTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const isMeta = event.metaKey || event.ctrlKey;

      if (isMeta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (key === " " && !isMeta) {
        event.preventDefault();
        if (playback.isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      if (key === "delete" || key === "backspace") {
        if (selection.activeOverlayId) {
          event.preventDefault();
          removeOverlayById(selection.activeOverlayId);
          clearSelection();
          return;
        }

        if (selection.activeEntityId) {
          event.preventDefault();
          removeEntity(selection.activeEntityId);
          clearSelection();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearSelection,
    pause,
    play,
    playback.isPlaying,
    redo,
    removeEntity,
    removeOverlayById,
    selection.activeEntityId,
    selection.activeOverlayId,
    undo,
  ]);

  return (
    <main className="h-screen w-screen overflow-hidden">
      <section className="h-full w-full p-0 sm:p-2">
        <div className="h-full w-full">
          <div className="relative h-full min-h-0 overflow-hidden rounded-none border-0 sm:rounded-3xl sm:border sm:border-white/75 sm:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.7)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-16 top-1/4 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
              <div className="absolute right-0 top-8 h-52 w-52 rounded-full bg-slate-300/30 blur-3xl" />
            </div>

            <div ref={boardCaptureRef} className="relative h-full w-full">
              <BoardCanvas svgRef={svgRef} />
            </div>

            {isRecording && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2">
                <div className="animate-pulse inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_-16px_rgba(225,29,72,0.9)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-white" />
                  Recording...
                </div>
              </div>
            )}

            {countdown !== null && (
              <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-slate-900/32 backdrop-blur-[1px]">
                <div className="rounded-2xl bg-slate-900/80 px-8 py-5 text-6xl font-black text-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.9)]">
                  {countdown}
                </div>
              </div>
            )}

            <button
              type="button"
              className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.55)] backdrop-blur-xl transition hover:bg-white"
              onClick={() => {
                setShowPlayersPanel(false);
                setShowControls((current) => !current);
              }}
            >
              {showControls ? (
                <PanelLeftClose size={16} />
              ) : (
                <PanelLeftOpen size={16} />
              )}
              {showControls ? "Ocultar" : "Controles"}
            </button>

            <button
              type="button"
              className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.55)] backdrop-blur-xl transition hover:bg-white"
              onClick={() => {
                setShowControls(false);
                setShowPlayersPanel((current) => !current);
              }}
            >
              <UserRound size={16} />
              Jogadores
            </button>

            {selection.activeOverlayId && (
              <button
                type="button"
                className="absolute bottom-4 right-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-300/90 bg-rose-500 text-white shadow-[0_18px_40px_-18px_rgba(225,29,72,0.75)] transition hover:bg-rose-600"
                onClick={() => {
                  if (!selection.activeOverlayId) {
                    return;
                  }
                  removeOverlayById(selection.activeOverlayId);
                  clearSelection();
                }}
                aria-label="Excluir mudança selecionada"
                title="Excluir mudança"
              >
                <Trash2 size={18} />
              </button>
            )}

            {showControls && (
              <div className="absolute inset-0 z-30">
                <button
                  type="button"
                  aria-label="Fechar painel"
                  className="absolute inset-0 h-full w-full bg-slate-900/22 backdrop-blur-[2px]"
                  onClick={() => setShowControls(false)}
                />
                <div className="absolute left-4 top-12">
                  <SimpleControls
                    onClose={() => setShowControls(false)}
                    onToggleRecording={handleRecordToggle}
                    onSaveRecording={handleSaveRecording}
                    isRecording={isRecording}
                    isPreparingRecording={countdown !== null}
                    isRecordingSupported={isRecorderSupported}
                    hasSavedRecording={hasLastRecording}
                  />
                </div>
              </div>
            )}

            {showPlayersPanel && (
              <div className="absolute inset-0 z-30">
                <button
                  type="button"
                  aria-label="Fechar painel de jogadores"
                  className="absolute inset-0 h-full w-full bg-slate-900/22 backdrop-blur-[2px]"
                  onClick={() => setShowPlayersPanel(false)}
                />
                <div className="absolute right-4 top-12">
                  <PlayerEditorPanel
                    onClose={() => setShowPlayersPanel(false)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
