import {
  dateOfBirthBounds,
  dateOfBirthError,
  formatDateOfBirth,
  parseIsoDate,
  toIsoDate,
} from "./dateOfBirth";

const today = new Date(2026, 9, 20); // 20 Oct 2026, local time

describe("date of birth", () => {
  it("formats the picked local day as YYYY-MM-DD without a UTC shift", () => {
    expect(toIsoDate(new Date(1998, 2, 4, 23, 59))).toBe("1998-03-04");
    expect(toIsoDate(new Date(2000, 11, 31, 0, 0))).toBe("2000-12-31");
  });

  it("round-trips through parseIsoDate", () => {
    expect(toIsoDate(parseIsoDate("1998-03-04")!)).toBe("1998-03-04");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseIsoDate("2001-02-29")).toBeNull();
    expect(parseIsoDate("1998-13-01")).toBeNull();
    expect(parseIsoDate("04/03/1998")).toBeNull();
  });

  it("only allows ages 18 to 120, so the future is never selectable", () => {
    const { minimumDate, maximumDate } = dateOfBirthBounds(today);
    expect(toIsoDate(maximumDate)).toBe("2008-10-20");
    expect(toIsoDate(minimumDate)).toBe("1906-10-20");
    expect(maximumDate.getTime()).toBeLessThan(today.getTime());
  });

  it("explains invalid values", () => {
    expect(dateOfBirthError("", today)).toBeNull();
    expect(dateOfBirthError("1998-03-04", today)).toBeNull();
    expect(dateOfBirthError("2008-10-20", today)).toBeNull();
    expect(dateOfBirthError("2027-01-01", today)).toBe("Date of birth cannot be in the future");
    expect(dateOfBirthError("2008-10-21", today)).toBe("You must be at least 18 years old");
    expect(dateOfBirthError("1890-01-01", today)).toBe("Please check the year");
    expect(dateOfBirthError("not a date", today)).toBe(
      "Choose your date of birth from the calendar",
    );
  });

  it("shows a readable date", () => {
    expect(formatDateOfBirth("1998-03-04")).toBe("4 March 1998");
    expect(formatDateOfBirth("")).toBe("");
  });
});
