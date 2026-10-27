import {
  COUNTRIES,
  countryMatchCandidates,
  findCountry,
  newPasswordSchema,
  normalizeCountryInput,
  PASSWORD_RULES,
  sanitizeMultiline,
  sanitizeSingleLine,
  searchCountries,
  createSupportTicketSchema,
} from "./index";

describe("countries", () => {
  it("has one entry per ISO code", () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("accepts every name the app shows, including ones the API used to reject", () => {
    for (const country of COUNTRIES) {
      expect(normalizeCountryInput(country.name)).toBe(country.code);
    }
    expect(normalizeCountryInput("Congo (DRC)")).toBe("CD");
    expect(normalizeCountryInput("North Korea")).toBe("KP");
    expect(normalizeCountryInput("Kosovo")).toBe("XK");
  });

  it("keeps older aliases and codes in any case", () => {
    expect(normalizeCountryInput("Czech Republic")).toBe("CZ");
    expect(normalizeCountryInput("Cote d'Ivoire")).toBe("CI");
    expect(normalizeCountryInput(" ro ")).toBe("RO");
    expect(normalizeCountryInput("Atlantis")).toBeNull();
    expect(findCountry("")).toBeUndefined();
  });

  it("matches a stored country in every form it may take", () => {
    expect(countryMatchCandidates("CZ")).toEqual(
      expect.arrayContaining(["cz", "czechia", "czech republic"]),
    );
  });

  it("searches by name or code prefix", () => {
    expect(searchCountries("").length).toBe(COUNTRIES.length);
    expect(searchCountries("roma").map((country) => country.code)).toContain("RO");
    expect(searchCountries("de").map((country) => country.code)).toContain("DE");
  });
});

describe("password rules", () => {
  it("lists the same rules the API enforces", () => {
    const weak = "abc";
    const failed = PASSWORD_RULES.filter((rule) => !rule.test(weak)).map((rule) => rule.message);
    const result = newPasswordSchema.safeParse(weak);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(failed);
  });

  it("accepts a strong password", () => {
    expect(newPasswordSchema.safeParse("SecurePass1!").success).toBe(true);
  });
});

describe("text cleanup", () => {
  it("strips invisible characters and squeezes spaces", () => {
    expect(sanitizeSingleLine("  Hi​   there ‮ ")).toBe("Hi there");
  });

  it("keeps at most one blank line", () => {
    expect(sanitizeMultiline("a\r\n\r\n\r\n\r\nb  c")).toBe("a\n\nb c");
  });
});

describe("support ticket schema", () => {
  it("cleans the subject before checking its length", () => {
    const parsed = createSupportTicketSchema.parse({
      kind: "CONTACT",
      subject: "  Hello    there ",
      message: "Something does not work.",
    });
    expect(parsed.subject).toBe("Hello there");
  });

  it("rejects unknown fields", () => {
    expect(
      createSupportTicketSchema.safeParse({
        kind: "CONTACT",
        subject: "Hello",
        message: "Something does not work.",
        userId: "someone-else",
      }).success,
    ).toBe(false);
  });
});
