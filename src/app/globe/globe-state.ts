// Maps Toolcraft control targets to the renderer state; shared by preview and export.
import { GLOBE_DEFAULTS, GLOBE_STONE_FINISHES, type GlobeState, type GlobeStoneFinish, type ShowKeyframe } from "./globe-renderer";

export const GLOBE_TARGETS = {
  spin: "globe.spin",
  relief: "globe.relief",
  globeX: "globe.x",
  globeY: "globe.y",
  globeZ: "globe.z",
  shine: "globe.shine",
  gold: "material.gold",
  stoneRoughness: "material.stoneRoughness",
  stoneFinish: "material.stoneFinish",
  cameraX: "camera.x",
  cameraY: "camera.y",
  cameraZ: "camera.z",
  cameraYaw: "camera.yaw",
  cameraPitch: "camera.pitch",
  focusDistance: "camera.focusDistance",
  focusBlur: "camera.focusBlur",
  lightX: "light.x",
  lightY: "light.y",
  lightZ: "light.z",
  lightIntensity: "light.intensity",
  beamAngle: "light.beamAngle",
  beamSoftness: "light.beamSoftness",
  edgeFalloff: "light.edgeFalloff",
  temperature: "grade.temperature",
  tint: "grade.tint",
  txShow: "transactions.show",
  txIntensity: "transactions.intensity",
  txShimmer: "transactions.shimmer",
} as const satisfies Record<keyof GlobeState, string>;

export function readGlobeState(values: Readonly<Record<string, unknown>>): GlobeState {
  const state: Record<string, number | GlobeStoneFinish> = { ...GLOBE_DEFAULTS };
  for (const key of Object.keys(GLOBE_TARGETS) as (keyof GlobeState)[]) {
    const value = values[GLOBE_TARGETS[key]];
    if (key === "stoneFinish") {
      if (GLOBE_STONE_FINISHES.includes(value as GlobeStoneFinish)) state[key] = value as GlobeStoneFinish;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      state[key] = value;
    }
  }
  return state as unknown as GlobeState;
}

/** Extracts the Show toggle keyframes (sorted by time) from the runtime timeline groups. */
export function readShowSchedule(
  keyframeGroups: readonly { readonly controlId: string; readonly keyframes: readonly { readonly timeSeconds: number; readonly value?: unknown }[] }[],
): ShowKeyframe[] {
  const group = keyframeGroups.find((candidate) => candidate.controlId === GLOBE_TARGETS.txShow);
  if (!group) return [];
  return group.keyframes
    .filter((keyframe) => typeof keyframe.value === "number")
    .map((keyframe) => ({ timeSeconds: keyframe.timeSeconds, value: keyframe.value as number }))
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
}
