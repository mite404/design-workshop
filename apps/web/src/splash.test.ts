import { describe, expect, it } from "vitest";
import { SPLASH_LOOKS, pickLook, splashStyleOf } from "./splash";

describe("SPLASH_LOOKS", () => {
  it("lists the three looks in the switch's order, abstract first", () => {
    expect(SPLASH_LOOKS.map((look) => look.id)).toEqual(["abstract", "landscape", "vitruvian"]);
  });
});

describe("splashStyleOf", () => {
  it("names each look", () => {
    expect(splashStyleOf("landscape")).toBe("landscape");
    expect(splashStyleOf("abstract")).toBe("abstract");
    expect(splashStyleOf("vitruvian")).toBe("vitruvian");
  });

  it("refuses anything else, such as a stale stored value or a bad address", () => {
    expect(splashStyleOf("bonsai")).toBeNull();
    expect(splashStyleOf("sphere")).toBeNull();
    expect(splashStyleOf("")).toBeNull();
    expect(splashStyleOf(null)).toBeNull();
  });
});

describe("pickLook", () => {
  it("opens a visitor's first welcome on abstract, whatever the roll", () => {
    expect(pickLook(null, true, 0.99)).toBe("abstract");
  });

  it("splits later welcomes evenly across the three looks", () => {
    expect([0, 0.33, 0.34, 0.66, 0.67, 0.999].map((roll) => pickLook(null, false, roll))).toEqual([
      "abstract",
      "abstract",
      "landscape",
      "landscape",
      "vitruvian",
      "vitruvian",
    ]);
  });

  it("lets the address choose, even for a first welcome", () => {
    expect(pickLook("vitruvian", true, 0)).toBe("vitruvian");
    expect(pickLook("landscape", false, 0.9)).toBe("landscape");
  });
});
