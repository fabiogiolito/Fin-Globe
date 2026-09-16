// Runtime-owned image/video export: renders the exact evaluated state offscreen and paints it
// into the runtime-supplied Canvas 2D context. One detached renderer is kept for repeated frames.
import { evaluateToolcraftTimelineValues } from "@/toolcraft/runtime";
import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime/export/product-export-renderer";

import { createGlobeRenderer, type GlobeRenderer } from "./globe-renderer";
import { readGlobeState, readShowSchedule } from "./globe-state";

let shared: GlobeRenderer | null = null;

function exportRenderer(): GlobeRenderer {
  if (!shared) {
    shared = createGlobeRenderer(document.createElement("canvas"));
    shared.ready.catch(() => {
      shared = null;
    });
  }
  return shared;
}

export const globeExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: "gold-globe",
  async renderFrame({ context, frame, pixelRatio, signal, state, timeSeconds }) {
    const width = Math.max(1, Math.round(frame.width * pixelRatio));
    const height = Math.max(1, Math.round(frame.height * pixelRatio));
    const globeState = readGlobeState(evaluateToolcraftTimelineValues(state, timeSeconds));
    const pixels = await exportRenderer().renderPixels(globeState, [width, height], {
      showSchedule: readShowSchedule(state.timeline.keyframeGroups),
      timeSeconds,
    });
    if (signal.aborted) return;
    const image = new ImageData(new Uint8ClampedArray(pixels), width, height);
    context.putImageData(image, 0, 0);
  },
};
