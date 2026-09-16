import type { ToolcraftSceneRect } from "@/toolcraft/runtime";
import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { GlobeCanvas } from "./globe/globe-canvas";
import { globeExportRenderer } from "./globe/globe-export";

// Finite mode fills the authored output frame; Infinity mode crops to the globe's square frame.
function globeSceneBounds({
  state,
}: Readonly<{
  state: { canvas: { mode?: string; size: { height: number; width: number } } };
}>): readonly ToolcraftSceneRect[] {
  const { width, height } = state.canvas.size;
  const side = Math.min(width, height);
  return state.canvas.mode === "infinite"
    ? [{ height: side, width: side, x: -side / 2, y: -side / 2 }]
    : [{ height, width, x: -width / 2, y: -height / 2 }];
}

export const appComposition = composeToolcraftApp(appSchema, {
  scene: {
    canvasContent: <GlobeCanvas />,
    rasterFrameRenderer: globeExportRenderer,
    sceneBoundsProvider: globeSceneBounds,
  },
});
