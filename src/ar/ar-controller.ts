import * as THREE from "three";
import { THREEx } from "@ar-js-org/ar.js-threejs";
import type { MarkerDefinition, MarkerRuntime } from "../types";

export class ArController {
  private source: any = null;
  private context: any = null;
  private readonly markers = new Map<string, MarkerRuntime>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly rendererElement: HTMLCanvasElement,
    private readonly container: HTMLElement,
  ) {}

  async initialize(): Promise<void> {
    this.source = new THREEx.ArToolkitSource({
      sourceType: "webcam",
      sourceWidth: 640,
      sourceHeight: 480,
      displayWidth: window.innerWidth,
      displayHeight: window.innerHeight,
    });

    await new Promise<void>((resolve, reject) => {
      this.source!.init(resolve, reject);
    });
    this.attachVideoElement();

    this.context = new THREEx.ArToolkitContext({
      cameraParametersUrl: "data/camera_para.dat",
      detectionMode: "mono",
      maxDetectionRate: 30,
      canvasWidth: 640,
      canvasHeight: 480,
    });

    await new Promise<void>((resolve) => {
      this.context!.init(() => {
        const projection = this.context!.getProjectionMatrix();
        this.camera.projectionMatrix.copy(projection as THREE.Matrix4);
        resolve();
      });
    });

    window.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("scroll", () => this.resize());
    this.resize();
  }

  registerMarkers(definitions: MarkerDefinition[]): MarkerRuntime[] {
    if (!this.context) {
      throw new Error("AR controller is not initialized.");
    }

    for (const definition of definitions) {
      if (this.markers.has(definition.markerId)) {
        continue;
      }

      const root = new THREE.Group();
      root.name = `marker:${definition.markerId}`;
      root.visible = false;
      this.scene.add(root);

      new THREEx.ArMarkerControls(this.context, root, {
        type: "pattern",
        patternUrl: definition.patternUrl,
        size: 1,
      });

      this.markers.set(definition.markerId, {
        markerId: definition.markerId,
        packageId: definition.packageId,
        root,
        visible: false,
        ignoredUntilLost: false,
      });
    }

    return [...this.markers.values()];
  }

  update(): void {
    if (!this.source?.ready || !this.context || !this.source.domElement) {
      return;
    }
    this.context.update(this.source.domElement);
  }

  getMarkers(): MarkerRuntime[] {
    return [...this.markers.values()];
  }

  resize(): void {
    this.layoutFullViewport();
  }

  layoutFullViewport(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const visualWidth = Math.round(window.visualViewport?.width ?? width);
    const visualHeight = Math.round(window.visualViewport?.height ?? height);
    const viewportWidth = Math.max(width, visualWidth);
    const viewportHeight = Math.max(height, visualHeight);

    this.applyCoverStyle(this.source?.domElement ?? null, 0);
    this.applyCoverStyle(this.rendererElement, 1);

    this.rendererElement.width = Math.round(viewportWidth * window.devicePixelRatio);
    this.rendererElement.height = Math.round(viewportHeight * window.devicePixelRatio);

    const arCanvas = this.context?.arController?.canvas;
    if (arCanvas) {
      this.applyCoverStyle(arCanvas, 1);
      arCanvas.width = this.rendererElement.width;
      arCanvas.height = this.rendererElement.height;
    }
  }

  private attachVideoElement(): void {
    const element = this.source?.domElement;
    if (!element) {
      return;
    }

    element.classList.add("camera-feed");
    if (element.parentElement !== this.container) {
      this.container.insertBefore(element, this.rendererElement);
    }
    this.applyCoverStyle(element, 0);
  }

  private applyCoverStyle(element: HTMLElement | null, zIndex: number): void {
    if (!element) {
      return;
    }

    Object.assign(element.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100dvh",
      minWidth: "100vw",
      minHeight: "100vh",
      objectFit: "cover",
      objectPosition: "center center",
      margin: "0",
      padding: "0",
      transform: "none",
      zIndex: String(zIndex),
    });
  }
}
