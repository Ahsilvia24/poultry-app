import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "mobile/src/repos/data.ts");
const data = readFileSync(dataPath, "utf8");

assert.match(data, /type LfoListRow/);
assert.match(data, /function lfoHousesForCalc/);
assert.match(data, /export function listLfos/);
assert.match(data, /houses: lfoHousesForCalc\(detail\)/);
assert.doesNotMatch(
  data,
  /houses:\s*detail\.houses\.map\(\(h\)\s*=>\s*\(\{/,
  "Metro web export dies on detail.houses.map((h) => ({ inside listLfos",
);

const share = readFileSync(join(root, "mobile/src/lib/lfo/share-payload.ts"), "utf8");
assert.match(share, /houses\.map\(\(house\) => \{/);
assert.doesNotMatch(
  share,
  /houses:\s*houses\.map\(\(house\)\s*=>\s*\(\{/,
  "Metro web export dies on houses.map((house) => ({ in LFO share payload",
);

const source = ts.createSourceFile(dataPath, data, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const syntax = source.parseDiagnostics ?? [];
assert.equal(syntax.length, 0, syntax.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));

console.log("expo-web-data-parse: ok");
