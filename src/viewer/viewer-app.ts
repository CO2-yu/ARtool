import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PackageLoader } from "../packages/package-loader";
import type { ModelPackage, Vector3Tuple } from "../types";
import { appUrl } from "../utils/app-url";

export async function startViewerApp(root: HTMLElement): Promise<void> {
  try {
    const packageLoader = new PackageLoader();
    const config = await packageLoader.loadAppConfig();
    const index = await packageLoader.loadPackageIndex(config.app.packagesIndex);
    const packageId = resolvePackageId(index.packages.map((entry) => entry.id));
    const modelPackage = await packageLoader.loadPackage(packageId);
    const modelUrl = packageLoader.resolvePackageAsset(modelPackage, modelPackage.model.path);

    renderViewer(root, modelPackage);
    const viewport = required<HTMLElement>(root, "[data-role='viewer-canvas']");
    const viewer = new InternalModelViewer(viewport);
    await viewer.load(modelUrl, modelPackage);

    const slider = root.querySelector<HTMLInputElement>("[data-role='viewer-scale-slider']");
    const valueLabel = root.querySelector<HTMLElement>("[data-role='viewer-scale-value']");
    slider?.addEventListener("input", () => {
      const value = clamp(Number(slider.value), modelPackage.scale.min, modelPackage.scale.max);
      viewer.setScale(value);
      if (valueLabel) {
        valueLabel.textContent = `${value.toFixed(2)}x`;
      }
    });
  } catch (error) {
    console.error("3D viewer initialization failed", error);
    root.innerHTML = `
      <main class="viewer-shell viewer-error">
        <section class="viewer-error-panel">
          <h1>3Dモデルを表示できませんでした</h1>
          <p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
          <a class="viewer-link" href="${escapeHtml(appUrl("ar/"))}">AR画面へ戻る</a>
        </section>
      </main>
    `;
  }
}

function renderViewer(root: HTMLElement, modelPackage: ModelPackage): void {
  const showScaleSlider = modelPackage.ui.showScaleSlider !== false;
  const initialScale = clamp(modelPackage.scale.default, modelPackage.scale.min, modelPackage.scale.max);

  root.innerHTML = `
    <main class="viewer-shell">
      <header class="viewer-header">
        <div>
          <div class="viewer-kicker">3D Viewer</div>
          <h1>${escapeHtml(modelPackage.name)}</h1>
        </div>
        <a class="viewer-link" href="${escapeHtml(toArUrl(modelPackage.id))}">マーカーARで表示</a>
      </header>
      <div class="model-viewer" data-role="viewer-canvas" aria-label="${escapeHtml(modelPackage.name)} の3Dビュー"></div>
      <section class="viewer-panel">
        <p>${escapeHtml(modelPackage.description)}</p>
        <div class="viewer-scale" ${showScaleSlider ? "" : "hidden"}>
          <div class="scale-header">
            <span>倍率</span>
            <span data-role="viewer-scale-value">${initialScale.toFixed(2)}x</span>
          </div>
          <input
            data-role="viewer-scale-slider"
            type="range"
            min="${modelPackage.scale.min}"
            max="${modelPackage.scale.max}"
            step="${modelPackage.scale.step}"
            value="${initialScale}"
            aria-label="モデル倍率"
          />
        </div>
      </section>
    </main>
  `;
}

class InternalModelViewer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private readonly controls: OrbitControls;
  private readonly loader = new GLTFLoader();
  private readonly dracoLoader = new DRACOLoader();
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;
  private mixer: THREE.AnimationMixer | null = null;
  private modelRoot: THREE.Object3D | null = null;
  private baseScale: Vector3Tuple = [1, 1, 1];

  constructor(private readonly container: HTMLElement) {
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x181a1a, 1);
    this.renderer.domElement.className = "internal-viewer-canvas";
    Object.assign(this.renderer.domElement.style, {
      display: "block",
      width: "100%",
      height: "100%",
      touchAction: "none",
    });
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    this.scene.add(keyLight);

    this.dracoLoader.setDecoderPath(appUrl("draco/"));
    this.loader.setDRACOLoader(this.dracoLoader);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.renderLoop();
  }

  async load(modelUrl: string, modelPackage: ModelPackage): Promise<void> {
    const gltf = await this.loader.loadAsync(modelUrl);
    this.modelRoot = gltf.scene;
    this.baseScale = [...modelPackage.transform.scale] as Vector3Tuple;

    const [px, py, pz] = modelPackage.transform.position;
    const [rx, ry, rz] = modelPackage.transform.rotation;
    this.modelRoot.position.set(px, py, pz);
    this.modelRoot.rotation.set(rx, ry, rz);
    this.setScale(modelPackage.scale.default);
    this.scene.add(this.modelRoot);

    if (gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.modelRoot);
      const clip =
        gltf.animations.find((item) => item.name === modelPackage.animation.defaultClip) ?? gltf.animations[0];
      const action = this.mixer.clipAction(clip);
      if (modelPackage.animation.autoPlay) {
        action.play();
      }
    }

    this.frameModel();
  }

  setScale(value: number): void {
    if (!this.modelRoot) {
      return;
    }
    const [sx, sy, sz] = this.baseScale;
    this.modelRoot.scale.set(sx * value, sy * value, sz * value);
    this.modelRoot.updateMatrixWorld(true);
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private frameModel(): void {
    if (!this.modelRoot) {
      return;
    }

    this.modelRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    if (box.isEmpty()) {
      this.camera.position.set(2, 1.5, 2);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.01);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (radius / Math.sin(fov / 2)) * 1.15;
    const direction = new THREE.Vector3(1, 0.65, 1).normalize();

    this.camera.position.copy(sphere.center).addScaledVector(direction, distance);
    this.camera.near = Math.max(distance / 1000, 0.001);
    this.camera.far = Math.max(distance * 100, 100);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(sphere.center);
    this.controls.minDistance = radius * 0.1;
    this.controls.maxDistance = distance * 20;
    this.controls.update();
  }

  private renderLoop = (): void => {
    requestAnimationFrame(this.renderLoop);
    const delta = this.clock.getDelta();
    this.mixer?.update(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}

function resolvePackageId(packageIds: string[]): string {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("package");
  if (requested && packageIds.includes(requested)) {
    return requested;
  }
  const fallback = packageIds[0];
  if (!fallback) {
    throw new Error("No packages are available.");
  }
  return fallback;
}

function toArUrl(packageId: string): string {
  return appUrl(`ar/?package=${encodeURIComponent(packageId)}`);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function required<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing viewer element: ${selector}`);
  }
  return element;
}
