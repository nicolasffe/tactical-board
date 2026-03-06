"use client";

import { useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";

import { BoardCanvas } from "@/src/components/board";
import { PlayerEditorPanel, SimpleControls } from "@/src/components/controls";
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

export default function TacticalBoard() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);

  const selection = useTacticalBoardStore((state) => state.selection);
  const theme = useTacticalBoardStore((state) => state.settings.theme);
  const playback = useTacticalBoardStore((state) => state.playback);
  const tickPlayback = useTacticalBoardStore((state) => state.tickPlayback);
  const play = useTacticalBoardStore((state) => state.play);
  const pause = useTacticalBoardStore((state) => state.pause);
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

    let animationFrame = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      tickPlayback(delta);
      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [playback.isPlaying, tickPlayback]);

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

            <div className="relative h-full w-full">
              <BoardCanvas svgRef={svgRef} />
            </div>

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

            {showControls && (
              <div className="absolute inset-0 z-30">
                <button
                  type="button"
                  aria-label="Fechar painel"
                  className="absolute inset-0 h-full w-full bg-slate-900/22 backdrop-blur-[2px]"
                  onClick={() => setShowControls(false)}
                />
                <div className="absolute left-4 top-12">
                  <SimpleControls onClose={() => setShowControls(false)} />
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
