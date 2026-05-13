import type { AppStatus, UserError } from "../types";

type StateListener = (status: AppStatus, error: UserError | null) => void;

export class AppStateStore {
  private status: AppStatus = "BOOTING";
  private error: UserError | null = null;
  private readonly listeners = new Set<StateListener>();

  getStatus(): AppStatus {
    return this.status;
  }

  getError(): UserError | null {
    return this.error;
  }

  setStatus(status: AppStatus): void {
    this.status = status;
    if (status !== "ERROR") {
      this.error = null;
    }
    this.emit();
  }

  setError(message: string, detail?: unknown): void {
    this.status = "ERROR";
    this.error = { message, detail };
    console.error(message, detail);
    this.emit();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.error);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.status, this.error);
    }
  }
}
