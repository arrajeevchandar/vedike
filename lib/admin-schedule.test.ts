import { describe, expect, it } from "vitest";
import {
  addIstMinutes,
  reconcileCompetitionSchedule,
  utcToIstInput,
  validateCompetitionSchedule,
  validateEventSchedule,
} from "@/lib/admin-schedule";

const event = { startsAt: "2026-09-10T09:00", endsAt: "2026-09-12T20:00" };

describe("admin schedule validation", () => {
  it("requires an event to have positive duration", () => {
    expect(validateEventSchedule({ startsAt: "2026-09-10T09:00", endsAt: "2026-09-10T09:00" })).toHaveProperty("endsAt");
    expect(validateEventSchedule({ startsAt: "2026-09-10T09:00", endsAt: "2026-09-10T09:01" })).toEqual({});
  });

  it("keeps edited events around active child competitions", () => {
    expect(validateEventSchedule({
      startsAt: "2026-09-10T10:00",
      endsAt: "2026-09-12T18:00",
      earliestChildStart: "2026-09-10T09:30",
      latestChildEnd: "2026-09-12T19:00",
    })).toEqual(expect.objectContaining({ startsAt: expect.any(String), endsAt: expect.any(String) }));
  });

  it("accepts an immediate application-to-voting handoff", () => {
    expect(validateCompetitionSchedule({
      applicationStartsAt: "2026-09-10T09:00",
      applicationEndsAt: "2026-09-11T10:00",
      votingStartsAt: "2026-09-11T10:00",
      votingEndsAt: "2026-09-12T20:00",
    }, event)).toEqual({});
  });

  it("rejects windows outside the parent and non-positive phases", () => {
    const errors = validateCompetitionSchedule({
      applicationStartsAt: "2026-09-10T08:59",
      applicationEndsAt: "2026-09-11T10:00",
      votingStartsAt: "2026-09-11T09:59",
      votingEndsAt: "2026-09-11T09:59",
    }, event);
    expect(errors.applicationStartsAt).toMatch(/inside/);
    expect(errors.votingStartsAt).toMatch(/before/);
    expect(errors.votingEndsAt).toMatch(/at least one minute/);
  });

  it("clears only values invalidated by a parent switch", () => {
    const result = reconcileCompetitionSchedule({
      applicationStartsAt: "2026-09-10T10:00",
      applicationEndsAt: "2026-09-10T12:00",
      votingStartsAt: "2026-09-10T12:00",
      votingEndsAt: "2026-09-12T19:00",
    }, { startsAt: "2026-09-10T09:00", endsAt: "2026-09-11T20:00" });
    expect(result.schedule).toEqual({
      applicationStartsAt: "2026-09-10T10:00",
      applicationEndsAt: "2026-09-10T12:00",
      votingStartsAt: "2026-09-10T12:00",
      votingEndsAt: "",
    });
    expect(result.cleared).toEqual(["votingEndsAt"]);
  });

  it("converts persisted UTC values back to exact IST minutes", () => {
    expect(utcToIstInput("2026-09-10T03:30:00.000Z")).toBe("2026-09-10T09:00");
    expect(addIstMinutes("2026-09-10T23:59", 1)).toBe("2026-09-11T00:00");
  });
});
