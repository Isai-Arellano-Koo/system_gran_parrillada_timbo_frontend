import { describe, expect, it } from "vitest";
import { loginBody } from "../src/api/loginBody";

describe("loginBody", () => {
  it("envía el correo cuando el identificador tiene @", () => {
    expect(loginBody("admin@timbo.com", "admin123")).toEqual({
      email: "admin@timbo.com",
      password: "admin123",
    });
  });

  it("envía el nombre de usuario cuando no hay @", () => {
    expect(loginBody(" admin ", "admin123")).toEqual({
      username: "admin",
      password: "admin123",
    });
  });
});
