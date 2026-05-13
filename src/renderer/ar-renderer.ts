import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { LoadedModelAsset, MarkerModelInstance, MarkerRuntime, ModelPackage } from "../types";
import { PackageLoader } from "../packages/package-loader";

export class ArRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.Camera();
  readonly renderer: THREE.WebGLRenderer;

  private readonly clock = new THREE.Clock();
  private readonly loader = new GLTFLoader();
  private readonly modelCache = new Map<string, Promise<LoadedModelAsset>>();
  private readonly instances = new Map<string, MarkerModelInstance>();
  private readonly mixers = new Map<string, THREE.AnimationMixer>();
  private readonly actions = new Map<string, THREE.AnimationAction[]>();
  private animationEnabled = true;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 2.2);
    this.scene.add(ambient);
  }

  attach(container: HTMLElement): void {
    container.appendChild(this.renderer.domElement);
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
    marker.root.add(root);

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

function applyPackageTransform(root: THREE.Object3D, modelPackage: ModelPackage): void {
  const [px, py, pz] = modelPackage.transform.position;
  const [rx, ry, rz] = modelPackage.transform.rotation;
  const [sx, sy, sz] = modelPackage.transform.scale;
  const displayScale = modelPackage.scale.default;

  root.position.set(px, py, pz);
  root.rotation.set(rx, ry, rz);
  root.scale.set(sx * displayScale, sy * displayScale, sz * displayScale);
}
