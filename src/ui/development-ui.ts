import type { AppConfig, AppStatus, DebugSnapshot, ModelPackage } from "../types";
import type { AppUiController, UiCallbacks } from "./ui-mode";

const MAX_LOGS = 80;

export class DevelopmentUi implements AppUiController {
  private readonly root: HTMLElement;
  private readonly arRoot: HTMLElement;
  private readonly statusLabel: HTMLElement;
  private readonly hintLabel: HTMLElement;
  private readonly modelName: HTMLElement;
  private readonly captureButton: HTMLButtonElement;
  private readonly animationButton: HTMLButtonElement;
  private readonly openViewerButton: HTMLButtonElement;
  private readonly preview: HTMLElement;
  private readonly previewImage: HTMLImageElement;
  private readonly previewSave: HTMLAnchorElement;
  private readonly scalePanel: HTMLElement;
  private readonly scaleSlider: HTMLInputElement;
  private readonly scaleValue: HTMLElement;
  private readonly infoPanel: HTMLElement;
  private readonly infoTitle: HTMLElement;
  private readonly infoDescription: HTMLElement;
  private readonly stateGrid: HTMLElement;
  private readonly errorLog: HTMLElement;
  private readonly consoleLog: HTMLElement;
  private readonly logs: string[] = [];
  private animationPlaying = true;
  private markerMessage = "マーカーをカメラに映してください";
  private loadingMessage = "読み込み中";
  private errorMessage = "表示できませんでした";

  constructor(root: HTMLElement, private readonly callbacks: UiCallbacks) {
    this.root = root;
    root.innerHTML = `
      <main class="shell development-shell">
        <div class="ar-root" data-role="ar-root"></div>
        <section class="dev-panel dev-panel-left">
          <div class="dev-header">
            <div>
              <div class="dev-kicker">Development UI</div>
              <div class="dev-title" data-role="title">AR Product Viewer</div>
            </div>
            <div class="dev-badge" data-role="mode">development</div>
          </div>
          <div class="dev-model" data-role="model-name">マーカー未認識</div>
          <div class="dev-status">
            <div class="status" data-role="status">起動中</div>
            <div class="hint" data-role="hint">カメラを許可してください</div>
          </div>
          <div class="dev-grid" data-role="state-grid"></div>
          <div class="dev-actions">
            <button type="button" data-role="open-viewer" disabled>3Dビューで見る</button>
            <button type="button" data-role="reinitialize">AR再初期化</button>
            <button type="button" data-role="clear-cache">キャッシュクリア</button>
            <button type="button" data-role="hide-selected">選択中モデルを非表示</button>
          </div>
        </section>
        <section class="ar-info-panel dev-info-panel" data-role="info-panel" hidden>
          <div>
            <div class="ar-info-title" data-role="info-title"></div>
            <div class="ar-info-description" data-role="info-description"></div>
          </div>
        </section>
        <section class="scale-panel dev-scale-panel" data-role="scale-panel" hidden>
          <div class="scale-header">
            <span>倍率</span>
            <span data-role="scale-value">1.00x</span>
          </div>
          <input data-role="scale-slider" type="range" min="0.02" max="1" step="0.01" value="1" />
        </section>
        <nav class="controls dev-controls" data-role="controls">
          <button class="icon-button" type="button" data-role="capture" title="撮影">●</button>
          <button class="icon-button" type="button" data-role="animation" title="アニメーション" disabled>▶</button>
        </nav>
        <section class="dev-panel dev-panel-right">
          <div class="dev-section-title">エラーログ</div>
          <pre class="dev-log dev-error-log" data-role="error-log">-</pre>
          <div class="dev-section-title">簡易ログ</div>
          <pre class="dev-log" data-role="console-log">-</pre>
        </section>
        <section class="preview" data-role="preview" hidden>
          <img data-role="preview-image" alt="撮影プレビュー" />
          <div class="preview-actions">
            <a data-role="preview-save" download="webar-capture.png">保存</a>
            <button type="button" data-role="preview-close">閉じる</button>
          </div>
        </section>
      </main>
    `;

    this.arRoot = required(root, "[data-role='ar-root']");
    this.statusLabel = required(root, "[data-role='status']");
    this.hintLabel = required(root, "[data-role='hint']");
    this.modelName = required(root, "[data-role='model-name']");
    this.captureButton = required(root, "[data-role='capture']");
    this.animationButton = required(root, "[data-role='animation']");
    this.openViewerButton = required(root, "[data-role='open-viewer']");
    this.preview = required(root, "[data-role='preview']");
    this.previewImage = required(root, "[data-role='preview-image']");
    this.previewSave = required(root, "[data-role='preview-save']");
    this.scalePanel = required(root, "[data-role='scale-panel']");
    this.scaleSlider = required(root, "[data-role='scale-slider']");
    this.scaleValue = required(root, "[data-role='scale-value']");
    this.infoPanel = required(root, "[data-role='info-panel']");
    this.infoTitle = required(root, "[data-role='info-title']");
    this.infoDescription = required(root, "[data-role='info-description']");
    this.stateGrid = required(root, "[data-role='state-grid']");
    this.errorLog = required(root, "[data-role='error-log']");
    this.consoleLog = required(root, "[data-role='console-log']");

    this.captureButton.addEventListener("click", () => this.callbacks.onCapture());
    this.animationButton.addEventListener("click", () => this.callbacks.onToggleAnimation());
    this.openViewerButton.addEventListener("click", () => this.callbacks.onOpenViewer());
    required<HTMLButtonElement>(root, "[data-role='reinitialize']").addEventListener("click", () =>
      this.callbacks.onReinitializeAr(),
    );
    required<HTMLButtonElement>(root, "[data-role='clear-cache']").addEventListener("click", () =>
      this.callbacks.onClearCache(),
    );
    required<HTMLButtonElement>(root, "[data-role='hide-selected']").addEventListener("click", () =>
      this.callbacks.onHideSelectedModel(),
    );
    required<HTMLButtonElement>(root, "[data-role='preview-close']").addEventListener("click", () =>
      this.callbacks.onClosePreview(),
    );
    this.scaleSlider.addEventListener("input", () => this.callbacks.onScaleChange(Number(this.scaleSlider.value)));
    this.addLog("Development UI initialized.");
  }

  getRoot(): HTMLElement {
    return this.root;
  }

  getArRoot(): HTMLElement {
    return this.arRoot;
  }

  setConfig(config: AppConfig): void {
    required(this.root, "[data-role='title']").textContent = config.app.title;
    this.markerMessage = config.ui.markerMessage;
    this.loadingMessage = config.ui.loadingMessage;
    this.errorMessage = config.ui.errorMessage;
    this.addLog(`Config loaded. uiMode=${config.uiMode ?? "development"}`);
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
    this.addLog(`status: ${status}${userMessage ? ` (${userMessage})` : ""}`);
  }

  setCurrentPackage(modelPackage: ModelPackage | null): void {
    this.modelName.textContent = modelPackage ? modelPackage.name : "マーカー未認識";
  }

  showInfoPanel(modelPackage: ModelPackage): void {
    this.infoTitle.textContent = modelPackage.name;
    this.infoDescription.textContent = modelPackage.description;
    this.infoPanel.hidden = false;
    this.openViewerButton.disabled = false;
    this.addLog(`selectedPackageId: ${modelPackage.id}`);
  }

  hideInfoPanel(): void {
    this.infoPanel.hidden = true;
    this.openViewerButton.disabled = true;
    this.addLog("info panel hidden.");
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
    this.addLog("capture preview shown.");
  }

  closePreview(): void {
    this.preview.hidden = true;
  }

  updateDebug(snapshot: DebugSnapshot): void {
    this.stateGrid.innerHTML = rows([
      ["現在のモード", snapshot.uiMode ?? "development"],
      ["camera permission", snapshot.cameraPermission ?? "unknown"],
      ["AR初期化状態", snapshot.arInitialized ? "initialized" : "not initialized"],
      ["tracking状態", snapshot.trackingState ?? "-"],
      ["認識中 markerId", snapshot.recognizedMarkerId ?? "-"],
      ["selectedPackageId", snapshot.selectedPackageId ?? "-"],
      ["active marker 数", String(snapshot.activeMarkerCount ?? snapshot.activeMarkers.length)],
      ["active model 数", String(snapshot.activeModelCount ?? 0)],
      ["model loading 状態", snapshot.modelLoading ? "loading" : "idle"],
      ["lastSeenAt", formatTime(snapshot.lastSeenAt)],
      ["lostTimeoutMs", `${snapshot.lostTimeoutMs ?? "-"}ms`],
      ["FPS", String(snapshot.fps)],
      ["loaded packages", snapshot.loadedPackages.join(", ") || "-"],
      ["cache", snapshot.cachedModels.join(", ") || "-"],
    ]);
    this.errorLog.textContent = snapshot.errorDetail ?? "-";
    if (snapshot.logs) {
      this.consoleLog.textContent = snapshot.logs.join("\n") || "-";
    }
  }

  isAnimationPlaying(): boolean {
    return this.animationPlaying;
  }

  addLog(message: string): void {
    const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    this.logs.unshift(`[${time}] ${message}`);
    this.logs.splice(MAX_LOGS);
    this.consoleLog.textContent = this.logs.join("\n");
  }

  getLogs(): string[] {
    return [...this.logs].reverse();
  }
}

function rows(items: Array<[string, string]>): string {
  return items
    .map(
      ([label, value]) => `
        <div class="dev-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function formatTime(value: number | null | undefined): string {
  if (!value) {
    return "-";
  }
  return `${Math.round(value)}ms`;
}

function required<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}
