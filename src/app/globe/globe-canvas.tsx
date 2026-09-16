"use client";

import * as React from "react";

import {
  useToolcraftEvaluatedValues,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
  useToolcraftValue,
} from "@/toolcraft/runtime/react";

import styles from "./globe-canvas.module.css";
import { createGlobeRenderer, type GlobeRenderer } from "./globe-renderer";
import { readGlobeState, readShowSchedule } from "./globe-state";

export type GlobeCanvasStatus = "loading" | "ready" | "unsupported";

function useDevicePixelRatio(): number {
  const [ratio, setRatio] = React.useState(() =>
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
  );
  React.useEffect(() => {
    let media: MediaQueryList | undefined;
    const listen = () => {
      media?.removeEventListener("change", listen);
      const next = window.devicePixelRatio || 1;
      setRatio(next);
      media = window.matchMedia(`(resolution: ${next}dppx)`);
      media.addEventListener("change", listen);
    };
    listen();
    return () => media?.removeEventListener("change", listen);
  }, []);
  return ratio;
}

export function GlobeCanvas(): React.JSX.Element {
  const frame = useToolcraftProductSceneFrame();
  const values = useToolcraftEvaluatedValues();
  const timeSeconds = useToolcraftSelector((state) => state.timeline.currentTimeSeconds);
  const keyframeGroups = useToolcraftSelector((state) => state.timeline.keyframeGroups);
  const showSchedule = React.useMemo(() => readShowSchedule(keyframeGroups), [keyframeGroups]);
  const renderScaleValue = useToolcraftValue("canvas.renderScale");
  const renderScale =
    typeof renderScaleValue === "number" && Number.isFinite(renderScaleValue)
      ? renderScaleValue
      : 1;
  const devicePixelRatio = useDevicePixelRatio();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<GlobeRenderer | null>(null);
  const [status, setStatus] = React.useState<GlobeCanvasStatus>("loading");

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createGlobeRenderer(canvas);
    rendererRef.current = renderer;
    let active = true;
    renderer.ready.then(
      () => {
        if (active) setStatus("ready");
      },
      () => {
        if (active) setStatus("unsupported");
      },
    );
    return () => {
      active = false;
      rendererRef.current = null;
      renderer.dispose();
    };
  }, []);

  const state = React.useMemo(() => readGlobeState(values), [values]);

  React.useEffect(() => {
    const renderer = rendererRef.current;
    if (status !== "ready" || !renderer || frame.kind !== "ready") return;
    const scale = devicePixelRatio * renderScale;
    const beams = renderer.render(
      state,
      [Math.round(frame.rect.width * scale), Math.round(frame.rect.height * scale)],
      { showSchedule, timeSeconds },
    );
    canvasRef.current?.setAttribute("data-globe-beams", String(beams));
    canvasRef.current?.setAttribute("data-globe-show", JSON.stringify({ timeSeconds, showSchedule }));
  }, [devicePixelRatio, frame, renderScale, showSchedule, state, status, timeSeconds]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      data-toolcraft-product-output=""
      data-globe-status={status}
      data-globe-spin={state.spin.toFixed(2)}
      data-globe-y={state.globeY.toFixed(2)}
      data-globe-z={state.globeZ.toFixed(2)}
      aria-label={
        status === "unsupported"
          ? "WebGL is unavailable in this browser; the globe preview cannot render."
          : "Gold globe"
      }
      role="img"
    />
  );
}
