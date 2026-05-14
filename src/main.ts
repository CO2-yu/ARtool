import "./styles.css";
import { ArController } from "./ar/ar-controller";
import { FpsCounter, isDebugMode } from "./debug/debug-mode";
import { PackageLoader } from "./packages/package-loader";
import { ArRenderer } from "./renderer/ar-renderer";
import { AppStateStore } from "./state/app-state";
import type { MarkerDefinition, MarkerRuntime, ModelPackage, UiMode } from "./types";
import { createAppUi, resolveUiMode, type AppUiController } from "./ui/app-ui";
import { startViewerApp } from "./viewer/viewer-app";

const state = new AppStateStore();
const packageLoader = new PackageLoader();
const arRenderer = new ArRenderer();
const fpsCounter = new FpsCounter();

let arController: ArController | null = null;
let ui: AppUiController | null = null;
let uiMode: UiMode = "development";
let maxActiveMarkers = 3;
let lostTimeoutMs = 800;
let cameraPermissionState = "not requested";
let currentPackage: ModelPackage | null = null;
let selectedMarker: MarkerRuntime | null = null;
let selectedPackage: ModelPackage | null = null;
let scaleMin = 0.02;
let scaleMax = 1;
let scaleStep = 0.01;
let currentScale = 1;
let pinchScaleEnabled = true;
let pinchStartDistance: number | null = null;
let pinchStartScale = 1;
const activeMarkers = new Set<string>();

bootstrap().catch((error: unknown) => {
  state.setError("表示できませんでした", error);
});

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) {
    throw new Error("Missing #app root.");
  }

  if (isViewerRoute()) {
    await startViewerApp(root);
    return;
  }

  await startArApp(root);
}

function isViewerRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path.endsWith("/viewer");
}

async function startArApp(root: HTMLElement): Promise<void> {
  preventViewportGestures();

  state.setStatus("LOADING_CONFIG");
  const config = await packageLoader.loadAppConfig();
  uiMode = resolveUiMode(config);
  ui = createAppUi(
    uiMode,
    root,
    {
      onCapture: captureStill,
      onToggleAnimation: toggleAnimation,
      onClosePreview: () => requireUi().closePreview(),
      onScaleChange: applyModelScale,
      onOpenViewer: openSelectedInViewer,
      onReinitializeAr: reinitializeAr,
      onClearCache: clearModelCache,
      onHideSelectedModel: hideSelectedModel,
    },
    isDebugMode(),
  );
  requireUi().setConfig(config);
  attachPinchScaleHandlers(root);

  state.subscribe((status, error) => {
    requireUi().setStatus(status, error?.message);
  });

  arRenderer.attach(requireUi().getArRoot());

  maxActiveMarkers = config.app.maxActiveMarkers;
  lostTimeoutMs = resolveLostTimeout(config.app.lostTimeoutMs);
  pinchScaleEnabled = config.ui.enablePinchScale !== false;

  const index = await packageLoader.loadPackageIndex(config.app.packagesIndex);
  const definitions = index.packages.map(
    (entry): MarkerDefinition => ({
      markerId: entry.marker.id,
      packageId: entry.id,
      patternUrl: packageLoader.resolveIndexAsset(entry.marker.path),
    }),
  );

  state.setStatus("WAIT_CAMERA_PERMISSION");
  cameraPermissionState = "requesting";
  arController = new ArController(
    arRenderer.scene,
    arRenderer.camera,
    arRenderer.renderer.domElement,
    requireUi().getArRoot(),
    config.app.ar,
  );
  try {
    await arController.initialize();
    cameraPermissionState = "granted";
  } catch (error) {
    cameraPermissionState = "denied or failed";
    throw error;
  }
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

  const markers = arController?.getMarkers() ?? [];
  const recognizedMarkers = markers.filter((marker) => marker.root.visible).map((marker) => marker.markerId);
  requireUi().updateDebug({
    fps: fpsCounter.tick(),
    status: state.getStatus(),
    uiMode,
    cameraPermission: cameraPermissionState,
    arInitialized: arController !== null,
    trackingState: activeMarkers.size > 0 ? "tracking" : "waiting",
    recognizedMarkerId: recognizedMarkers.length > 0 ? recognizedMarkers[recognizedMarkers.length - 1] : null,
    selectedPackageId: selectedPackage?.id ?? null,
    activeMarkerCount: activeMarkers.size,
    activeModelCount: arRenderer.getActiveModelCount(),
    modelLoading: state.getStatus() === "LOADING_MODEL",
    lastSeenAt: selectedMarker?.lastSeenAt ?? null,
    lostTimeoutMs,
    activeMarkers: [...activeMarkers],
    loadedPackages: packageLoader.getLoadedPackageIds(),
    cachedModels: arRenderer.getCachedModelIds(),
    errorDetail: stringifyDebugError(state.getError()?.detail),
    logs: requireUi().getLogs?.(),
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
      void handleMarkerRecognized(marker);
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

async function handleMarkerRecognized(marker: MarkerRuntime): Promise<void> {
  if (marker.ignoredUntilLost) {
    return;
  }

  try {
    const isFirstActiveMarker = activeMarkers.size === 0;
    const modelPackage = await packageLoader.loadPackage(marker.packageId);
    if (!isMarkerStillDisplayable(marker)) {
      state.setStatus(activeMarkers.size > 0 ? "TRACKING" : "READY");
      return;
    }

    if (!activeMarkers.has(marker.markerId) && activeMarkers.size >= maxActiveMarkers) {
      marker.ignoredUntilLost = true;
      marker.root.visible = false;
      return;
    }

    selectedMarker = marker;
    selectedPackage = modelPackage;
    currentPackage = modelPackage;
    activeMarkers.add(marker.markerId);
    requireUi().setCurrentPackage(modelPackage);
    requireUi().showInfoPanel(modelPackage);
    configureScaleFromPackage(modelPackage, isFirstActiveMarker);
    const instance = await arRenderer.ensureModel(marker, modelPackage, packageLoader);
    if (!isMarkerStillDisplayable(marker)) {
      arRenderer.hideMarkerModel(marker.markerId);
      activeMarkers.delete(marker.markerId);
      state.setStatus(activeMarkers.size > 0 ? "TRACKING" : "READY");
      return;
    }
    requireUi().setAnimationAvailable(instance.hasAnimation || arRenderer.hasVisibleAnimation());
    requireUi().setAnimationPlaying(true);
    arRenderer.setAnimationPlaying(true);
    state.setStatus("TRACKING");
  } catch (error) {
    state.setError("モデルを読み込めませんでした", error);
  }
}

function openSelectedInViewer(): void {
  if (!selectedPackage) {
    return;
  }
  window.location.href = `../viewer/?package=${encodeURIComponent(selectedPackage.id)}`;
}

function configureScaleFromPackage(modelPackage: ModelPackage, resetToDefault: boolean): void {
  scaleMin = modelPackage.scale.min;
  scaleMax = modelPackage.scale.max;
  scaleStep = modelPackage.scale.step;
  const nextScale = resetToDefault ? modelPackage.scale.default : currentScale;
  applyModelScale(nextScale);
  requireUi().configureScale(scaleMin, scaleMax, scaleStep, currentScale);
}

function applyModelScale(value: number): void {
  currentScale = clamp(value, scaleMin, scaleMax);
  arRenderer.setModelScale(currentScale);
  requireUi().setScaleValue(currentScale);
}

function attachPinchScaleHandlers(target: HTMLElement): void {
  target.addEventListener(
    "touchstart",
    (event) => {
      if (!pinchScaleEnabled || event.touches.length !== 2) {
        return;
      }
      event.preventDefault();
      pinchStartDistance = touchDistance(event.touches[0], event.touches[1]);
      pinchStartScale = currentScale;
    },
    { passive: false },
  );

  target.addEventListener(
    "touchmove",
    (event) => {
      if (!pinchScaleEnabled || event.touches.length !== 2 || !pinchStartDistance) {
        return;
      }
      event.preventDefault();
      const distance = touchDistance(event.touches[0], event.touches[1]);
      applyModelScale(pinchStartScale * (distance / pinchStartDistance));
    },
    { passive: false },
  );

  const resetPinch = () => {
    pinchStartDistance = null;
  };
  target.addEventListener("touchend", resetPinch, { passive: false });
  target.addEventListener("touchcancel", resetPinch, { passive: false });
}

function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
    selectedMarker = null;
    selectedPackage = null;
    requireUi().setCurrentPackage(null);
    requireUi().hideInfoPanel();
    requireUi().setAnimationAvailable(false);
    requireUi().setScaleAvailable(false);
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
    requireUi().setControlsHidden(true);
    requestAnimationFrame(() => {
      arRenderer.render();
      const dataUrl = arRenderer.captureCompositeDataUrl(arController?.getVideoElement() ?? null);
      requireUi().setControlsHidden(false);
      requireUi().showPreview(dataUrl);
    });
  } catch (error) {
    requireUi().setControlsHidden(false);
    state.setError("撮影できませんでした", error);
  }
}

function toggleAnimation(): void {
  const next = !requireUi().isAnimationPlaying();
  arRenderer.setAnimationPlaying(next);
  requireUi().setAnimationPlaying(next);
}

function reinitializeAr(): void {
  requireUi().addLog?.("AR再初期化を実行します。");
  window.location.reload();
}

function clearModelCache(): void {
  arRenderer.clearModelCache();
  requireUi().addLog?.("モデルキャッシュをクリアしました。");
}

function hideSelectedModel(): void {
  if (!selectedMarker) {
    requireUi().addLog?.("非表示にする選択中モデルがありません。");
    return;
  }

  const markerId = selectedMarker.markerId;
  arRenderer.hideMarkerModel(markerId);
  activeMarkers.delete(markerId);
  selectedMarker.displayRoot.visible = false;
  selectedMarker.visible = false;
  requireUi().addLog?.(`選択中モデルを非表示にしました: ${markerId}`);

  if (activeMarkers.size === 0) {
    currentPackage = null;
    selectedMarker = null;
    selectedPackage = null;
    requireUi().setCurrentPackage(null);
    requireUi().hideInfoPanel();
    requireUi().setAnimationAvailable(false);
    requireUi().setScaleAvailable(false);
    state.setStatus("READY");
  }
}

function requireUi(): AppUiController {
  if (!ui) {
    throw new Error("UI is not initialized.");
  }
  return ui;
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
