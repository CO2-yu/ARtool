import type { AppConfig, ModelPackage, PackageIndex, PackageIndexEntry } from "../types";

export class PackageLoader {
  private appConfig: AppConfig | null = null;
  private packageIndex: PackageIndex | null = null;
  private packageIndexBasePath = "";
  private readonly packageCache = new Map<string, ModelPackage>();

  async loadAppConfig(path = "app.config.json"): Promise<AppConfig> {
    const config = await this.fetchJson<AppConfig>(path);
    if (config.schemaVersion !== 1 || !config.app?.packagesIndex) {
      throw new Error("Unsupported app config schema.");
    }
    this.appConfig = config;
    return config;
  }

  async loadPackageIndex(path: string): Promise<PackageIndex> {
    const index = await this.fetchJson<PackageIndex>(path);
    if (index.schemaVersion !== 1 || !Array.isArray(index.packages)) {
      throw new Error("Unsupported package index schema.");
    }
    for (const entry of index.packages) {
      if (!entry.id || !entry.path || !entry.marker?.id || !entry.marker?.path) {
        throw new Error("Package index entry is missing required fields.");
      }
    }
    this.packageIndex = index;
    this.packageIndexBasePath = dirname(path);
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
      basePath: dirname(packagePath),
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
  if (modelPackage.marker.physicalSizeMm !== 100) {
    console.warn(`Marker size is not the standard 100 mm: ${expectedId}`);
  }
}

export function joinUrl(...parts: string[]): string {
  return parts
    .flatMap((part) => part.split("/"))
    .filter(Boolean)
    .join("/");
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}
