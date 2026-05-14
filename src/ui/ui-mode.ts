import type { AppConfig, AppStatus, DebugSnapshot, ModelPackage, UiMode } from "../types";
import { DevelopmentUi } from "./development-ui";
import { ProductionUi } from "./production-ui";

export type { UiMode };

export interface UiCallbacks {
  onCapture: () => void;
  onToggleAnimation: () => void;
  onClosePreview: () => void;
  onScaleChange: (value: number) => void;
  onOpenViewer: () => void;
  onReinitializeAr: () => void;
  onClearCache: () => void;
  onHideSelectedModel: () => void;
}

export interface AppUiController {
  getRoot(): HTMLElement;
  getArRoot(): HTMLElement;
  setConfig(config: AppConfig): void;
  setStatus(status: AppStatus, userMessage?: string): void;
  setCurrentPackage(modelPackage: ModelPackage | null): void;
  showInfoPanel(modelPackage: ModelPackage): void;
  hideInfoPanel(): void;
  configureScale(min: number, max: number, step: number, value: number): void;
  setScaleAvailable(available: boolean): void;
  setScaleValue(value: number): void;
  setAnimationAvailable(available: boolean): void;
  setAnimationPlaying(playing: boolean): void;
  setControlsHidden(hidden: boolean): void;
  showPreview(dataUrl: string): void;
  closePreview(): void;
  updateDebug(snapshot: DebugSnapshot): void;
  isAnimationPlaying(): boolean;
  addLog?(message: string): void;
  getLogs?(): string[];
}

export function resolveUiMode(config: AppConfig): UiMode {
  return config.uiMode === "production" ? "production" : "development";
}

export function createAppUi(
  mode: UiMode,
  root: HTMLElement,
  callbacks: UiCallbacks,
  debugEnabled: boolean,
): AppUiController {
  if (mode === "production") {
    return new ProductionUi(root, callbacks, debugEnabled);
  }
  return new DevelopmentUi(root, callbacks);
}
