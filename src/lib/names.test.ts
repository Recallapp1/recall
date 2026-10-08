import { describe, expect, it } from "vitest";

import { personName } from "./names";

describe("personName", () => {
  it("title-cases names that speech recognition wrote in one case, with Turkish letters", () => {
    expect(personName("deneme test")).toBe("Deneme Test");
    expect(personName("  ilknur   ışık ")).toBe("İlknur Işık");
    expect(personName("ÇAĞLA ÖZTÜRK")).toBe("Çağla Öztürk");
    expect(personName("ayşe-nur yılmaz")).toBe("Ayşe-Nur Yılmaz");
  });

  it("leaves a name typed in mixed case as it is (apart from spacing)", () => {
    expect(personName("Ahmet de Souza")).toBe("Ahmet de Souza");
    expect(personName("Mehmet  McKay")).toBe("Mehmet McKay");
  });
});
