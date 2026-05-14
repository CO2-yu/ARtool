import "@google/model-viewer";
import { PackageLoader } from "../packages/package-loader";
import type { ModelPackage } from "../types";

export async function startViewerApp(root: HTMLElement): Promise<void> {
  const packageLoader = new PackageLoader();
  const config = await packageLoader.loadAppConfig();
  const index = await packageLoader.loadPackageIndex(config.app.packagesIndex);
  const packageId = resolvePackageId(index.packages.map((entry) => entry.id));
  const modelPackage = await packageLoader.loadPackage(packageId);
  const modelUrl = packageLoader.resolvePackageAsset(modelPackage, modelPackage.model.path);
  const thumbnailUrl = modelPackage.ui.thumbnail
    ? packageLoader.resolvePackageAsset(modelPackage, modelPackage.ui.thumbnail)
    : "";

  renderViewer(root, modelPackage, modelUrl, thumbnailUrl);
}

function renderViewer(root: HTMLElement, modelPackage: ModelPackage, modelUrl: string, thumbnailUrl: string): void {
  const showScaleSlider = modelPackage.ui.showScaleSlider !== false;
  const initialScale = clamp(modelPackage.scale.default, modelPackage.scale.min, modelPackage.scale.max);

  root.innerHTML = `
    <main class="viewer-shell">
      <header class="viewer-header">
        <div>
          <div class="viewer-kicker">3D Viewer</div>
          <h1>${escapeHtml(modelPackage.name)}</h1>
        </div>
        <a class="viewer-link" href="${toArUrl(modelPackage.id)}">マーカーARで表示</a>
      </header>
      <model-viewer
        class="model-viewer"
        src="${modelUrl}"
        ${thumbnailUrl ? `poster="${thumbnailUrl}"` : ""}
        camera-controls
        touch-action="pan-y"
        autoplay
        shadow-intensity="0.7"
        exposure="1"
        scale="${initialScale} ${initialScale} ${initialScale}"
      ></model-viewer>
      <section class="viewer-panel">
        <p>${escapeHtml(modelPackage.description)}</p>
        <div class="viewer-scale" ${showScaleSlider ? "" : "hidden"}>
          <div class="scale-header">
            <span>倍率</span>
            <span data-role="viewer-scale-value">${initialScale.toFixed(2)}x</span>
          </div>
          <input
            data-role="viewer-scale-slider"
            type="range"
            min="${modelPackage.scale.min}"
            max="${modelPackage.scale.max}"
            step="${modelPackage.scale.step}"
            value="${initialScale}"
            aria-label="モデル倍率"
          />
        </div>
      </section>
    </main>
  `;

  const viewer = root.querySelector("model-viewer");
  const slider = root.querySelector<HTMLInputElement>("[data-role='viewer-scale-slider']");
  const valueLabel = root.querySelector<HTMLElement>("[data-role='viewer-scale-value']");

  slider?.addEventListener("input", () => {
    const value = clamp(Number(slider.value), modelPackage.scale.min, modelPackage.scale.max);
    viewer?.setAttribute("scale", `${value} ${value} ${value}`);
    if (valueLabel) {
      valueLabel.textContent = `${value.toFixed(2)}x`;
    }
  });
}

function resolvePackageId(packageIds: string[]): string {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("package");
  if (requested && packageIds.includes(requested)) {
    return requested;
  }
  const fallback = packageIds[0];
  if (!fallback) {
    throw new Error("No packages are available.");
  }
  return fallback;
}

function toArUrl(packageId: string): string {
  return `../ar/?package=${encodeURIComponent(packageId)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
