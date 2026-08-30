import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../assets/service-forms");

describe("prebrood generator hours boxes", () => {
  it("has Yes/No widgets on the printed Generator Hours line", () => {
    const map = JSON.parse(readFileSync(join(assetsDir, "prebrood-fields.json"), "utf8")) as {
      fields: Record<string, { widgets: { x: number; y: number }[] }>;
    };
    const yes = map.fields["Check Box201"]?.widgets[0];
    const no = map.fields["Check Box207"]?.widgets[0];
    const servicedYes = map.fields["Check Box200"]?.widgets[0];
    assert.ok(yes);
    assert.ok(no);
    assert.ok(servicedYes);
    assert.ok(Math.abs(yes.y - no.y) < 1);
    assert.ok(yes.y < servicedYes.y);
    assert.ok(yes.x < no.x);
  });
});
