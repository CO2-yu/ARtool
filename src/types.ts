import type { AnimationClip, Group, Object3D } from "three";

export type AppStatus =
  | "BOOTING"
  | "LOADING_CONFIG"
  | "WAIT_CAMERA_PERMISSION"
  | "READY"
  | "TRACKING"
  | "LOADING_MODEL"
  | "ERROR";

export interface AppConfig {
  schemaVersion: number;
  app: {
    title: string;
    logoText: string;
    maxActiveMarkers: number;
    lostTimeoutMs?: number;
    targetFps: number;
    packagesIndex: string;
  };
  ui: {
    cameraMessage: string;
    markerMessage: string;
    loadingMessage: string;
    errorMessage: string;
  };
}

export interface PackageIndex {
  schemaVersion: number;
  packages: PackageIndexEntry[];
}

export interface PackageIndexEntry {
  id: string;
  name: string;
  path: string;
  marker: {
    id: string;
    path: string;
    image?: string;
    type: "pattern";
    physicalSizeMm: number;
  };
}

export interface ModelPackage {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  model: {
    path: string;
    format: "glb" | "gltf";
  };
  marker: {
    id: string;
    path: string;
    image?: string;
    type: "pattern";
    physicalSizeMm: number;
  };
  transform: {
    position: Vector3Tuple;
    rotation: Vector3Tuple;
    scale: Vector3Tuple;
  };
  scale: {
    default: number;
    min: number;
    max: number;
    step: number;
    presets: Record<string, ScalePreset>;
  };
  animation: {
    autoPlay: boolean;
    defaultClip: string | null;
  };
  ui: {
    showScaleControls: boolean;
    thumbnail: string;
  };
  basePath: string;
}

export interface ScalePreset {
  label: string;
  value: number;
}

export type Vector3Tuple = [number, number, number];

export interface MarkerDefinition {
  markerId: string;
  packageId: string;
  patternUrl: string;
}

export interface MarkerRuntime {
  markerId: string;
  packageId: string;
  root: Group;
  detected: boolean;
  visible: boolean;
  lastSeenAt: number;
  lostHandled: boolean;
  ignoredUntilLost: boolean;
}

export interface LoadedModelAsset {
  packageId: string;
  source: Object3D;
  animations: AnimationClip[];
}

export interface MarkerModelInstance {
  markerId: string;
  packageId: string;
  root: Object3D;
  hasAnimation: boolean;
}

export interface DebugSnapshot {
  fps: number;
  status: AppStatus;
  activeMarkers: string[];
  loadedPackages: string[];
  cachedModels: string[];
  errorDetail: string | null;
}

export interface UserError {
  message: string;
  detail?: unknown;
}
