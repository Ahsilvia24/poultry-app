import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGeneratorReportView,
  collectPriorHours,
  generatorReportToTsv,
  type GeneratorReportFarm,
} from "./generator-log.ts";

function farm(partial: Partial<GeneratorReportFarm> & Pick<GeneratorReportFarm, "logs">): GeneratorReportFarm {
  return {
    farmId: "farm_1",
    farmName: "Maple Grove",
    numberOfGenerators: 2,
    ...partial,
  };
}

describe("buildGeneratorReportView", () => {
  it("lists each generator on the same weekly dates with exercised deltas", () => {
    const view = buildGeneratorReportView([
      farm({
        logs: [
          {
            id: "new",
            farmId: "farm_1",
            farmName: "Maple Grove",
            logDate: "2026-08-29",
            gen1Hours: 96.6,
            gen2Hours: 114.7,
            gen3Hours: null,
            gen4Hours: null,
          },
          {
            id: "old",
            farmId: "farm_1",
            farmName: "Maple Grove",
            logDate: "2026-08-22",
            gen1Hours: 95.8,
            gen2Hours: 113.8,
            gen3Hours: null,
            gen4Hours: null,
          },
        ],
      }),
    ]);

    assert.equal(view[0]?.farmName, "Maple Grove");
    assert.deepEqual(
      view[0]?.generators.map((g) => g.label),
      ["Gen 1", "Gen 2"],
    );
    assert.deepEqual(
      view[0]?.generators[0]?.rows.map((r) => r.logDate),
      ["2026-08-29", "2026-08-22"],
    );
    assert.deepEqual(
      view[0]?.generators[1]?.rows.map((r) => r.logDate),
      ["2026-08-29", "2026-08-22"],
    );
    assert.equal(view[0]?.generators[0]?.rows[0]?.hours, 96.6);
    assert.equal(view[0]?.generators[0]?.rows[0]?.exercised, 0.8);
    assert.equal(view[0]?.generators[0]?.rows[1]?.exercised, null);
    assert.equal(view[0]?.generators[1]?.rows[0]?.exercised, 0.9);
  });

  it("uses the prior reading so the oldest week in range still has exercise time", () => {
    const view = buildGeneratorReportView([
      farm({
        numberOfGenerators: 1,
        priorHours: { gen1Hours: 94.7, gen2Hours: null, gen3Hours: null, gen4Hours: null },
        logs: [
          {
            id: "only",
            farmId: "farm_1",
            farmName: "Maple Grove",
            logDate: "2026-08-22",
            gen1Hours: 95.8,
            gen2Hours: null,
            gen3Hours: null,
            gen4Hours: null,
          },
        ],
      }),
    ]);
    assert.equal(view[0]?.generators[0]?.rows[0]?.exercised, 1.1);
  });

  it("omits a date on a generator that has no hours that day", () => {
    const view = buildGeneratorReportView([
      farm({
        numberOfGenerators: 2,
        logs: [
          {
            id: "both",
            farmId: "farm_1",
            farmName: "Maple Grove",
            logDate: "2026-08-29",
            gen1Hours: 96.6,
            gen2Hours: 114.7,
            gen3Hours: null,
            gen4Hours: null,
          },
          {
            id: "gen1-only",
            farmId: "farm_1",
            farmName: "Maple Grove",
            logDate: "2026-08-22",
            gen1Hours: 95.8,
            gen2Hours: null,
            gen3Hours: null,
            gen4Hours: null,
          },
        ],
      }),
    ]);
    const gen1 = view[0]?.generators[0];
    const gen2 = view[0]?.generators[1];
    assert.deepEqual(
      gen1?.rows.map((r) => r.logDate),
      ["2026-08-29", "2026-08-22"],
    );
    assert.deepEqual(
      gen2?.rows.map((r) => r.logDate),
      ["2026-08-29"],
    );
    assert.equal(gen2?.rows[0]?.hours, 114.7);
  });

  it("does not add empty generators from the farm count", () => {
    const view = buildGeneratorReportView([
      farm({
        numberOfGenerators: 4,
        logs: [
          {
            id: "only-gen1",
            farmId: "farm_1",
            farmName: "Maple Grove",
            logDate: "2026-08-29",
            gen1Hours: 96.6,
            gen2Hours: null,
            gen3Hours: null,
            gen4Hours: null,
          },
        ],
      }),
    ]);
    assert.deepEqual(
      view[0]?.generators.map((g) => g.label),
      ["Gen 1"],
    );
  });

  it("omits a farm whose log rows have no hours left", () => {
    const view = buildGeneratorReportView([
      farm({
        numberOfGenerators: 3,
        logs: [
          {
            id: "empty",
            farmId: "farm_1",
            farmName: "Maple Grove",
            logDate: "2026-08-29",
            gen1Hours: null,
            gen2Hours: null,
            gen3Hours: null,
            gen4Hours: null,
          },
        ],
      }),
    ]);
    assert.deepEqual(view, []);
  });
});

describe("collectPriorHours", () => {
  it("takes the newest older reading per generator", () => {
    const prior = collectPriorHours([
      { gen1Hours: 10, gen2Hours: null, gen3Hours: null, gen4Hours: null },
      { gen1Hours: 9, gen2Hours: 20, gen3Hours: null, gen4Hours: null },
    ]);
    assert.equal(prior.gen1Hours, 10);
    assert.equal(prior.gen2Hours, 20);
  });
});

describe("generatorReportToTsv", () => {
  it("writes farm then each generator weekly log", () => {
    const tsv = generatorReportToTsv(
      buildGeneratorReportView([
        farm({
          numberOfGenerators: 1,
          logs: [
            {
              id: "a",
              farmId: "farm_1",
              farmName: "Maple Grove",
              logDate: "2026-08-29",
              gen1Hours: 96.6,
              gen2Hours: null,
              gen3Hours: null,
              gen4Hours: null,
            },
          ],
        }),
      ]),
    );
    assert.match(tsv, /^Maple Grove\nGen 1\nDate\tHours\tExercised\n8-29-2026\t96.6\t—$/);
  });
});
