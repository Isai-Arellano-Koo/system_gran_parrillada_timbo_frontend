import { describe, expect, it } from "vitest";
import { ROLE_OPTIONS } from "../src/constants/roles";

describe("roles", () => {
  it("incluye cajero junto con los roles operativos", () => {
    expect(ROLE_OPTIONS.map((item) => item.value)).toEqual([
      "admin",
      "mesero",
      "cocinero",
      "cajero",
    ]);
  });
});
