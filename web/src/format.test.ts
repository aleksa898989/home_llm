import { describe, expect, it } from "vitest";
import { formatBytes } from "./format.ts";

describe("formatBytes", () => {
  it.each([
    [5_225_388_164, "5.2 GB"],
    [291_554_930, "292 MB"],
    [2_048, "2 KB"],
  ])("%d → %s", (bytes, text) => expect(formatBytes(bytes)).toBe(text));
});
