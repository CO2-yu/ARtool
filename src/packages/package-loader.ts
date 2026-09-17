import type { AppConfig, ModelPackage, PackageIndex, PackageIndexEntry } from "../types";
import { appUrl, dirnameUrl, joinUrl } from "../utils/app-url";

export class PackageLoader {
  private appConfig: AppConfig | null = null;
  private packageIndex: PackageIndex | null = null;
  private packageIndexBasePath = "";
  private readonly packageCache = new Map<string, ModelPackage>();

  async loadAppConfig(path = "app.config.json"): Promise<AppConfig> {
    const config = await this.fetchJson<AppConfig>(appUrl(path));
    validateAppConfig(config);
    this.appConfig = config;
    return config;
  }

  async loadPackageIndex(path: string): Promise<PackageIndex> {
    const indexUrl = appUrl(path);
    const index = await this.fetchJson<PackageIndex>(indexUrl);
    validatePackageIndex(index);
    this.packageIndex = index;
    this.packageIndexBasePath = dirnameUrl(indexUrl);
    return index;
  }

  getIndexEntries(): PackageIndexEntry[] {
    return this.packageIndex?.packages ?? [];
  }

  getLoadedPackageIds(): string[] {
    return [...this.packageCache.keys()];
  }

  async loadPackage(packageId: string): Promise<ModelPackage> {
    const cached = this.packageCache.get(packageId);
    if (cached) {
      return cached;
    }

    const entry = this.getIndexEntries().find((item) => item.id === packageId);
    if (!entry) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const packagePath = joinUrl(this.packageIndexBasePath, entry.path);
    const modelPackage = await this.fetchJson<Omit<ModelPackage, "basePath">>(packagePath);
    validatePackage(modelPackage, packageId);

    const packageWithBase: ModelPackage = {
      ...modelPackage,
      basePath: dirnameUrl(packagePath),
    };

    this.packageCache.set(packageId, packageWithBase);
    return packageWithBase;
  }

  resolvePackageAsset(modelPackage: ModelPackage, assetPath: string): string {
    return joinUrl(modelPackage.basePath, assetPath);
  }

  resolveIndexAsset(assetPath: string): string {
    return joinUrl(this.packageIndexBasePath, assetPath);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

function validateAppConfig(config: AppConfig): void {
  if (config.schemaVersion !== 1 || !config.app?.packagesIndex || !config.ui) {
    throw new Error("Unsupported app config schema.");
  }
  if (!Number.isFinite(config.app.maxActiveMarkers) || config.app.maxActiveMarkers < 1) {
    throw new Error("app.maxActiveMarkers must be at least 1.");
  }
}

function validatePackageIndex(index: PackageIndex): void {
  if (index.schemaVersion !== 1 || !Array.isArray(index.packages)) {
    throw new Error("Unsupported package index schema.");
  }

  const packageIds = new Set<string>();
  const markerIds = new Set<string>();
  for (const entry of index.packages) {
    if (!entry.id || !entry.path || !entry.marker?.id || !entry.marker?.path) {
      throw new Error("Package index entry is missing required fields.");
    }
    if (packageIds.has(entry.id)) {
      throw new Error(`Duplicate package id: ${entry.id}`);
    }
    if (markerIds.has(entry.marker.id)) {
      throw new Error(`Duplicate marker id: ${entry.marker.id}`);
    }
    packageIds.add(entry.id);
    markerIds.add(entry.marker.id);
  }
}

function validatePackage(modelPackage: Omit<ModelPackage, "basePath">, expectedId: string): void {
  if (modelPackage.schemaVersion !== 1) {
    throw new Error(`Unsupported package schema: ${expectedId}`);
  }
  if (modelPackage.id !== expectedId) {
    throw new Error(`Package id mismatch: ${expectedId}`);
  }
  if (!modelPackage.model?.path || !modelPackage.marker?.path) {
    throw new Error(`Package asset path is missing: ${expectedId}`);
  }

  const { min, max, step, default: defaultScale } = modelPackage.scale;
  if (![min, max, step, defaultScale].every(Number.isFinite) || min <= 0 || max < min || step <= 0) {
    throw new Error(`Invalid scale settings: ${expectedId}`);
  }
  if (defaultScale < min || defaultScale > max) {
    throw new Error(`Default scale is outside the allowed range: ${expectedId}`);
  }

  if (modelPackage.marker.physicalSizeMm !== 100) {
    console.warn(`Marker size is not the standard 100 mm: ${expectedId}`);
  }
}
