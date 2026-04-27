"use client";

import { applyPalette, GIFEncoder, quantize } from "gifenc";

export interface GifExportSize {
  width: number;
  height: number;
}

export interface GifEncoderFrameInput {
  rgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  delayMs: number;
}

const MAX_EXPORT_DIMENSION = 1400;
const MAX_GIF_COLORS = 192;

const loadSvgImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => {
      reject(new Error("Nao foi possivel renderizar o quadro para o GIF."));
    };
    image.src = url;
  });

export const waitForPaint = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

export const getSvgExportSize = (
  svg: SVGSVGElement,
  maxDimension = MAX_EXPORT_DIMENSION,
): GifExportSize => {
  const viewBox = svg.viewBox.baseVal;
  const viewBoxWidth = viewBox?.width || svg.clientWidth || 1600;
  const viewBoxHeight = viewBox?.height || svg.clientHeight || 900;
  const aspectRatio = viewBoxWidth / Math.max(viewBoxHeight, 1);

  if (aspectRatio >= 1) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(maxDimension / aspectRatio)),
    };
  }

  return {
    width: Math.max(1, Math.round(maxDimension * aspectRatio)),
    height: maxDimension,
  };
};

export const renderSvgToImageData = async (
  svg: SVGSVGElement,
  size: GifExportSize,
  workingCanvas?: HTMLCanvasElement,
): Promise<ImageData> => {
  const canvas = workingCanvas ?? document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
    alpha: false,
  });

  if (!context) {
    throw new Error("Nao foi possivel preparar o canvas de exportacao.");
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(size.width));
  clone.setAttribute("height", String(size.height));
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const markup = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([markup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadSvgImage(url);
    context.clearRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, size.width, size.height);
    return context.getImageData(0, 0, size.width, size.height);
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const createGifEncoder = () => GIFEncoder();

export const appendGifFrame = (
  encoder: ReturnType<typeof GIFEncoder>,
  frame: GifEncoderFrameInput,
  repeat?: number,
): void => {
  const palette = quantize(frame.rgba, MAX_GIF_COLORS);
  const indexed = applyPalette(frame.rgba, palette);

  encoder.writeFrame(indexed, frame.width, frame.height, {
    palette,
    delay: Math.max(40, Math.round(frame.delayMs)),
    repeat,
  });
};

export const downloadGif = (bytes: Uint8Array, filename: string): void => {
  const safeBytes = Uint8Array.from(bytes);
  const blob = new Blob([safeBytes.buffer], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
