import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { LoadedModelAsset, MarkerModelInstance, MarkerRuntime, ModelPackage } from "../types";
import { PackageLoader } from "../packages/package-loader";

export class ArRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.Camera();
  readonly renderer: THREE.WebGLRenderer;

  private readonly clock = new THREE.Clock();
  private readonly dracoLoader = new DRACOLoader();
  private readonly loader = new GLTFLoader();
  private readonly modelCache = new Map<string, Promise<LoadedModelAsset>>();
  private readonly instances = new Map<string, MarkerModelInstance>();
  private readonly mixers = new Map<string, THREE.AnimationMixer>();
  private readonly actions = new Map<string, THREE.AnimationAction[]>();
  private animationEnabled = true;
  private modelScale = 1;

  constructor() {
    this.dracoLoader.setDecoderPath("draco/");
    this.loader.setDRACOLoader(this.dracoLoader);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.resize();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 2.2);
    this.scene.add(ambient);
  }

  attach(container: HTMLElement): void {
    container.appendChild(this.renderer.domElement);
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => this.resize(), 100);
    });
  }

  resize(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    Object.assign(this.renderer.domElement.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      margin: "0",
      padding: "0",
      objectFit: "cover",
      objectPosition: "center center",
    });
  }

  async ensureModel(
    marker: MarkerRuntime,
    modelPackage: ModelPackage,
    packageLoader: PackageLoader,
  ): Promise<MarkerModelInstance> {
    const existing = this.instances.get(marker.markerId);
    if (existing) {
      existing.root.visible = true;
      return existing;
    }

    const asset = await this.loadModelAsset(modelPackage, packageLoader);
    const root = clone(asset.source);
    root.name = `model:${modelPackage.id}:${marker.markerId}`;
    applyPackageTransform(root, modelPackage);
    root.scale.setScalar(this.modelScale);
    marker.displayRoot.add(root);
    marker.displayRoot.visible = true;

    const mixer = asset.animations.length > 0 ? new THREE.AnimationMixer(root) : null;
    if (mixer) {
      const clip =
        asset.animations.find((item) => item.name === modelPackage.animation.defaultClip) ?? asset.animations[0];
      const action = mixer.clipAction(clip);
      action.reset();
      if (modelPackage.animation.autoPlay && this.animationEnabled) {
        action.play();
      }
      this.mixers.set(marker.markerId, mixer);
      this.actions.set(marker.markerId, [action]);
    }

    const instance: MarkerModelInstance = {
      markerId: marker.markerId,
      packageId: modelPackage.id,
      root,
      hasAnimation: asset.animations.length > 0,
    };
    this.instances.set(marker.markerId, instance);
    return instance;
  }

  hideMarkerModel(markerId: string): void {
    const instance = this.instances.get(markerId);
    if (instance) {
      instance.root.visible = false;
    }
  }

  clearModelCache(): void {
    this.modelCache.clear();
  }

  getActiveModelCount(): number {
    return [...this.instances.values()].filter((instance) => instance.root.visible).length;
  }

  setModelScale(value: number): void {
    this.modelScale = value;
    for (const instance of this.instances.values()) {
      instance.root.scale.setScalar(value);
    }
  }

  setAnimationPlaying(playing: boolean): void {
    this.animationEnabled = playing;
    for (const actions of this.actions.values()) {
      for (const action of actions) {
        action.paused = !playing;
        if (playing && !action.isRunning()) {
          action.play();
        }
      }
    }
  }

  hasVisibleAnimation(): boolean {
    return [...this.instances.values()].some((instance) => instance.root.visible && instance.hasAnimation);
  }

  getCachedModelIds(): string[] {
    return [...this.modelCache.keys()];
  }

  render(): void {
    const delta = this.clock.getDelta();
    for (const mixer of this.mixers.values()) {
      mixer.update(delta);
    }
    this.renderer.render(this.scene, this.camera);
  }

  captureDataUrl(): string {
    return this.renderer.domElement.toDataURL("image/png");
  }

  captureCompositeDataUrl(video: HTMLVideoElement | null): string {
    const sourceCanvas = this.renderer.domElement;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return this.captureDataUrl();
    }

    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      drawCover(context, video, width, height);
    } else {
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(sourceCanvas, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  }

  private loadModelAsset(modelPackage: ModelPackage, packageLoader: PackageLoader): Promise<LoadedModelAsset> {
    const cached = this.modelCache.get(modelPackage.id);
    if (cached) {
      return cached;
    }

    const modelUrl = packageLoader.resolvePackageAsset(modelPackage, modelPackage.model.path);
    const loadPromise = this.loader.loadAsync(modelUrl).then((gltf) => ({
      packageId: modelPackage.id,
      source: gltf.scene,
      animations: gltf.animations,
    }));
    this.modelCache.set(modelPackage.id, loadPromise);
    return loadPromise;
  }
}

function drawCover(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  targetWidth: number,
  targetHeight: number,
): void {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (sourceWidth === 0 || sourceHeight === 0) {
    context.fillStyle = "#000";
    context.fillRect(0, 0, targetWidth, targetHeight);
    return;
  }

  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = (targetWidth - drawWidth) / 2;
  const dy = (targetHeight - drawHeight) / 2;
  context.drawImage(video, dx, dy, drawWidth, drawHeight);
}

function applyPackageTransform(root: THREE.Object3D, modelPackage: ModelPackage): void {
  const [px, py, pz] = modelPackage.transform.position;
  const [rx, ry, rz] = modelPackage.transform.rotation;
  const [sx, sy, sz] = modelPackage.transform.scale;
  const displayScale = modelPackage.scale.default;

  root.position.set(px, py, pz);
  root.rotation.set(rx, ry, rz);
  root.scale.set(sx * displayScale, sy * displayScale, sz * displayScale);
}
