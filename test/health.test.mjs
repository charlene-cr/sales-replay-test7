import assert from "node:assert/strict";
import test from "node:test";
import { packageHealth } from "../src/index.mjs";

test("reports package health", () => {
  assert.equal(packageHealth().status, "ok");
});
