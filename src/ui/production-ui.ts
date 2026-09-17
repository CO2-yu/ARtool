import { formatDebugSnapshot } from "../debug/debug-mode";
import type { AppConfig, AppStatus, DebugSnapshot, ModelPackage } from "../types";
import type { AppUiController, UiCallbacks } from "./ui-mode";
import "./production-ui.css";

export class ProductionUi implements AppUiController {
  private readonly root: HTMLElement;
  private readonly shell: HTMLElement;
  private readonly arRoot: HTMLElement;
  private readonly statusLabel: HTMLElement;
  private readonly hintLabel: HTMLElement;
  private readonly modelName: HTMLElement;
  private readonly captureButton: HTMLButtonElement;
  private readonly animationButton: HTMLButtonElement;
  private readonly preview: HTMLElement;
  private readonly previewImage: HTMLImageElement;
  private readonly previewSave: HTMLAnchorElement;
  private readonly debugPanel: HTMLElement | null;
  private readonly scalePanel: HTMLElement;
  private readonly scaleSlider: HTMLInputElement;
  private readonly scaleValue: HTMLElement;
  private readonly infoPanel: HTMLElement;
  private readonly infoTitle: HTMLElement;
  private readonly infoDescription: HTMLElement;
  private readonly openViewerButton: HTMLButtonElement;
  private animationPlaying = true;
  private cameraMessage = "カメラを許可してください";
  private markerMessage = "マーカーをカメラに映してください";
  private loadingMessage = "読み込み中";
  private errorMessage = "表示できませんでした";

  constructor(root: HTMLElement, private readonly callbacks: UiCallbacks, debugEnabled: boolean) {
    this.root = root;
    root.innerHTML = `
      <main class="shell production-shell" data-status="BOOTING">
        <div class="ar-root" data-role="ar-root"></div>

        <header class="ar-chrome-top">
          <div class="ar-brand-pill">
            <span class="ar-logo" data-role="logo">AR</span>
            <span class="ar-brand-copy">
              <strong data-role="title">AR Product Viewer</strong>
              <span data-role="model-name">マーカーを探しています</span>
            </span>
          </div>
        </header>

        <section class="ar-scan-overlay" data-role="overlay" aria-live="polite">
          <div class="ar-reticle" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="ar-status-card">
            <div class="ar-status" data-role="status">起動中</div>
            <div class="ar-hint" data-role="hint">カメラを許可してください</div>
          </div>
        </section>

        <section class="ar-product-card" data-role="info-panel" hidden>
          <div class="ar-product-copy">
            <div class="ar-product-title" data-role="info-title"></div>
            <div class="ar-product-description" data-role="info-description"></div>
          </div>
          <button class="ar-viewer-button" type="button" data-role="open-viewer">
            <span>3Dで詳しく見る</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l7 7-7 7"/></svg>
          </button>
        </section>

        <section class="ar-scale-card" data-role="scale-panel" hidden>
          <div class="ar-scale-header">
            <span>モデル倍率</span>
            <strong data-role="scale-value">1.00x</strong>
          </div>
          <input data-role="scale-slider" type="range" min="0.02" max="1" step="0.01" value="1" aria-label="モデル倍率" />
        </section>

        <nav class="ar-tool-dock" data-role="controls" aria-label="AR操作">
          <button class="ar-tool-button" type="button" data-role="capture" title="撮影" aria-label="撮影">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5l1.2-2h4.6l1.2 2H19a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2V8.5a2 2 0 012-2h3.5z"/><circle cx="12" cy="13" r="3.5"/></svg>
            <span>撮影</span>
          </button>
          <button class="ar-tool-button" type="button" data-role="animation" data-playing="true" title="アニメーションを停止" aria-label="アニメーションを停止" disabled>
            <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
            <span>動き</span>
          </button>
        </nav>

        <section class="preview" data-role="preview" hidden>
          <img data-role="preview-image" alt="撮影プレビュー" />
          <div class="preview-actions">
            <a data-role="preview-save" download="webar-capture.png">画像を保存</a>
            <button type="button" data-role="preview-close">閉じる</button>
          </div>
        </section>
        ${debugEnabled ? `<pre class="debug-panel" data-role="debug"></pre>` : ""}
      </main>
    `;

    this.shell = required(root, ".production-shell");
    this.arRoot = required(root, "[data-role='ar-root']");
    this.statusLabel = required(root, "[data-role='status']");
    this.hintLabel = required(root, "[data-role='hint']");
    this.modelName = required(root, "[data-role='model-name']");
    this.captureButton = required(root, "[data-role='capture']");
    this.animationButton = required(root, "[data-role='animation']");
    this.preview = required(root, "[data-role='preview']");
    this.previewImage = required(root, "[data-role='preview-image']");
    this.previewSave = required(root, "[data-role='preview-save']");
    this.debugPanel = root.querySelector("[data-role='debug']");
    this.scalePanel = required(root, "[data-role='scale-panel']");
    this.scaleSlider = required(root, "[data-role='scale-slider']");
    this.scaleValue = required(root, "[data-role='scale-value']");
    this.infoPanel = required(root, "[data-role='info-panel']");
    this.infoTitle = required(root, "[data-role='info-title']");
    this.infoDescription = required(root, "[data-role='info-description']");
    this.openViewerButton = required(root, "[data-role='open-viewer']");

    this.captureButton.addEventListener("click", () => this.callbacks.onCapture());
    this.animationButton.addEventListener("click", () => this.callbacks.onToggleAnimation());
    this.openViewerButton.addEventListener("click", () => this.callbacks.onOpenViewer());
    required<HTMLButtonElement>(root, "[data-role='preview-close']").addEventListener("click", () =>
      this.callbacks.onClosePreview(),
    );
    this.scaleSlider.addEventListener("input", () => this.callbacks.onScaleChange(Number(this.scaleSlider.value)));
  }

  getRoot(): HTMLElement {
    return this.root;
  }

  getArRoot(): HTMLElement {
    return this.arRoot;
  }

  setConfig(config: AppConfig): void {
    required(this.root, "[data-role='title']").textContent = config.app.title;
    required(this.root, "[data-role='logo']").textContent = config.app.logoText;
    this.cameraMessage = config.ui.cameraMessage;
    this.markerMessage = config.ui.markerMessage;
    this.loadingMessage = config.ui.loadingMessage;
    this.errorMessage = config.ui.errorMessage;
  }

  setStatus(status: AppStatus, userMessage?: string): void {
    const labels: Record<AppStatus, string> = {
      BOOTING: "ARを起動しています",
      LOADING_CONFIG: this.loadingMessage,
      WAIT_CAMERA_PERMISSION: "カメラを使用します",
      READY: "マーカーを探しています",
      TRACKING: "マーカー認識中",
      LOADING_MODEL: "3Dモデルを読み込んでいます",
      ERROR: this.errorMessage,
    };
    const hints: Record<AppStatus, string> = {
      BOOTING: "少しお待ちください",
      LOADING_CONFIG: "表示設定を準備しています",
      WAIT_CAMERA_PERMISSION: this.cameraMessage,
      READY: this.markerMessage,
      TRACKING: "マーカーをゆっくり動かすとモデルも追従します",
      LOADING_MODEL: "このままマーカーを映してください",
      ERROR: userMessage || this.errorMessage,
    };

    this.shell.dataset.status = status;
    this.statusLabel.textContent = labels[status];
    this.hintLabel.textContent = hints[status];
  }

  setCurrentPackage(modelPackage: ModelPackage | null): void {
    this.modelName.textContent = modelPackage?.name ?? "マーカーを探しています";
  }

  showInfoPanel(modelPackage: ModelPackage): void {
    this.infoTitle.textContent = modelPackage.name;
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
  }

  setScaleValue(value: number): void {
    this.scaleSlider.value = String(value);
    this.scaleValue.textContent = `${value.toFixed(2)}x`;
  }

  setAnimationAvailable(available: boolean): void {
    this.animationButton.disabled = !available;
  }

  setAnimationPlaying(playing: boolean): void {
    this.animationPlaying = playing;
    this.animationButton.dataset.playing = String(playing);
    const label = playing ? "アニメーションを停止" : "アニメーションを再生";
    this.animationButton.title = label;
    this.animationButton.setAttribute("aria-label", label);
  }

  setControlsHidden(hidden: boolean): void {
    this.shell.classList.toggle("capturing", hidden);
  }

  showPreview(dataUrl: string): void {
    this.previewImage.src = dataUrl;
    this.previewSave.href = dataUrl;
    this.preview.hidden = false;
  }

  closePreview(): void {
    this.preview.hidden = true;
  }

  updateDebug(snapshot: DebugSnapshot): void {
    if (this.debugPanel) {
      this.debugPanel.textContent = formatDebugSnapshot(snapshot);
    }
  }

  isAnimationPlaying(): boolean {
    return this.animationPlaying;
  }
}

function required<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }
  return element;
}
