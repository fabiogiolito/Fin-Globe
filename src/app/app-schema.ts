import {
  defineToolcraft,
  imageExportModule,
  timelineModule,
  videoExportModule,
  type ToolcraftControlSchema,
} from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import { GLOBE_DEFAULTS } from "./globe/globe-renderer";
import { GLOBE_TARGETS } from "./globe/globe-state";

// One slow keyframed revolution reads clearly at 12 s; the reference clip is a 3 s cut of that motion.
export const GLOBE_LOOP_SECONDS = 12;

function slider(
  target: string,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  performanceReason: string,
  unit?: string,
): ToolcraftControlSchema {
  return {
    applicability: { mode: "always" },
    defaultValue,
    label,
    max,
    min,
    performanceReason,
    performanceRole: "responsiveness",
    sliderValueKind: "continuous",
    step,
    target,
    type: "slider",
    ...(unit ? { unit } : {}),
    variant: "continuous",
  };
}

const UNIFORM = "This value is one shader uniform; every setting costs the same frame.";

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    canvas: {
      draggable: true,
      enabled: true,
      sizing: { mode: "editable-output" },
    },
    identity: appIdentity,
    panels: {
      controls: {
        sections: [
          {
            controls: {
              spin: slider(GLOBE_TARGETS.spin, "Spin", GLOBE_DEFAULTS.spin, 0, 720, 1, "This value is one shader uniform; every setting costs the same frame.", "°"),
              relief: slider(GLOBE_TARGETS.relief, "Relief", GLOBE_DEFAULTS.relief, 0, 2, 0.05, "Relief scales the baked height slope in the fragment shader; sampling count is fixed."),
              x: slider(GLOBE_TARGETS.globeX, "Position X", GLOBE_DEFAULTS.globeX, -6, 6, 0.05, "Position is one transform per frame; shading cost is unchanged."),
              y: slider(GLOBE_TARGETS.globeY, "Position Y", GLOBE_DEFAULTS.globeY, -6, 6, 0.05, "Position is one transform per frame; shading cost is unchanged."),
              z: slider(GLOBE_TARGETS.globeZ, "Position Z", GLOBE_DEFAULTS.globeZ, -6, 10, 0.05, "Position is one transform per frame; shading cost is unchanged."),
            },
            id: "globe",
            title: "Globe",
          },
          {
            controls: {
              shine: slider(GLOBE_TARGETS.shine, "Shine", GLOBE_DEFAULTS.shine, 0, 1, 0.01, "Shine scales the gold roughness uniform; shading cost is unchanged."),
              gold: slider(GLOBE_TARGETS.gold, "Gold", GLOBE_DEFAULTS.gold, 0, 2, 0.01, "Gold saturation is one uniform applied in the fragment shader."),
              stoneRoughness: slider(GLOBE_TARGETS.stoneRoughness, "Stone roughness", GLOBE_DEFAULTS.stoneRoughness, 0, 2.5, 0.05, "Stone roughness scales the micro normal uniform; sampling count is fixed."),
              stoneFinish: {
                applicability: { mode: "always" },
                defaultValue: GLOBE_DEFAULTS.stoneFinish,
                label: "Stone finish",
                options: [
                  { label: "Smooth spread", value: "smooth" },
                  { label: "Rough spread", value: "rough" },
                ],
                performanceReason:
                  "Switching the finish re-bakes the stone maps once from the other photograph; frame cost is unchanged.",
                performanceRole: "responsiveness",
                target: GLOBE_TARGETS.stoneFinish,
                type: "select",
              },
            },
            id: "material",
            title: "Material",
          },
          {
            controls: {
              x: slider(GLOBE_TARGETS.cameraX, "Position X", GLOBE_DEFAULTS.cameraX, -10, 10, 0.05, "Position is one transform per frame; shading cost is unchanged."),
              y: slider(GLOBE_TARGETS.cameraY, "Position Y", GLOBE_DEFAULTS.cameraY, -10, 10, 0.05, "Position is one transform per frame; shading cost is unchanged."),
              z: slider(GLOBE_TARGETS.cameraZ, "Position Z", GLOBE_DEFAULTS.cameraZ, -2, 20, 0.05, "Position is one transform per frame; shading cost is unchanged."),
              yaw: slider(GLOBE_TARGETS.cameraYaw, "Yaw", GLOBE_DEFAULTS.cameraYaw, -180, 180, 1, "This value is one shader uniform; every setting costs the same frame.", "°"),
              pitch: slider(GLOBE_TARGETS.cameraPitch, "Pitch", GLOBE_DEFAULTS.cameraPitch, -89, 89, 1, "This value is one shader uniform; every setting costs the same frame.", "°"),
              focusDistance: slider(GLOBE_TARGETS.focusDistance, "Focus distance", GLOBE_DEFAULTS.focusDistance, 0.5, 20, 0.05, "Focus distance is one uniform of the fixed-cost depth-of-field pass."),
              focusBlur: slider(GLOBE_TARGETS.focusBlur, "Focus blur", GLOBE_DEFAULTS.focusBlur, 0, 1, 0.01, "Focus blur scales the gather radius of the fixed-tap depth-of-field pass."),
            },
            id: "camera",
            title: "Camera",
          },
          {
            controls: {
              x: slider(GLOBE_TARGETS.lightX, "Position X", GLOBE_DEFAULTS.lightX, -15, 15, 0.1, "Position is one transform per frame; shading cost is unchanged."),
              y: slider(GLOBE_TARGETS.lightY, "Position Y", GLOBE_DEFAULTS.lightY, -15, 15, 0.1, "Position is one transform per frame; shading cost is unchanged."),
              z: slider(GLOBE_TARGETS.lightZ, "Position Z", GLOBE_DEFAULTS.lightZ, -15, 15, 0.1, "Position is one transform per frame; shading cost is unchanged."),
              intensity: slider(GLOBE_TARGETS.lightIntensity, "Intensity", GLOBE_DEFAULTS.lightIntensity, 0, 3, 0.05, "Light intensity scales a uniform; per-pixel work is unchanged."),
              beamAngle: slider(GLOBE_TARGETS.beamAngle, "Beam width", GLOBE_DEFAULTS.beamAngle, 2, 80, 1, "Beam width sets the spot cone angle; shading cost is unchanged.", "°"),
              beamSoftness: slider(GLOBE_TARGETS.beamSoftness, "Beam softness", GLOBE_DEFAULTS.beamSoftness, 0, 1, 0.01, "Beam softness sets the spot penumbra; shading cost is unchanged."),
              edgeFalloff: slider(GLOBE_TARGETS.edgeFalloff, "Edge falloff", GLOBE_DEFAULTS.edgeFalloff, 0, 3, 0.05, "Edge falloff is one exponent uniform on the lighting result."),
            },
            id: "light",
            title: "Light",
          },
          {
            controls: {
              temperature: slider(GLOBE_TARGETS.temperature, "Temperature", GLOBE_DEFAULTS.temperature, -1, 1, 0.01, "Temperature is a channel gain in the final composite pass."),
              tint: slider(GLOBE_TARGETS.tint, "Tint", GLOBE_DEFAULTS.tint, -1, 1, 0.01, "Tint is a channel gain in the final composite pass."),
            },
            id: "grade",
            title: "Grade",
          },
          {
            controls: {
              show: {
                applicability: { mode: "always" },
                defaultValue: GLOBE_DEFAULTS.txShow,
                description:
                  "Acts as a switch: at 1 transactions start on schedule, at 0 no new ones start and any running finish on their own. Keyframe it with step easing.",
                label: "Show",
                markerCount: 2,
                max: 1,
                min: 0,
                performanceReason: "Show gates which beams start; per-frame cost is unchanged.",
                performanceRole: "responsiveness",
                sliderValueKind: "discrete",
                step: 1,
                target: GLOBE_TARGETS.txShow,
                type: "slider",
                variant: "discrete",
              },
              intensity: slider(GLOBE_TARGETS.txIntensity, "Intensity", GLOBE_DEFAULTS.txIntensity, 0, 3, 0.05, "Intensity is one uniform per active beam."),
              shimmer: slider(GLOBE_TARGETS.txShimmer, "Shimmer", GLOBE_DEFAULTS.txShimmer, 0, 2, 0.05, "Shimmer is one uniform per active beam."),
            },
            id: "transactions",
            title: "Transactions",
          },
          {
            controls: {
              includeBackground: {
                applicability: { mode: "always" },
                defaultValue: true,
                label: "Include",
                performanceReason:
                  "Background inclusion is consumed by runtime compositing, not the globe pass.",
                performanceRole: "responsiveness",
                target: "export.includeBackground",
                type: "switch",
              },
              background: {
                applicability: { mode: "always" },
                defaultValue: "#000000",
                label: false,
                performanceReason:
                  "Background color is painted by the runtime surface below the transparent globe.",
                performanceRole: "responsiveness",
                target: "scene.background",
                type: "color",
              },
            },
            id: "background",
            layoutGroups: [
              {
                columns: 2,
                controls: ["includeBackground", "background"],
                layout: "inline",
              },
            ],
            title: "Background",
          },
        ],
        title: "Gold Globe",
      },
    },
    toolbar: {
      history: true,
      radar: true,
      zoom: true,
    },
  },
  modules: [
    timelineModule({ defaultDurationSeconds: GLOBE_LOOP_SECONDS, mode: "keyframes" }),
    imageExportModule(),
    videoExportModule(),
  ],
});
