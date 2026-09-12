import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tiles = readFileSync(join(root, "src/components/FarmsListTiles.tsx"), "utf8");
const link = readFileSync(join(root, "src/components/ReplicaLink.tsx"), "utf8");

assert.match(tiles, /useReplicaNavigate/);
assert.match(tiles, /<button\n\s+type="button"/);
assert.match(tiles, /\[-webkit-touch-callout:none\]/);
assert.match(tiles, /onContextMenu/);
assert.doesNotMatch(tiles, /<ReplicaLink/);
assert.doesNotMatch(tiles, /href=\{`\/farms\/\$\{farm\.id\}`\}/);

assert.match(link, /export function useReplicaNavigate/);
assert.match(link, /without rendering an `<a href>`/);

console.log("farm-tile-long-press: ok");
