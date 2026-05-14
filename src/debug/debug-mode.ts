import type { DebugSnapshot } from "../types";

const DEBUG_KEY = "webar.debug";

export function isDebugMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "1" || localStorage.getItem(DEBUG_KEY) === "1";
}

export class FpsCounter {
  private frames = 0;
  private lastTime = performance.now();
  private fps = 0;

  tick(now = performance.now()): number {
    this.frames += 1;
    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
      this.frames = 0;
      this.lastTime = now;
    }
    return this.fps;
  }
}

export function formatDebugSnapshot(snapshot: DebugSnapshot): string {
  return [
    `fps: ${snapshot.fps}`,
    `state: ${snapshot.status}`,
    `uiMode: ${snapshot.uiMode ?? "-"}`,
    `camera: ${snapshot.cameraPermission ?? "-"}`,
    `arInitialized: ${snapshot.arInitialized ?? false}`,
    `tracking: ${snapshot.trackingState ?? "-"}`,
    `recognizedMarkerId: ${snapshot.recognizedMarkerId ?? "-"}`,
    `selectedPackageId: ${snapshot.selectedPackageId ?? "-"}`,
    `activeMarkerCount: ${snapshot.activeMarkerCount ?? snapshot.activeMarkers.length}`,
    `activeModelCount: ${snapshot.activeModelCount ?? "-"}`,
    `modelLoading: ${snapshot.modelLoading ?? false}`,
    `lastSeenAt: ${snapshot.lastSeenAt ?? "-"}`,
    `lostTimeoutMs: ${snapshot.lostTimeoutMs ?? "-"}`,
    `active: ${snapshot.activeMarkers.join(", ") || "-"}`,
    `packages: ${snapshot.loadedPackages.join(", ") || "-"}`,
    `cache: ${snapshot.cachedModels.join(", ") || "-"}`,
    `error: ${snapshot.errorDetail ?? "-"}`,
  ].join("\n");
}
