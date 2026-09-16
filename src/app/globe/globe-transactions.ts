// Transaction beams: glowing flight-path arcs between countries. Each arc is drawn head-first from
// the origin, holds, then its tail follows and consumes it. A pulse travels along the beam for the
// shimmer, and a pool of point lights rides the active beams with smooth in/out envelopes so the gold
// reflects them. Endpoints sit on the displaced terrain, sampled from the bake.
import * as THREE from "three";

import { COUNTRY_COORDINATES } from "./countries";

export interface TransactionRecord {
  readonly from: string;
  readonly to: string;
  /** Start time in timeline seconds. */
  readonly time: number;
  /** Optional per-transaction brightness multiplier. */
  readonly intensity?: number;
}

export interface TransactionLayerOptions {
  /** Seconds one transaction takes from first appearing to fully consumed. */
  readonly durationSeconds?: number;
  /** How many beams carry a point light at once. */
  readonly lightCount?: number;
}

export interface TransactionSurface {
  /** Baked height 0..1 at a sphere uv. */
  sampleHeight(u: number, v: number): number;
  /** World units of displacement per unit of baked height (displacementScale). */
  readonly displacementScale: number;
}

export interface TransactionLayer {
  readonly group: THREE.Group;
  readonly lights: readonly THREE.PointLight[];
  /** Records that could not be placed because a country is unknown. */
  readonly skipped: readonly string[];
  /** Rebuilds arc geometry against the current terrain; call after a bake or a relief change. */
  setSurface(surface: TransactionSurface): void;
  /**
   * `showAt` answers whether the Show toggle was on at a given timeline time: a transaction starts
   * only if the toggle was on at its start time, and once started it always runs to completion.
   */
  update(timeSeconds: number, showAt: (timeSeconds: number) => boolean, intensity: number, shimmer: number): number;
  dispose(): void;
}

const BEAM_COLOR = new THREE.Color(1.0, 0.82, 0.45);
const LIGHT_COLOR = new THREE.Color(1.0, 0.8, 0.45);

const BEAM_SHADER = {
  vertexShader: /* glsl */ `
    varying float vT;
    void main() {
      vT = uv.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float head;
    uniform float tail;
    uniform float glow;
    uniform float shimmer;
    uniform float time;
    uniform vec3 color;
    varying float vT;
    void main() {
      if (vT > head || vT < tail) discard;
      float ends = smoothstep(0.0, 0.05, head - vT) * smoothstep(0.0, 0.05, vT - tail);
      float pulse = 0.5 + 0.5 * sin(vT * 48.0 - time * 9.0);
      float flow = 1.0 + shimmer * (pulse * pulse * 1.4 - 0.4);
      float headSpark = 1.0 + 1.5 * smoothstep(0.08, 0.0, head - vT);
      gl_FragColor = vec4(color * glow * flow * headSpark * ends, ends);
    }
  `,
};

/** Sphere uv for a latitude/longitude, following the equirect bake (u = 0 at 180° W). */
function toSphereUv(lat: number, lon: number): [number, number] {
  return [(lon + 180) / 360, 1 - (90 - lat) / 180];
}

/** Unit direction for a sphere uv using SphereGeometry's own vertex formula, so it lands on the map. */
function uvToUnitVector(u: number, v: number): THREE.Vector3 {
  const theta = u * Math.PI * 2;
  const phi = (1 - v) * Math.PI;
  return new THREE.Vector3(-Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi));
}

class ArcCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly a: THREE.Vector3,
    private readonly b: THREE.Vector3,
    private readonly radiusA: number,
    private readonly radiusB: number,
    private readonly lift: number,
  ) {
    super();
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const angle = this.a.angleTo(this.b);
    const sinAngle = Math.sin(angle) || 1e-6;
    const wa = Math.sin((1 - t) * angle) / sinAngle;
    const wb = Math.sin(t * angle) / sinAngle;
    target.copy(this.a).multiplyScalar(wa).addScaledVector(this.b, wb).normalize();
    const radius = this.radiusA + (this.radiusB - this.radiusA) * t + this.lift * Math.sin(Math.PI * t);
    return target.multiplyScalar(radius);
  }
}

interface Beam {
  readonly uvA: [number, number];
  readonly uvB: [number, number];
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  curve: ArcCurve;
  readonly material: THREE.ShaderMaterial;
  readonly mesh: THREE.Mesh;
  readonly record: TransactionRecord;
}

export function createTransactionLayer(
  records: readonly TransactionRecord[],
  options: TransactionLayerOptions = {},
): TransactionLayer {
  const duration = options.durationSeconds ?? 2.8;
  const lightCount = options.lightCount ?? 8;
  const group = new THREE.Group();
  const beams: Beam[] = [];
  const skipped: string[] = [];
  let surface: TransactionSurface = { displacementScale: 0.045, sampleHeight: () => 0.42 };

  const surfaceRadius = (uv: [number, number]): number =>
    1 + surface.displacementScale * surface.sampleHeight(uv[0], uv[1]);

  for (const record of records) {
    const from = COUNTRY_COORDINATES[record.from];
    const to = COUNTRY_COORDINATES[record.to];
    if (!from || !to) {
      skipped.push(`${record.from} -> ${record.to}`);
      continue;
    }
    const uvA = toSphereUv(from[0], from[1]);
    const uvB = toSphereUv(to[0], to[1]);
    const a = uvToUnitVector(uvA[0], uvA[1]);
    const b = uvToUnitVector(uvB[0], uvB[1]);
    const lift = 0.06 + 0.42 * (a.angleTo(b) / Math.PI);
    const curve = new ArcCurve(a, b, surfaceRadius(uvA), surfaceRadius(uvB), lift);
    const material = new THREE.ShaderMaterial({
      ...BEAM_SHADER,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      uniforms: {
        head: { value: 0 },
        tail: { value: 0 },
        glow: { value: 0 },
        shimmer: { value: 1 },
        time: { value: 0 },
        color: { value: BEAM_COLOR.clone() },
      },
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0042, 6, false), material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    beams.push({ uvA, uvB, a, b, curve, material, mesh, record });
  }

  // A fixed pool keeps the lit material's shader stable; unused lights sit at zero intensity.
  const lights: THREE.PointLight[] = [];
  for (let i = 0; i < lightCount; i += 1) {
    const light = new THREE.PointLight(LIGHT_COLOR, 0, 0.9, 2);
    group.add(light);
    lights.push(light);
  }

  const point = new THREE.Vector3();
  const rebuild = () => {
    for (const beam of beams) {
      const lift = 0.06 + 0.42 * (beam.a.angleTo(beam.b) / Math.PI);
      beam.curve = new ArcCurve(beam.a, beam.b, surfaceRadius(beam.uvA), surfaceRadius(beam.uvB), lift);
      beam.mesh.geometry.dispose();
      beam.mesh.geometry = new THREE.TubeGeometry(beam.curve, 96, 0.0042, 6, false);
    }
  };

  return {
    group,
    lights,
    skipped,
    setSurface(next) {
      surface = next;
      rebuild();
    },
    update(timeSeconds, showAt, intensity, shimmer) {
      let lightIndex = 0;
      const candidates: { position: THREE.Vector3; strength: number }[] = [];
      for (const beam of beams) {
        const local = timeSeconds - beam.record.time;
        const active = local >= 0 && local <= duration && showAt(beam.record.time);
        beam.mesh.visible = active;
        if (!active) continue;
        const p = local / duration;
        // Head draws out over the first 45%, both ends hold, then the tail consumes over the last 45%.
        const head = smoothstep(Math.min(1, p / 0.45));
        const tail = smoothstep(Math.max(0, (p - 0.55) / 0.45));
        const strength = intensity * (beam.record.intensity ?? 1);
        beam.material.uniforms.head!.value = head;
        beam.material.uniforms.tail!.value = tail;
        beam.material.uniforms.glow!.value = 1.7 * strength;
        beam.material.uniforms.shimmer!.value = shimmer;
        beam.material.uniforms.time!.value = timeSeconds;

        // Reflection light follows the head while it travels, then rests on the destination, with the
        // same smooth in/out so it never pops.
        const lightEnvelope = smoothstepRange(p, 0, 0.08) * (1 - smoothstepRange(p, 0.9, 1));
        beam.curve.getPoint(p < 0.45 ? head : 1, point);
        candidates.push({ position: point.clone(), strength: strength * lightEnvelope });
      }
      candidates.sort((x, y) => y.strength - x.strength);
      for (const candidate of candidates) {
        if (lightIndex >= lights.length) break;
        const light = lights[lightIndex]!;
        light.position.copy(candidate.position);
        light.intensity = 0.22 * candidate.strength;
        lightIndex += 1;
      }
      for (; lightIndex < lights.length; lightIndex += 1) lights[lightIndex]!.intensity = 0;
      return candidates.length;
    },
    dispose() {
      for (const beam of beams) {
        beam.mesh.geometry.dispose();
        beam.material.dispose();
      }
      group.clear();
    },
  };
}

function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function smoothstepRange(x: number, from: number, to: number): number {
  return smoothstep((x - from) / Math.max(1e-6, to - from));
}
