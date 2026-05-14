import { formatDebugSnapshot } from "../debug/debug-mode";
import type { AppConfig, AppStatus, DebugSnapshot, ModelPackage } from "../types";
import type { AppUiController, UiCallbacks } from "./ui-mode";

export class ProductionUi implements AppUiController {
  private readonly root: HTMLElement;
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
  private markerMessage = "マーカーをカメラに映してください";
  private loadingMessage = "読み込み中";
  private errorMessage = "表示できませんでした";

  constructor(root: HTMLElement, private readonly callbacks: UiCallbacks, debugEnabled: boolean) {
    this.root = root;
    root.innerHTML = `
      <main class="shell production-shell">
        <div class="ar-root" data-role="ar-root"></div>
        <header class="topbar">
          <div class="brand">
            <div class="logo" data-role="logo">AR</div>
            <div>
              <div class="title" data-role="title">AR Product Viewer</div>
              <div class="model-name" data-role="model-name">マーカーを探しています</div>
            </div>
          </div>
        </header>
        <section class="overlay" data-role="overlay">
          <div>
            <div class="status" data-role="status">起動中</div>
            <div class="hint" data-role="hint">カメラを許可してください</div>
          </div>
        </section>
        <section class="ar-info-panel" data-role="info-panel" hidden>
          <div>
            <div class="ar-info-title" data-role="info-title"></div>
            <div class="ar-info-description" data-role="info-description"></div>
          </div>
          <div class="ar-info-actions">
            <button type="button" data-role="open-viewer">3Dビューで見る</button>
          </div>
        </section>
        <section class="scale-panel" data-role="scale-panel" hidden>
          <div class="scale-header">
            <span>倍率</span>
            <span data-role="scale-value">1.00x</span>
          </div>
          <input data-role="scale-slider" type="range" min="0.02" max="1" step="0.01" value="1" />
        </section>
        <nav class="controls" data-role="controls">
          <button class="icon-button" type="button" data-role="capture" title="撮影">●</button>
          <button class="icon-button" type="button" data-role="animation" title="アニメーション" disabled>▶</button>
        </nav>
        <section class="preview" data-role="preview" hidden>
          <img data-role="preview-image" alt="撮影プレビュー" />
          <div class="preview-actions">
            <a data-role="preview-save" download="webar-capture.png">保存</a>
            <button type="button" data-role="preview-close">閉じる</button>
          </div>
        </section>
        ${debugEnabled ? `<pre class="debug-panel" data-role="debug"></pre>` : ""}
      </main>
    `;

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
    this.markerMessage = config.ui.markerMessage;
    this.loadingMessage = config.ui.loadingMessage;
    this.errorMessage = config.ui.errorMessage;
  }

  setStatus(status: AppStatus, userMessage?: string): void {
    const labels: Record<AppStatus, string> = {
      BOOTING: "起動中",
      LOADING_CONFIG: this.loadingMessage,
      WAIT_CAMERA_PERMISSION: "カメラ許可待ち",
      READY: "準備完了",
      TRACKING: "AR表示中",
      LOADING_MODEL: this.loadingMessage,
      ERROR: this.errorMessage,
    };
    this.statusLabel.textContent = labels[status];
    this.hintLabel.textContent = status === "ERROR" ? userMessage || this.errorMessage : this.markerMessage;
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
    this.animationButton.textContent = playing ? "Ⅱ" : "▶";
  }

  setControlsHidden(hidden: boolean): void {
    this.root.querySelector(".shell")?.classList.toggle("capturing", hidden);
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
