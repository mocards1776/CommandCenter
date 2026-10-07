import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chicagoYmd, chicagoYmdDaysAgo } from "./boards.ts";

Deno.test("chicagoYmdDaysAgo subtracts civil Chicago days across midnight", () => {
  // 2026-10-07 00:30 CT = 2026-10-07T05:30:00Z
  const afterMidnight = new Date("2026-10-07T05:30:00.000Z");
  assertEquals(chicagoYmd(afterMidnight), "20261007");
  assertEquals(chicagoYmdDaysAgo(afterMidnight, 1), "20261006");
});

Deno.test("chicagoYmdDaysAgo is stable before CT midnight", () => {
  // 2026-10-06 23:58 CT = 2026-10-07T04:58:00Z
  const beforeMidnight = new Date("2026-10-07T04:58:00.000Z");
  assertEquals(chicagoYmd(beforeMidnight), "20261006");
  assertEquals(chicagoYmdDaysAgo(beforeMidnight, 1), "20261005");
});
