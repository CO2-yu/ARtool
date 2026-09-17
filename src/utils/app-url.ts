export function appUrl(path = ""): string {
  if (!path) {
    return import.meta.env.BASE_URL || "/";
  }

  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  if (path.startsWith("/")) {
    return path;
  }

  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function joinUrl(base: string, path: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  if (path.startsWith("/")) {
    return path;
  }

  if (!base) {
    return path;
  }

  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function dirnameUrl(path: string): string {
  const clean = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const index = clean.lastIndexOf("/");
  return index <= 0 ? (clean.startsWith("/") ? "/" : "") : clean.slice(0, index);
}
