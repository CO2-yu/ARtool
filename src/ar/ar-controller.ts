import * as THREE from "three";
import { THREEx } from "@ar-js-org/ar.js-threejs";
import type { MarkerDefinition, MarkerRuntime } from "../types";

export class ArController {
  private source: any = null;
  private context: any = null;
  private readonly markers = new Map<string, MarkerRuntime>();
  private lastLayoutWarning: string | null = null;

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
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => this.resize(), 100);
    });
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

      const displayRoot = new THREE.Group();
      displayRoot.name = `display:${definition.markerId}`;
      displayRoot.matrixAutoUpdate = false;
      displayRoot.visible = false;
      this.scene.add(displayRoot);

      new THREEx.ArMarkerControls(this.context, root, {
        type: "pattern",
        patternUrl: definition.patternUrl,
        size: 1,
      });

      const marker: MarkerRuntime = {
        markerId: definition.markerId,
        packageId: definition.packageId,
        root,
        displayRoot,
        visible: false,
        lastSeenAt: 0,
        lostHandled: true,
        ignoredUntilLost: false,
      };

      this.markers.set(definition.markerId, marker);
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
    this.applyCoverStyle(this.source?.domElement ?? null, 0);
    this.applyCoverStyle(this.rendererElement, 1);

    this.verifyViewportSync();
  }

  getVideoElement(): HTMLVideoElement | null {
    const element = this.source?.domElement;
    return element instanceof HTMLVideoElement ? element : null;
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
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center center",
      margin: "0",
      padding: "0",
      transform: "none",
      zIndex: String(zIndex),
    });
  }

  private verifyViewportSync(): void {
    const video = this.source?.domElement as HTMLElement | undefined;
    const rendererRect = this.rendererElement.getBoundingClientRect();
    const videoRect = video?.getBoundingClientRect();

    const warnings: string[] = [];
    // AR.js uses this internal canvas for marker detection. Its buffer size is
    // allowed to differ from the Three.js render buffer; forcing it to match can
    // break marker recognition on mobile.
    if (Math.round(rendererRect.width) !== window.innerWidth || Math.round(rendererRect.height) !== window.innerHeight) {
      warnings.push(
        `renderer CSS ${Math.round(rendererRect.width)}x${Math.round(rendererRect.height)} != viewport ${window.innerWidth}x${window.innerHeight}`,
      );
    }
    if (
      videoRect &&
      (Math.round(videoRect.width) !== window.innerWidth || Math.round(videoRect.height) !== window.innerHeight)
    ) {
      warnings.push(
        `video CSS ${Math.round(videoRect.width)}x${Math.round(videoRect.height)} != viewport ${window.innerWidth}x${window.innerHeight}`,
      );
    }

    const warning = warnings.join("; ");
    if (warning && warning !== this.lastLayoutWarning) {
      this.lastLayoutWarning = warning;
      console.warn(`AR viewport layout mismatch: ${warning}`);
    }
  }
}
