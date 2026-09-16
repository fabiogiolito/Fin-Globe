// Gold globe renderer on Three.js: real GEBCO elevation displaces a dense sphere, a physically
// based material splits matte stone oceans from metallic gold continents, a room environment
// gives the metal something to reflect, and a bloom/grain composite finishes the frame.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

import bluemarbleUrl from "./assets/bluemarble.jpg";
import elevationUrl from "./assets/elevation.png";
import stoneRoughUrl from "./assets/stone-rough.jpg";
import stoneUrl from "./assets/stone.jpg";
import { bakeGlobeMaps, type GlobeMaps } from "./globe-bake";
import { createTransactionLayer, type TransactionLayer, type TransactionRecord } from "./globe-transactions";
import transactionsData from "./transactions.json" with { type: "json" };

type Vec3 = readonly [number, number, number];
type Size = readonly [number, number];

/**
 * Everything that drives one frame. Three independent objects share one world space: the camera,
 * the globe, and the light. Positions are world units (globe radius = 1); angles are degrees.
 */
export interface GlobeState {
  readonly spin: number;
  readonly relief: number;
  readonly globeX: number;
  readonly globeY: number;
  readonly globeZ: number;
  /** 0 = matte cast gold, 1 = mirror-polished. */
  readonly shine: number;
  /** 0 = silver, 1 = baked gold, 2 = deep saturated gold. */
  readonly gold: number;
  /** Stone micro-relief strength; 0 = smooth plaster, 2 = coarse pitted rock. */
  readonly stoneRoughness: number;
  /** Which spread photograph drives the stone: long smooth sweeps or short choppy strokes. */
  readonly stoneFinish: GlobeStoneFinish;
  readonly cameraX: number;
  readonly cameraY: number;
  readonly cameraZ: number;
  /** Camera orientation; yaw 0 / pitch 0 looks down -Z toward the origin from +Z. */
  readonly cameraYaw: number;
  readonly cameraPitch: number;
  /** Depth of field: distance from the camera that is in focus, and how strongly the rest defocuses. */
  readonly focusDistance: number;
  readonly focusBlur: number;
  /** Light position; the beam always aims at the world origin. */
  readonly lightX: number;
  readonly lightY: number;
  readonly lightZ: number;
  readonly lightIntensity: number;
  /** Half-angle of the beam cone in degrees. */
  readonly beamAngle: number;
  /** Fraction of the cone that fades out at the edge, 0 hard to 1 fully soft. */
  readonly beamSoftness: number;
  /** Darkens the surface as it curves away from the camera; 0 = off. */
  readonly edgeFalloff: number;
  /** Final-image white balance, -1 cool to 1 warm. */
  readonly temperature: number;
  /** Final-image tint, -1 green to 1 magenta. */
  readonly tint: number;
  /** Transaction beams toggle: 1 lets transactions start, 0 stops new ones (running ones finish). */
  readonly txShow: number;
  readonly txIntensity: number;
  readonly txShimmer: number;
}

export type GlobeStoneFinish = "smooth" | "rough";
export const GLOBE_STONE_FINISHES: readonly GlobeStoneFinish[] = ["smooth", "rough"];

export const GLOBE_DEFAULTS: GlobeState = {
  spin: 210,
  relief: 0.9,
  globeX: 0,
  globeY: 0,
  globeZ: 0,
  shine: 0.3,
  gold: 1,
  stoneRoughness: 1.6,
  stoneFinish: "smooth",
  cameraX: 0,
  cameraY: 0,
  cameraZ: 7.2,
  cameraYaw: 0,
  cameraPitch: 0,
  focusDistance: 7.2,
  focusBlur: 0.3,
  lightX: -7,
  lightY: 7.4,
  lightZ: 6.3,
  lightIntensity: 1.1,
  beamAngle: 22,
  beamSoftness: 0.6,
  edgeFalloff: 1,
  temperature: 0,
  tint: 0,
  txShow: 1,
  txIntensity: 1,
  txShimmer: 1,
};

export const GLOBE_TUNING = {
  camera: { fov: 32, near: 0.1, far: 100 },
  planet: { radius: 1, widthSegments: 1024, heightSegments: 512 },
  maps: { size: [4096, 2048] as const },
  environmentIntensity: 0.6,
  bloom: { strength: 0.18, radius: 0.5, threshold: 1.0 },
} as const;

/** One keyframe of the Show toggle track; the toggle is on wherever the last keyframe value is >= 0.5. */
export interface ShowKeyframe {
  readonly timeSeconds: number;
  readonly value: number;
}

export interface GlobeFrameContext {
  readonly timeSeconds: number;
  /** Show toggle keyframes sorted by time; empty means the current `txShow` value applies at all times. */
  readonly showSchedule: readonly ShowKeyframe[];
}

export interface GlobeRenderer {
  readonly ready: Promise<void>;
  /** Presents one frame at the given backing size and timeline context. Safe to call before ready (no-op). */
  /** Returns the number of transaction beams active in that frame. */
  render(state: GlobeState, size: Size, context: GlobeFrameContext): number;
  /** Renders one frame and returns tightly packed RGBA8 pixels, top row first, premultiplied. */
  renderPixels(state: GlobeState, size: Size, context: GlobeFrameContext): Promise<Uint8Array>;
  dispose(): void;
}

/** Evaluates the Show toggle at a time from its keyframes (step semantics), or the live value. */
export function createShowAt(state: GlobeState, schedule: readonly ShowKeyframe[]): (t: number) => boolean {
  if (schedule.length === 0) return () => state.txShow >= 0.5;
  return (t) => {
    let value = schedule[0]!.value;
    for (const keyframe of schedule) {
      if (keyframe.timeSeconds <= t) value = keyframe.value;
      else break;
    }
    return value >= 0.5;
  };
}

export const GLOBE_TRANSACTIONS: readonly TransactionRecord[] = transactionsData.transactions;

// Depth of field: a per-pixel disc gather whose radius grows with distance from the focus plane.
// Alpha is gathered too, so the transparent background stays transparent for the runtime.
const DOF_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    focusDistance: { value: 7.2 },
    blurStrength: { value: 0.3 },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    texelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float focusDistance;
    uniform float blurStrength;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec2 texelSize;
    varying vec2 vUv;
    float viewDistance(vec2 uv) {
      return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
    }
    void main() {
      float dist = viewDistance(vUv);
      float coc = clamp(abs(dist - focusDistance) / max(focusDistance * 0.6, 0.01), 0.0, 1.0);
      float radius = coc * blurStrength * 22.0;
      vec4 center = texture2D(tDiffuse, vUv);
      if (radius < 0.5) { gl_FragColor = center; return; }
      float angle = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
      float c = cos(angle), s = sin(angle);
      mat2 rot = mat2(c, s, -s, c);
      vec3 rgb = center.rgb * center.a;
      float alpha = center.a;
      float weight = 1.0;
      const int TAPS = 24;
      for (int i = 0; i < TAPS; i++) {
        float t = (float(i) + 0.5) / float(TAPS);
        float r = sqrt(t) * radius;
        float a = float(i) * 2.399963;
        vec2 offset = rot * vec2(cos(a), sin(a)) * r * texelSize;
        vec4 tap = texture2D(tDiffuse, vUv + offset);
        rgb += tap.rgb * tap.a;
        alpha += tap.a;
        weight += 1.0;
      }
      alpha /= weight;
      rgb /= max(alpha * weight, 1e-4);
      gl_FragColor = vec4(rgb, alpha);
    }
  `,
};

const GRAIN_SHADER = {
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, temperature: { value: 0 }, tint: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float seed;
    uniform float temperature;
    uniform float tint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p + seed, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // White balance and tint as linear channel gains, before tone mapping.
      color.rgb *= vec3(1.0 + 0.3 * temperature, 1.0, 1.0 - 0.3 * temperature);
      color.rgb *= vec3(1.0 + 0.15 * tint, 1.0 - 0.25 * tint, 1.0 + 0.15 * tint);
      float falloff = smoothstep(0.35, 1.0, length(vUv - 0.5) * 1.45);
      color.rgb *= 1.0 - falloff * 0.4;
      color.rgb += (hash(gl_FragCoord.xy) - 0.5) * 0.028 * color.a;
      gl_FragColor = color;
    }
  `,
};

export function createGlobeRenderer(canvas: HTMLCanvasElement): GlobeRenderer {
  let disposed = false;
  let renderer: THREE.WebGLRenderer | undefined;
  let composer: EffectComposer | undefined;
  let grain: ShaderPass | undefined;
  let dof: ShaderPass | undefined;
  let depthTexture: THREE.DepthTexture | undefined;
  let scene: THREE.Scene | undefined;
  let camera: THREE.PerspectiveCamera | undefined;
  let globe: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial> | undefined;
  let key: THREE.SpotLight | undefined;
  let keyArea: THREE.RectAreaLight | undefined;
  let maps: GlobeMaps | undefined;
  let transactions: TransactionLayer | undefined;
  let lastSurfaceRelief = -1;
  let currentFinish: GlobeStoneFinish | undefined;
  let pendingFinish: GlobeStoneFinish | undefined;
  let elevationImage: HTMLImageElement | undefined;
  let landColorImage: HTMLImageElement | undefined;
  let environment: THREE.Texture | undefined;
  let currentSize: Size = [0, 0];
  const goldRoughnessScale = { value: 1 };
  const goldSaturation = { value: 1 };
  const stoneNormalScale = { value: 1 };
  const edgeFalloff = { value: 1 };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    transactions?.dispose();
    globe?.geometry.dispose();
    globe?.material.dispose();
    maps?.dispose();
    environment?.dispose();
    composer?.dispose();
    renderer?.dispose();
    renderer = undefined;
  };

  const ready = (async () => {
    const [elevation, landColor, stone] = await Promise.all([
      loadImage(elevationUrl),
      loadImage(bluemarbleUrl),
      loadImage(stoneUrl),
    ]);
    elevationImage = elevation;
    landColorImage = landColor;
    currentFinish = "smooth";
    if (disposed) return;
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    maps = bakeGlobeMaps({ elevation, landColor, stone }, GLOBE_TUNING.maps.size);
    if (disposed) {
      maps.dispose();
      renderer.dispose();
      return;
    }

    scene = new THREE.Scene();
    // Studio: the environment holds a dim fill on the +Z side and a rim strip above and behind the
    // origin. It is fixed in world space like everything else; the key is a positional light (below).
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(createStudioEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = environment;
    scene.environmentIntensity = GLOBE_TUNING.environmentIntensity;

    const { radius, widthSegments, heightSegments } = GLOBE_TUNING.planet;
    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const material = new THREE.MeshPhysicalMaterial({
      map: maps.albedo,
      normalMap: maps.normal,
      normalScale: new THREE.Vector2(1, 1),
      roughnessMap: maps.surface,
      metalnessMap: maps.surface,
      roughness: 1,
      metalness: 1,
      displacementMap: maps.height,
      displacementScale: 0.05,
      envMapIntensity: 1,
    });
    // Product uniforms ride on the standard physical shader: gold roughness and saturation apply
    // where the surface is metallic, stone micro-normal strength where it is not, and edge falloff
    // darkens every light contribution as the surface turns away from the camera.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.goldRoughnessScale = goldRoughnessScale;
      shader.uniforms.goldSaturation = goldSaturation;
      shader.uniforms.stoneNormalScale = stoneNormalScale;
      shader.uniforms.edgeFalloff = edgeFalloff;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float goldRoughnessScale;\nuniform float goldSaturation;\nuniform float stoneNormalScale;\nuniform float edgeFalloff;",
        )
        .replace(
          "#include <metalnessmap_fragment>",
          [
            "#include <metalnessmap_fragment>",
            "roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor * goldRoughnessScale, 0.04, 1.0), metalnessFactor);",
            "float goldLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));",
            "diffuseColor.rgb = mix(diffuseColor.rgb, clamp(mix(vec3(goldLum), diffuseColor.rgb, goldSaturation), 0.0, 1.0), metalnessFactor);",
          ].join("\n"),
        )
        .replace(
          "#include <normal_fragment_maps>",
          THREE.ShaderChunk.normal_fragment_maps.replace(
            "mapN.xy *= normalScale;",
            "mapN.xy *= normalScale * mix(stoneNormalScale, 1.0, metalnessFactor);",
          ),
        )
        .replace(
          "#include <lights_fragment_end>",
          [
            "#include <lights_fragment_end>",
            "float edgeShade = pow(saturate(dot(normal, geometryViewDir)), edgeFalloff);",
            "reflectedLight.directDiffuse *= edgeShade;",
            "reflectedLight.directSpecular *= edgeShade;",
            "reflectedLight.indirectDiffuse *= edgeShade;",
            "reflectedLight.indirectSpecular *= edgeShade;",
          ].join("\n"),
        );
    };
    globe = new THREE.Mesh(geometry, material);
    globe.castShadow = true;
    globe.receiveShadow = true;
    scene.add(globe);
    // Beams are children of the globe so they follow its spin and position; their endpoints sit on
    // the baked terrain, so they are rebuilt whenever the maps or the relief scale change.
    transactions = createTransactionLayer(GLOBE_TRANSACTIONS);
    transactions.setSurface({ displacementScale: material.displacementScale, sampleHeight: maps.sampleHeight });
    lastSurfaceRelief = material.displacementScale;
    globe.add(transactions.group);

    // Key: a positional spot with no distance falloff, aimed at the world origin. The globe is lit
    // when it sits inside the cone and falls into rim-lit shadow when it moves out of it.
    key = new THREE.SpotLight(0xfff0dc, 1, 0, Math.PI / 8, 0.6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    scene.add(key);
    scene.add(key.target);
    // A matching area light gives the metal a broad sheen instead of a pinpoint highlight.
    RectAreaLightUniformsLib.init();
    keyArea = new THREE.RectAreaLight(0xfff0dc, 1, 4.5, 4.5);
    scene.add(keyArea);

    camera = new THREE.PerspectiveCamera(
      GLOBE_TUNING.camera.fov,
      1,
      GLOBE_TUNING.camera.near,
      GLOBE_TUNING.camera.far,
    );

    depthTexture = new THREE.DepthTexture(1, 1);
    const composerTarget = new THREE.WebGLRenderTarget(1, 1, {
      depthTexture,
      type: THREE.HalfFloatType,
    });
    composer = new EffectComposer(renderer, composerTarget);
    // The composer clones the target for its second buffer; give that clone its own depth texture so
    // whichever buffer the scene pass draws into carries depth for the DOF pass.
    if (!composer.renderTarget2.depthTexture) {
      composer.renderTarget2.depthTexture = new THREE.DepthTexture(1, 1);
    }
    composer.addPass(new RenderPass(scene, camera));
    dof = new ShaderPass(DOF_SHADER);
    dof.uniforms.tDepth!.value = composer.readBuffer.depthTexture;
    dof.uniforms.cameraNear!.value = GLOBE_TUNING.camera.near;
    dof.uniforms.cameraFar!.value = GLOBE_TUNING.camera.far;
    composer.addPass(dof);
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        GLOBE_TUNING.bloom.strength,
        GLOBE_TUNING.bloom.radius,
        GLOBE_TUNING.bloom.threshold,
      ),
    );
    grain = new ShaderPass(GRAIN_SHADER);
    composer.addPass(grain);
    composer.addPass(new OutputPass());
  })().catch((error: unknown) => {
    dispose();
    throw error;
  });

  // Switching the stone finish re-bakes the maps from the other photograph (about two seconds of
  // CPU work); the previous maps stay on screen until the new ones are ready.
  function switchFinish(finish: GlobeStoneFinish): void {
    if (finish === currentFinish || pendingFinish === finish || !elevationImage || !landColorImage) return;
    pendingFinish = finish;
    loadImage(finish === "rough" ? stoneRoughUrl : stoneUrl)
      .then((stone) => {
        if (disposed || pendingFinish !== finish || !globe || !elevationImage || !landColorImage) return;
        const next = bakeGlobeMaps({ elevation: elevationImage, landColor: landColorImage, stone }, GLOBE_TUNING.maps.size);
        const previous = maps;
        maps = next;
        currentFinish = finish;
        pendingFinish = undefined;
        globe.material.map = next.albedo;
        globe.material.normalMap = next.normal;
        globe.material.roughnessMap = next.surface;
        globe.material.metalnessMap = next.surface;
        globe.material.displacementMap = next.height;
        globe.material.needsUpdate = true;
        transactions?.setSurface({ displacementScale: globe.material.displacementScale, sampleHeight: next.sampleHeight });
        previous?.dispose();
        if (lastState && lastSize) draw(lastState, lastSize, lastContext);
      })
      .catch(() => {
        pendingFinish = undefined;
      });
  }
  let lastState: GlobeState | undefined;
  let lastSize: Size | undefined;
  let lastContext: GlobeFrameContext = { showSchedule: [], timeSeconds: 0 };
  let activeBeams = 0;

  function applyState(state: GlobeState, size: Size, context: GlobeFrameContext): void {
    if (!camera || !globe || !key || !grain || !scene) return;
    lastState = state;
    lastSize = size;
    lastContext = context;
    const timeSeconds = context.timeSeconds;
    const displacementScale = 0.05 * state.relief;
    if (transactions && maps && Math.abs(displacementScale - lastSurfaceRelief) > 1e-4) {
      transactions.setSurface({ displacementScale, sampleHeight: maps.sampleHeight });
      lastSurfaceRelief = displacementScale;
    }
    activeBeams = transactions?.update(timeSeconds, createShowAt(state, context.showSchedule), state.txIntensity, state.txShimmer) ?? 0;
    if (state.stoneFinish !== currentFinish) switchFinish(state.stoneFinish);
    // Camera: explicit position and orientation, independent of the globe.
    camera.aspect = size[0] / Math.max(1, size[1]);
    camera.position.set(state.cameraX, state.cameraY, state.cameraZ);
    camera.rotation.set(toRadians(state.cameraPitch), toRadians(state.cameraYaw), 0, "YXZ");
    camera.updateProjectionMatrix();

    // Globe: explicit position and spin.
    globe.position.set(state.globeX, state.globeY, state.globeZ);
    globe.rotation.y = toRadians(state.spin);
    globe.material.displacementScale = 0.05 * state.relief;
    globe.material.normalScale.setScalar(0.6 + 0.6 * state.relief);
    goldRoughnessScale.value = 3 * Math.pow(0.05, Math.min(1, Math.max(0, state.shine)));
    goldSaturation.value = state.gold;
    stoneNormalScale.value = state.stoneRoughness;
    edgeFalloff.value = Math.max(0, state.edgeFalloff);

    // Light: explicit position, always aimed at the origin, with an adjustable cone.
    key.position.set(state.lightX, state.lightY, state.lightZ);
    key.target.position.set(0, 0, 0);
    key.angle = toRadians(Math.min(89, Math.max(1, state.beamAngle)));
    key.penumbra = Math.min(1, Math.max(0, state.beamSoftness));
    key.intensity = 4.5 * state.lightIntensity;
    if (keyArea) {
      keyArea.position.copy(key.position);
      keyArea.lookAt(0, 0, 0);
      keyArea.intensity = 2.2 * state.lightIntensity;
    }

    if (dof) {
      dof.uniforms.focusDistance!.value = Math.max(0.05, state.focusDistance);
      dof.uniforms.blurStrength!.value = Math.max(0, state.focusBlur);
      (dof.uniforms.texelSize!.value as THREE.Vector2).set(1 / size[0], 1 / size[1]);
    }
    grain.uniforms.temperature!.value = state.temperature;
    grain.uniforms.tint!.value = state.tint;
    grain.uniforms.seed!.value = Math.random();
  }

  const draw = (state: GlobeState, size: Size, context: GlobeFrameContext): boolean => {
    if (disposed || !renderer || !composer || !scene || !camera || !globe || !key) return false;
    const full = normalizeSize(size);
    if (full[0] !== currentSize[0] || full[1] !== currentSize[1]) {
      currentSize = full;
      renderer.setSize(full[0], full[1], false);
      composer.setSize(full[0], full[1]);
    }
    applyState(state, full, context);
    // The scene pass renders into the current read buffer; the DOF pass reads that buffer's depth.
    if (dof) dof.uniforms.tDepth!.value = composer.readBuffer.depthTexture;
    composer.render();
    return true;
  };

  return {
    ready,
    render(state, size, context) {
      draw(state, size, context);
      return activeBeams;
    },
    async renderPixels(state, size, context) {
      await ready;
      if (disposed || !renderer) throw new Error("The globe renderer is disposed.");
      const full = normalizeSize(size);
      const previous = currentSize;
      draw(state, full, context);
      const gl = renderer.getContext();
      const pixels = new Uint8Array(full[0] * full[1] * 4);
      gl.readPixels(0, 0, full[0], full[1], gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      flipRows(pixels, full[0], full[1]);
      if (previous[0] > 0) draw(state, previous, context);
      return pixels;
    },
    dispose,
  };
}

// World-fixed studio: a dim wide fill on the +Z side (where the default camera sits) and a narrow rim
// strip above and behind the origin, so a globe outside the key beam keeps an edge light.
function createStudioEnvironment(): THREE.Scene {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x000000);
  const panel = (color: THREE.Color, w: number, h: number, position: Vec3) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    mesh.position.set(position[0], position[1], position[2]);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  };
  panel(new THREE.Color(1.0, 0.95, 0.88).multiplyScalar(1.0), 12, 8, [0.5, 2.5, 6]);
  panel(new THREE.Color(1.0, 0.92, 0.8).multiplyScalar(9.0), 14, 2.0, [0, 3.4, -6]);
  return studio;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load globe asset ${url}.`));
    image.src = url;
  });
}

function flipRows(pixels: Uint8Array, width: number, height: number): void {
  const stride = width * 4;
  const row = new Uint8Array(stride);
  for (let y = 0; y < Math.floor(height / 2); y += 1) {
    const top = y * stride;
    const bottom = (height - 1 - y) * stride;
    row.set(pixels.subarray(top, top + stride));
    pixels.copyWithin(top, bottom, bottom + stride);
    pixels.set(row, bottom);
  }
}

function normalizeSize(size: Size): [number, number] {
  return [Math.max(1, Math.floor(size[0])), Math.max(1, Math.floor(size[1]))];
}
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}
