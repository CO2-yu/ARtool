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
let currentPackage: ModelPackage | null = null;
const activeMarkers = new Set<string>();

bootstrap().catch((error: unknown) => {
  state.setError("表示できませんでした", error);
});

async function bootstrap(): Promise<void> {
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

  state.setStatus("READY");
  requestAnimationFrame(tick);
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

  for (const marker of arController.getMarkers()) {
    const isVisible = marker.root.visible;
    if (isVisible && !marker.visible) {
      void handleMarkerFound(marker);
    }
    if (!isVisible && marker.visible) {
      handleMarkerLost(marker);
    }
    marker.visible = isVisible;
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
    if (!marker.root.visible) {
      activeMarkers.delete(marker.markerId);
      state.setStatus(activeMarkers.size > 0 ? "TRACKING" : "READY");
      return;
    }
    currentPackage = modelPackage;
    ui.setCurrentPackage(modelPackage);
    const instance = await arRenderer.ensureModel(marker, modelPackage, packageLoader);
    if (!marker.root.visible) {
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

function handleMarkerLost(marker: MarkerRuntime): void {
  marker.ignoredUntilLost = false;
  activeMarkers.delete(marker.markerId);
  arRenderer.hideMarkerModel(marker.markerId);

  if (activeMarkers.size === 0) {
    currentPackage = null;
    ui.setCurrentPackage(null);
    ui.setAnimationAvailable(false);
    state.setStatus("READY");
  }
}

function captureStill(): void {
  try {
    ui.setControlsHidden(true);
    requestAnimationFrame(() => {
      const dataUrl = arRenderer.captureDataUrl();
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
