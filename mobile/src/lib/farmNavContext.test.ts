import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findFarmsListNavigator, isFarmsListNavigator } from "./farmNavStack.ts";

describe("isFarmsListNavigator", () => {
  it("matches the Farms tab stack, not the farm-detail stack", () => {
    assert.equal(isFarmsListNavigator(["index", "new", "[id]"]), true);
    assert.equal(isFarmsListNavigator(["index", "service", "history"]), false);
    assert.equal(isFarmsListNavigator(["index", "farms", "mortality"]), false);
  });
});

describe("findFarmsListNavigator", () => {
  it("walks past Service Farm / farm-detail to the Farms stack", () => {
    const farmsStack = {
      getState: () => ({ routeNames: ["index", "new", "[id]"] }),
      navigate: () => {},
    };
    const farmDetailStack = {
      getState: () => ({ routeNames: ["index", "service", "history"] }),
      getParent: () => farmsStack,
    };
    assert.equal(findFarmsListNavigator(farmDetailStack), farmsStack);
    assert.equal(findFarmsListNavigator(farmsStack), farmsStack);
  });

  it("does not treat the tab bar as the Farms stack", () => {
    const tabs = {
      getState: () => ({ routeNames: ["index", "farms", "mortality"] }),
    };
    const farmDetailStack = {
      getState: () => ({ routeNames: ["index", "service"] }),
      getParent: () => tabs,
    };
    assert.equal(findFarmsListNavigator(farmDetailStack), null);
    assert.equal(findFarmsListNavigator(tabs), null);
  });
});
