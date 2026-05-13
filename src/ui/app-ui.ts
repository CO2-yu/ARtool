import type { AppConfig, AppStatus, DebugSnapshot, ModelPackage } from "../types";
import { formatDebugSnapshot } from "../debug/debug-mode";

interface UiCallbacks {
  onCapture: () => void;
  onToggleAnimation: () => void;
  onClosePreview: () => void;
}

export class AppUi {
  private readonly root: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly statusText: HTMLElement;
  private readonly hintText: HTMLElement;
  private readonly modelName: HTMLElement;
  private readonly captureButton: HTMLButtonElement;
  private readonly animationButton: HTMLButtonElement;
  private readonly preview: HTMLElement;
  private readonly previewImage: HTMLImageElement;
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
          <button type="button" data-role="close-preview">閉じる</button>
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
    this.preview = this.require("[data-role='preview']");
    this.previewImage = this.require("[data-role='preview-image']");
    this.debugPanel = this.require("[data-role='debug']");

    this.captureButton.addEventListener("click", callbacks.onCapture);
    this.animationButton.addEventListener("click", callbacks.onToggleAnimation);
    this.requireButton("[data-role='close-preview']").addEventListener("click", callbacks.onClosePreview);
    this.setAnimationAvailable(false);
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
    this.preview.hidden = false;
  }

  closePreview(): void {
    this.preview.hidden = true;
    this.previewImage.removeAttribute("src");
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
