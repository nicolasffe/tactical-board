"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import html2canvas from "html2canvas";

type RecorderFormat = "webm" | "gif";

interface StartRecordingOptions {
  fileName?: string;
  fps?: number;
  format?: RecorderFormat;
  autoDownload?: boolean;
}

interface UseBoardRecorderParams {
  svgRef: React.RefObject<SVGSVGElement | null>;
  captureElementRef?: React.RefObject<HTMLElement | null>;
}

interface UseBoardRecorderResult {
  isSupported: boolean;
  startRecording: (options?: StartRecordingOptions) => Promise<boolean>;
  stopRecording: () => Promise<void>;
  captureFrame: () => void;
  hasLastRecording: boolean;
  saveLastRecording: (fileName?: string) => boolean;
}

const XMLNS = "http://www.w3.org/2000/svg";

const ensureSvgNamespaces = (svg: SVGSVGElement): SVGSVGElement => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", XMLNS);
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  return clone;
};

const getBestMimeType = (): string => {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  for (const candidate of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(candidate)
    ) {
      return candidate;
    }
  }

  return "video/webm";
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export function useBoardRecorder({
  svgRef,
  captureElementRef,
}: UseBoardRecorderParams): UseBoardRecorderResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileNameRef = useRef("tactical-board-recording.gif");
  const autoDownloadRef = useRef(true);
  const formatRef = useRef<RecorderFormat>("gif");
  const isActiveRef = useRef(false);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const captureChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastBlobRef = useRef<Blob | null>(null);
  const [hasLastRecording, setHasLastRecording] = useState(false);

  const gifFramesRef = useRef<Uint8ClampedArray[]>([]);
  const gifFrameDelayMsRef = useRef(83);
  const gifCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gifCaptureContextRef = useRef<CanvasRenderingContext2D | null>(null);

  const isSupported = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      typeof HTMLCanvasElement !== "undefined" &&
      typeof requestAnimationFrame !== "undefined"
    );
  }, []);

  const getTargetElement = useCallback((): HTMLElement | null => {
    if (captureElementRef?.current) {
      return captureElementRef.current;
    }

    return svgRef.current?.parentElement ?? null;
  }, [captureElementRef, svgRef]);

  const enqueueCapture = useCallback((job: () => Promise<void>) => {
    captureChainRef.current = captureChainRef.current.then(job).catch(() => {
      return;
    });
  }, []);

  const captureGifFrameFromDom = useCallback(async () => {
    const target = getTargetElement();
    const captureCanvas = gifCaptureCanvasRef.current;
    const captureContext = gifCaptureContextRef.current;
    if (!target || !captureCanvas || !captureContext) {
      return;
    }

    const domCanvas = await html2canvas(target, {
      backgroundColor: null,
      scale: 1,
      logging: false,
      useCORS: true,
    });

    captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
    captureContext.drawImage(
      domCanvas,
      0,
      0,
      domCanvas.width,
      domCanvas.height,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height,
    );

    const { data } = captureContext.getImageData(
      0,
      0,
      captureCanvas.width,
      captureCanvas.height,
    );

    gifFramesRef.current.push(new Uint8ClampedArray(data));
  }, [getTargetElement]);

  const captureSvgToCanvas = useCallback(async () => {
    const svgElement = svgRef.current;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!svgElement || !canvas || !context) {
      return;
    }

    const bounds = svgElement.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));

    const clone = ensureSvgNamespaces(svgElement);
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          resolve();
        };
        image.onerror = () => reject(new Error("Unable to capture SVG frame."));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [svgRef]);

  const captureFrame = useCallback(() => {
    if (!isActiveRef.current) {
      return;
    }

    if (formatRef.current === "gif") {
      enqueueCapture(captureGifFrameFromDom);
      return;
    }

    enqueueCapture(captureSvgToCanvas);
  }, [captureGifFrameFromDom, captureSvgToCanvas, enqueueCapture]);

  const startRecording = useCallback(
    async (options?: StartRecordingOptions): Promise<boolean> => {
      if (!isSupported || isActiveRef.current) {
        return false;
      }

      const target = getTargetElement();
      if (!target) {
        return false;
      }

      const format = options?.format ?? "gif";
      const fps = Math.max(6, Math.min(60, options?.fps ?? 12));
      const fileName =
        options?.fileName ??
        `tactical-board-recording.${format === "gif" ? "gif" : "webm"}`;

      const bounds = target.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      formatRef.current = format;
      fileNameRef.current = fileName;
      autoDownloadRef.current = options?.autoDownload ?? true;
      stopPromiseRef.current = null;
      captureChainRef.current = Promise.resolve();
      chunksRef.current = [];
      gifFramesRef.current = [];
      gifFrameDelayMsRef.current = Math.round(1000 / fps);
      lastBlobRef.current = null;
      setHasLastRecording(false);

      if (format === "gif") {
        const maxDimension = 960;
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const gifWidth = Math.max(1, Math.round(width * scale));
        const gifHeight = Math.max(1, Math.round(height * scale));
        const gifCanvas = document.createElement("canvas");
        gifCanvas.width = gifWidth;
        gifCanvas.height = gifHeight;
        const gifContext = gifCanvas.getContext("2d", { alpha: false });
        if (!gifContext) {
          return false;
        }

        gifCaptureCanvasRef.current = gifCanvas;
        gifCaptureContextRef.current = gifContext;
        isActiveRef.current = true;
        captureFrame();
        return true;
      }

      if (typeof MediaRecorder === "undefined") {
        return false;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const context = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });

      if (!context) {
        return false;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const stream = canvas.captureStream(fps);
      const mimeType = getBestMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 6_000_000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const outputBlob = new Blob(chunksRef.current, { type: mimeType });
        lastBlobRef.current = outputBlob.size > 0 ? outputBlob : null;
        setHasLastRecording(outputBlob.size > 0);
        if (autoDownloadRef.current && outputBlob.size > 0) {
          triggerDownload(outputBlob, fileNameRef.current);
        }
      };

      canvasRef.current = canvas;
      contextRef.current = context;
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      isActiveRef.current = true;

      captureFrame();
      recorder.start(250);
      return true;
    },
    [captureFrame, getTargetElement, isSupported],
  );

  const stopRecording = useCallback(async () => {
    if (!isActiveRef.current) {
      return;
    }

    if (stopPromiseRef.current) {
      await stopPromiseRef.current;
      return;
    }

    const recorder = mediaRecorderRef.current;
    const stream = mediaStreamRef.current;

    stopPromiseRef.current = (async () => {
      await captureChainRef.current;

      if (formatRef.current === "gif") {
        const gifCanvas = gifCaptureCanvasRef.current;
        const width = gifCanvas?.width ?? 0;
        const height = gifCanvas?.height ?? 0;
        const frames = gifFramesRef.current;

        if (width > 0 && height > 0 && frames.length > 0) {
          const gif = GIFEncoder();
          const delay = Math.max(20, gifFrameDelayMsRef.current);

          for (const frame of frames) {
            const palette = quantize(frame, 256);
            const index = applyPalette(frame, palette);
            gif.writeFrame(index, width, height, {
              palette,
              delay,
              repeat: 0,
            });
          }

          gif.finish();
          const bytes = gif.bytes();
          const outputBlob = new Blob([bytes], { type: "image/gif" });
          lastBlobRef.current = outputBlob.size > 0 ? outputBlob : null;
          setHasLastRecording(outputBlob.size > 0);
          if (autoDownloadRef.current && outputBlob.size > 0) {
            triggerDownload(outputBlob, fileNameRef.current);
          }
        } else {
          lastBlobRef.current = null;
          setHasLastRecording(false);
        }
      } else if (recorder) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          recorder.addEventListener("stop", done, { once: true });
          if (recorder.state === "recording") {
            recorder.requestData();
            recorder.stop();
            return;
          }
          resolve();
        });
      }

      stream?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      canvasRef.current = null;
      contextRef.current = null;
      gifCaptureCanvasRef.current = null;
      gifCaptureContextRef.current = null;
      chunksRef.current = [];
      gifFramesRef.current = [];
      isActiveRef.current = false;
    })();

    await stopPromiseRef.current;
  }, []);

  const saveLastRecording = useCallback((fileName?: string): boolean => {
    if (!lastBlobRef.current) {
      return false;
    }

    triggerDownload(lastBlobRef.current, fileName ?? fileNameRef.current);
    return true;
  }, []);

  return {
    isSupported,
    startRecording,
    stopRecording,
    captureFrame,
    hasLastRecording,
    saveLastRecording,
  };
}
