import "./styles.css";
import { ArController } from "./ar/ar-controller";
import { FpsCounter, isDebugMode } from "./debug/debug-mode";
import { PackageLoader } from "./packages/package-loader";
import { ArRenderer } from "./renderer/ar-renderer";
import { AppStateStore } from "./state/app-state";
import type { MarkerDefinition, MarkerRuntime, ModelPackage } from "./types";
import { AppUi } from "./ui/app-ui";

const state = new AppStateStore();
const packageLoader = new PackageLoader();
const arRenderer = new ArRenderer();
const fpsCounter = new FpsCounter();

let arController: ArController | null = null;
let ui: AppUi;
let maxActiveMarkers = 3;
let lostTimeoutMs = 800;
let currentPackage: ModelPackage | null = null;
const activeMarkers = new Set<string>();

bootstrap().catch((error: unknown) => {
  state.setError("表示できませんでした", error);
});

async function bootstrap(): Promise<void> {
  preventViewportGestures();

  const root = document.querySelector<HTMLElement>("#app");
  if (!root) {
    throw new Error("Missing #app root.");
  }

  ui = new AppUi(
    root,
    {
      onCapture: captureStill,
      onToggleAnimation: toggleAnimation,
      onClosePreview: () => ui.closePreview(),
    },
    isDebugMode(),
  );

  state.subscribe((status, error) => {
    ui.setStatus(status, error?.message);
  });

  arRenderer.attach(ui.getArRoot());

  state.setStatus("LOADING_CONFIG");
  const config = await packageLoader.loadAppConfig();
  ui.setConfig(config);
  maxActiveMarkers = config.app.maxActiveMarkers;
  lostTimeoutMs = resolveLostTimeout(config.app.lostTimeoutMs);

  const index = await packageLoader.loadPackageIndex(config.app.packagesIndex);
  const definitions = index.packages.map(
    (entry): MarkerDefinition => ({
      markerId: entry.marker.id,
      packageId: entry.id,
      patternUrl: packageLoader.resolveIndexAsset(entry.marker.path),
    }),
  );

  state.setStatus("WAIT_CAMERA_PERMISSION");
  arController = new ArController(
    arRenderer.scene,
    arRenderer.camera,
    arRenderer.renderer.domElement,
    ui.getArRoot(),
  );
  await arController.initialize();
  arController.registerMarkers(definitions);
  arController.layoutFullViewport();

  state.setStatus("READY");
  requestAnimationFrame(tick);
}

function preventViewportGestures(): void {
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(
      eventName,
      (event: Event) => {
        event.preventDefault();
      },
      { passive: false },
    );
  }
}

function tick(): void {
  arController?.update();
  reconcileMarkers();
  arRenderer.render();

  ui.updateDebug({
    fps: fpsCounter.tick(),
    status: state.getStatus(),
    activeMarkers: [...activeMarkers],
    loadedPackages: packageLoader.getLoadedPackageIds(),
    cachedModels: arRenderer.getCachedModelIds(),
    errorDetail: stringifyDebugError(state.getError()?.detail),
  });

  requestAnimationFrame(tick);
}

function reconcileMarkers(): void {
  if (!arController) {
    return;
  }

  const now = performance.now();
  for (const marker of arController.getMarkers()) {
    const isDetected = marker.root.visible;

    if (marker.ignoredUntilLost) {
      if (!isDetected) {
        marker.ignoredUntilLost = false;
        marker.visible = false;
        marker.lostHandled = true;
      } else {
        marker.root.visible = false;
      }
      continue;
    }

    if (isDetected) {
      marker.lastSeenAt = now;
      marker.lostHandled = false;
      syncDisplayRoot(marker);
    }

    if (isDetected && !marker.visible) {
      void handleMarkerFound(marker);
    }

    if (!isDetected && marker.visible) {
      const elapsed = now - marker.lastSeenAt;
      if (elapsed <= lostTimeoutMs) {
        marker.displayRoot.visible = true;
        continue;
      }
    }

    if (!isDetected && marker.visible && !marker.lostHandled) {
      handleMarkerLost(marker);
    }

    marker.visible = isDetected || (marker.visible && now - marker.lastSeenAt <= lostTimeoutMs);
    if (!marker.visible) {
      marker.displayRoot.visible = false;
    }
  }

  if (activeMarkers.size === 0 && state.getStatus() === "TRACKING") {
    state.setStatus("READY");
  }
}

async function handleMarkerFound(marker: MarkerRuntime): Promise<void> {
  if (marker.ignoredUntilLost) {
    return;
  }

  if (!activeMarkers.has(marker.markerId) && activeMarkers.size >= maxActiveMarkers) {
    marker.ignoredUntilLost = true;
    marker.root.visible = false;
    return;
  }

  activeMarkers.add(marker.markerId);

  try {
    state.setStatus("LOADING_MODEL");
    const modelPackage = await packageLoader.loadPackage(marker.packageId);
    if (!isMarkerStillDisplayable(marker)) {
      activeMarkers.delete(marker.markerId);
      state.setStatus(activeMarkers.size > 0 ? "TRACKING" : "READY");
      return;
    }
    currentPackage = modelPackage;
    ui.setCurrentPackage(modelPackage);
    const instance = await arRenderer.ensureModel(marker, modelPackage, packageLoader);
    if (!isMarkerStillDisplayable(marker)) {
      arRenderer.hideMarkerModel(marker.markerId);
      activeMarkers.delete(marker.markerId);
      state.setStatus(activeMarkers.size > 0 ? "TRACKING" : "READY");
      return;
    }
    ui.setAnimationAvailable(instance.hasAnimation || arRenderer.hasVisibleAnimation());
    ui.setAnimationPlaying(true);
    arRenderer.setAnimationPlaying(true);
    state.setStatus("TRACKING");
  } catch (error) {
    state.setError("モデルを読み込めませんでした", error);
  }
}

function isMarkerStillDisplayable(marker: MarkerRuntime): boolean {
  return marker.root.visible || performance.now() - marker.lastSeenAt <= lostTimeoutMs;
}

function syncDisplayRoot(marker: MarkerRuntime): void {
  marker.root.updateMatrixWorld(true);
  marker.displayRoot.matrix.copy(marker.root.matrixWorld);
  marker.displayRoot.matrixWorld.copy(marker.root.matrixWorld);
  marker.displayRoot.visible = true;
}

function handleMarkerLost(marker: MarkerRuntime): void {
  marker.ignoredUntilLost = false;
  marker.lostHandled = true;
  marker.visible = false;
  marker.displayRoot.visible = false;
  activeMarkers.delete(marker.markerId);
  arRenderer.hideMarkerModel(marker.markerId);

  if (activeMarkers.size === 0) {
    currentPackage = null;
    ui.setCurrentPackage(null);
    ui.setAnimationAvailable(false);
    state.setStatus("READY");
  }
}

function resolveLostTimeout(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 800;
  }
  if (value < 500 || value > 1500) {
    console.warn(`lostTimeoutMs ${value} is outside the recommended 500ms-1500ms range.`);
  }
  return value;
}

function captureStill(): void {
  try {
    ui.setControlsHidden(true);
    requestAnimationFrame(() => {
      arRenderer.render();
      const dataUrl = arRenderer.captureCompositeDataUrl(arController?.getVideoElement() ?? null);
      ui.setControlsHidden(false);
      ui.showPreview(dataUrl);
    });
  } catch (error) {
    ui.setControlsHidden(false);
    state.setError("撮影できませんでした", error);
  }
}

function toggleAnimation(): void {
  const next = !ui.isAnimationPlaying();
  arRenderer.setAnimationPlaying(next);
  ui.setAnimationPlaying(next);
}

function stringifyDebugError(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
