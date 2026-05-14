import type { AppConfig, AppStatus, DebugSnapshot, ModelPackage } from "../types";
import { formatDebugSnapshot } from "../debug/debug-mode";

interface UiCallbacks {
  onCapture: () => void;
  onToggleAnimation: () => void;
  onClosePreview: () => void;
  onScaleChange: (value: number) => void;
  onOpenViewer: () => void;
}

export class AppUi {
  private readonly root: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly statusText: HTMLElement;
  private readonly hintText: HTMLElement;
  private readonly modelName: HTMLElement;
  private readonly captureButton: HTMLButtonElement;
  private readonly animationButton: HTMLButtonElement;
  private readonly scalePanel: HTMLElement;
  private readonly scaleSlider: HTMLInputElement;
  private readonly scaleValue: HTMLElement;
  private readonly infoPanel: HTMLElement;
  private readonly infoName: HTMLElement;
  private readonly infoDescription: HTMLElement;
  private readonly preview: HTMLElement;
  private readonly previewImage: HTMLImageElement;
  private readonly previewDownload: HTMLAnchorElement;
  private readonly debugPanel: HTMLElement;
  private config: AppConfig | null = null;
  private animationPlaying = false;

  constructor(root: HTMLElement, callbacks: UiCallbacks, debugEnabled: boolean) {
    root.innerHTML = `
      <main class="shell">
        <div id="ar-root" class="ar-root"></div>
        <section class="topbar" aria-live="polite">
          <div class="brand">
            <div class="logo">AR</div>
            <div>
              <div class="title">AR Product Viewer</div>
              <div class="model-name" data-role="model-name">-</div>
            </div>
          </div>
        </section>
        <section class="overlay" data-role="overlay">
          <div class="status" data-role="status">起動中</div>
          <div class="hint" data-role="hint">カメラを準備しています</div>
        </section>
        <section class="scale-panel" data-role="scale-panel" hidden>
          <div class="scale-header">
            <span>倍率</span>
            <span data-role="scale-value">1.00x</span>
          </div>
          <input data-role="scale-slider" type="range" min="0.02" max="1" step="0.01" value="0.083333" aria-label="モデル倍率" />
        </section>
        <section class="ar-info-panel" data-role="ar-info-panel" hidden>
          <div>
            <div class="ar-info-title" data-role="ar-info-name">-</div>
            <div class="ar-info-description" data-role="ar-info-description"></div>
          </div>
          <div class="ar-info-actions">
            <button type="button" data-role="open-viewer">3Dビューで見る</button>
          </div>
        </section>
        <nav class="controls" aria-label="AR controls">
          <button class="icon-button" data-role="capture" type="button" title="撮影" aria-label="撮影">
            <span aria-hidden="true">◎</span>
          </button>
          <button class="icon-button" data-role="animation" type="button" title="アニメーション" aria-label="アニメーション">
            <span aria-hidden="true">▶</span>
          </button>
        </nav>
        <section class="preview" data-role="preview" hidden>
          <img data-role="preview-image" alt="撮影プレビュー" />
          <div class="preview-actions">
            <a data-role="download-preview" download="webar-capture.png">保存</a>
            <button type="button" data-role="close-preview">閉じる</button>
          </div>
        </section>
        <pre class="debug-panel" data-role="debug" ${debugEnabled ? "" : "hidden"}></pre>
      </main>
    `;

    this.root = root;
    this.overlay = this.require("[data-role='overlay']");
    this.statusText = this.require("[data-role='status']");
    this.hintText = this.require("[data-role='hint']");
    this.modelName = this.require("[data-role='model-name']");
    this.captureButton = this.requireButton("[data-role='capture']");
    this.animationButton = this.requireButton("[data-role='animation']");
    this.scalePanel = this.require("[data-role='scale-panel']");
    this.scaleSlider = this.require<HTMLInputElement>("[data-role='scale-slider']");
    this.scaleValue = this.require("[data-role='scale-value']");
    this.infoPanel = this.require("[data-role='ar-info-panel']");
    this.infoName = this.require("[data-role='ar-info-name']");
    this.infoDescription = this.require("[data-role='ar-info-description']");
    this.preview = this.require("[data-role='preview']");
    this.previewImage = this.require("[data-role='preview-image']");
    this.previewDownload = this.require("[data-role='download-preview']");
    this.debugPanel = this.require("[data-role='debug']");

    this.captureButton.addEventListener("click", callbacks.onCapture);
    this.animationButton.addEventListener("click", callbacks.onToggleAnimation);
    this.scaleSlider.addEventListener("input", () => callbacks.onScaleChange(Number(this.scaleSlider.value)));
    this.requireButton("[data-role='open-viewer']").addEventListener("click", callbacks.onOpenViewer);
    this.requireButton("[data-role='close-preview']").addEventListener("click", callbacks.onClosePreview);
    this.setAnimationAvailable(false);
    this.setScaleAvailable(false);
  }

  getRoot(): HTMLElement {
    return this.root;
  }

  getArRoot(): HTMLElement {
    return this.require("#ar-root");
  }

  setConfig(config: AppConfig): void {
    this.config = config;
    this.root.querySelector(".logo")!.textContent = config.app.logoText;
    this.root.querySelector(".title")!.textContent = config.app.title;
  }

  setStatus(status: AppStatus, userMessage?: string): void {
    const labels: Record<AppStatus, string> = {
      BOOTING: "起動中",
      LOADING_CONFIG: "設定を読み込み中",
      WAIT_CAMERA_PERMISSION: this.config?.ui.cameraMessage ?? "カメラを許可してください",
      READY: "準備完了",
      TRACKING: "認識中",
      LOADING_MODEL: this.config?.ui.loadingMessage ?? "読み込み中",
      ERROR: userMessage ?? this.config?.ui.errorMessage ?? "表示できませんでした",
    };

    this.statusText.textContent = labels[status];
    this.hintText.textContent = hintForStatus(status, this.config);
    this.overlay.toggleAttribute("hidden", status === "TRACKING");
  }

  setCurrentPackage(modelPackage: ModelPackage | null): void {
    this.modelName.textContent = modelPackage?.name ?? "-";
  }

  showInfoPanel(modelPackage: ModelPackage): void {
    this.infoName.textContent = modelPackage.name;
    this.infoDescription.textContent = modelPackage.description;
    this.infoPanel.hidden = false;
  }

  hideInfoPanel(): void {
    this.infoPanel.hidden = true;
  }

  configureScale(min: number, max: number, step: number, value: number): void {
    this.scaleSlider.min = String(min);
    this.scaleSlider.max = String(max);
    this.scaleSlider.step = String(step);
    this.setScaleValue(value);
    this.setScaleAvailable(true);
  }

  setScaleAvailable(available: boolean): void {
    this.scalePanel.hidden = !available;
    this.scaleSlider.disabled = !available;
  }

  setScaleValue(value: number): void {
    this.scaleSlider.value = String(value);
    this.scaleValue.textContent = `${value.toFixed(2)}x`;
  }

  setAnimationAvailable(available: boolean): void {
    this.animationButton.hidden = !available;
    this.animationButton.disabled = !available;
  }

  setAnimationPlaying(playing: boolean): void {
    this.animationPlaying = playing;
    this.animationButton.textContent = playing ? "Ⅱ" : "▶";
    this.animationButton.setAttribute("aria-label", playing ? "停止" : "再生");
  }

  setControlsHidden(hidden: boolean): void {
    this.root.classList.toggle("capturing", hidden);
  }

  showPreview(dataUrl: string): void {
    this.previewImage.src = dataUrl;
    this.previewDownload.href = dataUrl;
    this.preview.hidden = false;
  }

  closePreview(): void {
    this.preview.hidden = true;
    this.previewImage.removeAttribute("src");
    this.previewDownload.removeAttribute("href");
  }

  updateDebug(snapshot: DebugSnapshot): void {
    if (!this.debugPanel.hidden) {
      this.debugPanel.textContent = formatDebugSnapshot(snapshot);
    }
  }

  isAnimationPlaying(): boolean {
    return this.animationPlaying;
  }

  private require<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }

  private requireButton(selector: string): HTMLButtonElement {
    return this.require<HTMLButtonElement>(selector);
  }
}

function hintForStatus(status: AppStatus, config: AppConfig | null): string {
  switch (status) {
    case "READY":
      return config?.ui.markerMessage ?? "マーカーをカメラに映してください";
    case "TRACKING":
      return "";
    case "LOADING_MODEL":
      return "モデルを準備しています";
    case "ERROR":
      return "係員にお声がけください";
    default:
      return "しばらくお待ちください";
  }
}
