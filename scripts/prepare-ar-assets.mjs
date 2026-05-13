import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const arRoot = join(root, "node_modules", "@ar-js-org", "ar.js-threejs");

const copies = [
  {
    from: findAsset("camera_para.dat") ?? join(arRoot, "data", "data", "camera_para.dat"),
    to: join(root, "public", "data", "camera_para.dat"),
    required: true,
  },
];

for (const item of copies) {
  if (!existsSync(item.from)) {
    if (item.required) {
      console.warn(`AR.js asset not found: ${item.from}`);
    }
    continue;
  }
  mkdirSync(dirname(item.to), { recursive: true });
  copyFileSync(item.from, item.to);
}

function findAsset(filename) {
  if (!existsSync(arRoot)) {
    return null;
  }

  const queue = [arRoot];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        queue.push(path);
      } else if (entry === filename) {
        return path;
      }
    }
  }
  return null;
}
