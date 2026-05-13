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
    if (!this.source) {
      return;
    }

    this.source.onResizeElement();
    this.source.copyElementSizeTo(this.rendererElement);

    if (this.context?.arController?.canvas) {
      this.source.copyElementSizeTo(this.context.arController.canvas);
    }
  }
}
