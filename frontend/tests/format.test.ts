import { describe, expect, it } from "vitest";
import { formatDate, greeting, pluralize } from "@/lib/format";

describe("formatDate", () => {
  it("shows a placeholder when there is no due date", () => {
    expect(formatDate(null)).toBe("No due date");
  });

  it("does not shift the calendar day across timezones", () => {
    expect(formatDate("2030-01-01")).toContain("1");
    expect(formatDate("2030-01-01")).toContain("2030");
  });
});

describe("greeting", () => {
  it("changes with the time of day", () => {
    expect(greeting(new Date(2030, 0, 1, 8))).toBe("Good morning");
    expect(greeting(new Date(2030, 0, 1, 14))).toBe("Good afternoon");
    expect(greeting(new Date(2030, 0, 1, 21))).toBe("Good evening");
  });
});

describe("pluralize", () => {
  it("handles one and many", () => {
    expect(pluralize(1, "task")).toBe("1 task");
    expect(pluralize(0, "task")).toBe("0 tasks");
    expect(pluralize(8, "task")).toBe("8 tasks");
  });
});
