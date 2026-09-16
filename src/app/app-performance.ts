import {
  defineToolcraftPerformance,
  deriveToolcraftPerformancePaths,
  type ToolcraftEnvelopePerformanceConfig,
  type ToolcraftPerformanceScenario,
} from "@/toolcraft/runtime";

import { appSchema } from "./app-schema";
import { GLOBE_TARGETS } from "./globe/globe-state";

const GLOBE_CANVAS = 'canvas[data-toolcraft-product-output=""]';

const frameTargets = Object.values(GLOBE_TARGETS);

const threeWebgl = { backend: "webgl", provider: "three" } as const;

const basePerformance = defineToolcraftPerformance({
  rendererPipeline: {
    interactionInvalidation: [
      { interaction: "initial-render", invalidates: ["globe-frame"], targets: ["canvas.size"] },
      { interaction: "control-drag", invalidates: ["globe-frame"], targets: [...frameTargets] },
      {
        interaction: "timeline-playback",
        invalidates: ["globe-frame"],
        targets: ["timeline.currentTimeSeconds"],
      },
      {
        interaction: "timeline-scrub",
        invalidates: ["globe-frame"],
        targets: ["timeline.currentTimeSeconds"],
      },
      {
        interaction: "viewport-drag",
        invalidates: [],
        mustNotInvalidate: ["globe-frame"],
        targets: ["canvas.offset"],
      },
      {
        interaction: "viewport-zoom",
        invalidates: [],
        mustNotInvalidate: ["globe-frame"],
        targets: ["canvas.zoom"],
      },
      { interaction: "export", invalidates: ["globe-frame"], targets: ["actions.output"] },
    ],
    passes: [
      {
        cost: { dimensions: [], frequency: "frame", relationship: "constant" },
        gpu: {
          resources: "uniforms-only",
          stage: "render",
          state: "stateless",
          surfaces: ["preview", "export"],
        },
        id: "globe-frame",
        inputs: [...frameTargets, "timeline.currentTimeSeconds", "canvas.size"],
        invalidatedBy: [...frameTargets, "timeline.currentTimeSeconds", "canvas.size"],
        kind: "composite",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "preview",
        quality: "full",
        runsOn: "gpu",
      },
    ],
    runtimeId: "gold-globe-three",
  },
  rendererStrategy: "webgl",
  rendererTechnique: {
    exportRenderer: "canvas-2d",
    fidelityRisks: ["Export readback must match preview shading at the requested resolution."],
    gpu: { export: threeWebgl, preview: threeWebgl },
    layers: [
      {
        content: ["shader"],
        exportMode: "included",
        id: "globe",
        kind: "product-foreground",
        primitiveCount: "high",
        renderer: "webgl",
        uiSelector: GLOBE_CANVAS,
      },
    ],
    performanceRisks: ["A 1024x512 displaced sphere with a 2048 shadow map, bloom, and grain passes at devicePixelRatio backing every frame."],
    previewExportDifferenceReason:
      "Export renders the Three.js frame at artifact size, reads the WebGL pixels back, and paints them into the runtime-supplied CanvasRenderingContext2D.",
    previewRenderer: "webgl",
    productRepresentation: "pixel",
    rendererStrategy: "webgl",
    sourceRepresentation: "procedural-data",
    whyNotAlternativeStrategies: [
      "Canvas 2D cannot shade a displaced, image-lit metallic sphere per pixel at 2x backing in real time.",
      "Hand-written WebGPU (vgpu) lacked image-based lighting, displacement, shadows, and post-processing, which Three.js provides directly.",
    ],
  },
  scenarios: [],
  usesCustomRenderer: true,
  workloadEnvelope: {
    dimensions: [
      {
        batchMax: 8_192,
        customMappingReason:
          "The image resolution option maps to its exact numeric long edge in pixels.",
        defaultValue: 4_096,
        id: "export-long-edge",
        mapping: "custom",
        source: { kind: "schema-target", target: "export.image.resolution" },
        unit: "pixels",
      },
    ],
  },
} satisfies ToolcraftEnvelopePerformanceConfig);

const scenarios: readonly ToolcraftPerformanceScenario[] = deriveToolcraftPerformancePaths(
  appSchema,
  basePerformance,
).map((path) => {
  const base = {
    automated: true,
    automatedTestName: `performance path ${path.interaction} keeps the globe frame responsive`,
    browser: true,
    browserTestName: `browser perf: toolcraft path ${path.id}`,
    coversTargets: path.targets,
    expectedObservable: "The rendered globe updates within the profile budget.",
    fixture: "default globe frame",
    id: `globe.${path.interaction}`,
    pathId: path.id,
    uiSelector: GLOBE_CANVAS,
  } as const;
  if (path.interaction === "export") {
    return {
      ...base,
      actionValue: "export.png",
      completionEvidence: "download",
      controlLabel: "Export PNG",
      interaction: "export",
    };
  }
  if (path.interaction === "control-drag") {
    return { ...base, controlLabel: "Spin", interaction: path.interaction };
  }
  return { ...base, interaction: path.interaction };
});

export const appPerformance: ToolcraftEnvelopePerformanceConfig =
  defineToolcraftPerformance({ ...basePerformance, scenarios });
