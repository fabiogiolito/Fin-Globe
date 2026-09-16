"use client";

import Lenis from "lenis";
import * as React from "react";

import { evaluateToolcraftTimelineValues } from "@/toolcraft/runtime";

import appDefaults from "../app/app-defaults.json" with { type: "json" };
import { createGlobeRenderer } from "../app/globe/globe-renderer";
import { readGlobeState } from "../app/globe/globe-state";
import "./demo.css";

// Scroll-driven demo: the default timeline (minus spin) is scrubbed over the first viewport,
// transactions play in real time once the second viewport is reached, and the sticky canvas
// scrolls out during the third.
const defaultState = appDefaults.state as unknown as Parameters<typeof evaluateToolcraftTimelineValues>[0];
const SETTLE_SECONDS = 17.49; // last keyframe of the default timeline
const SPIN_DEGREES_PER_SECOND = 360 / 60;
const TX_LOOP_SECONDS = 30;

export function GlobeDemo(): React.JSX.Element {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const scroller = scrollRef.current;
    const canvas = canvasRef.current;
    if (!scroller || !canvas) return;
    const renderer = createGlobeRenderer(canvas);
    const lenis = new Lenis({ content: scroller.firstElementChild as HTMLElement, wrapper: scroller });
    const start = performance.now();
    let txStart: number | null = null;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      lenis.raf(now);
      const progress = scroller.scrollTop / scroller.clientHeight;
      const elapsed = (now - start) / 1000;
      const values = evaluateToolcraftTimelineValues(
        defaultState,
        Math.min(1, Math.max(0, progress)) * SETTLE_SECONDS,
      );
      if (progress >= 1) txStart ??= now;
      else txStart = null;
      const state = {
        ...readGlobeState(values),
        spin: 140 + elapsed * SPIN_DEGREES_PER_SECOND,
        txShow: txStart === null ? 0 : 1,
      };
      const dpr = window.devicePixelRatio || 1;
      renderer.render(
        state,
        [Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr)],
        { showSchedule: [], timeSeconds: txStart === null ? 0 : ((now - txStart) / 1000) % TX_LOOP_SECONDS },
      );
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={scrollRef} className="h-dvh overflow-y-auto bg-black">
      <div>
        <div className="relative h-[300dvh]">
          <h1
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[50dvh] items-end justify-center px-4 text-center text-6xl font-medium leading-[0.85] tracking-tight text-[#d1c8b6] md:text-8xl"
            style={{ fontFamily: "PPCirka, serif" }}
          >
            Global money
            <br />
            movement
          </h1>
          <canvas ref={canvasRef} className="sticky top-0 block h-dvh w-full" aria-label="Gold globe" role="img" />
          {/* Natural position 170dvh into the wrapper, so it reaches its 70dvh resting spot exactly at the second viewport. */}
          <p
            className="pointer-events-none sticky top-[80dvh] z-10 mx-auto mt-[80dvh] max-w-2xl px-4 text-center text-2xl leading-tight tracking-tight text-[#d1c8b6] md:text-3xl"
            style={{ fontFamily: "PPCirka, serif" }}
          >
            Fin is the new financial infrastructure. One network. Transparent pricing. Settlement in minutes.
          </p>
        </div>
        <div className="h-dvh" />
      </div>
    </div>
  );
}
