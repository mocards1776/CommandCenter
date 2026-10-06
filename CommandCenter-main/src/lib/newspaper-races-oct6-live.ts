/**
 * The 2026-10-06 morning book as filed in public.times_race_briefs.
 * Preview ?live=1 uses this so iPad proofs match the printed rows without a
 * signed-in fetch. The live newspaper still reads the table.
 */
import { asRaceBriefsDesk, type RaceBriefsDesk } from "./newspaper-races.ts";

const OCT6_ROWS = [
  {
    brief_date: "2026-10-06",
    race: "SD8",
    headline: "KC SD8: Alliance and SDCC fills loaded; Patterson still on through 10/11",
    bullets: [
      "Missouri Alliance PAC broadcast now ~$388k / ~978 GRP (~$397 CPP) after missing WDAF weeks were loaded from FCC.",
      "SDCC is the largest active KC buyer this week (WDAF/KSHB/KCTV); full SDCC track ~$662k+ with GRPs rebuilt from KCTV FCC orders.",
      "Patterson candidate TV continues through 10/11; Ingle candidate flight still starts 10/14.",
    ],
    spend: [
      { sponsor: "Senate Democratic Campaign Committee", side: "oppose", station: "WDAF", market: "Kansas City", amount: 124350, grps: 195.2, cpp: 637, flight_start: "2026-09-29", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Missouri Alliance PAC", side: "support", station: "WDAF", market: "Kansas City", amount: 58800, grps: 111.5, cpp: 527, flight_start: "2026-10-05", flight_end: "2026-10-18", is_new: true },
      { sponsor: "Senate Democratic Campaign Committee", side: "oppose", station: "KSHB", market: "Kansas City", amount: 48900, grps: 195.6, cpp: 250, flight_start: "2026-09-29", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Patterson for Missouri", side: "support", station: "WDAF", market: "Kansas City", amount: 39880, grps: 96.2, cpp: 415, flight_start: "2026-10-05", flight_end: "2026-10-11", is_new: false },
      { sponsor: "Missouri Alliance PAC", side: "support", station: "KMBC", market: "Kansas City", amount: 37500, grps: 99.4, cpp: 377, flight_start: "2026-10-05", flight_end: "2026-10-18", is_new: false },
      { sponsor: "Senate Democratic Campaign Committee", side: "oppose", station: "KCTV", market: "Kansas City", amount: 33400, grps: 58.1, cpp: 575, flight_start: "2026-09-29", flight_end: "2026-10-12", is_new: true },
      { sponsor: "Missouri Alliance PAC", side: "support", station: "KCTV", market: "Kansas City", amount: 31000, grps: 57.5, cpp: 539, flight_start: "2026-10-05", flight_end: "2026-10-18", is_new: false },
      { sponsor: "Missouri Alliance PAC", side: "support", station: "KSHB", market: "Kansas City", amount: 23400, grps: 107.8, cpp: 217, flight_start: "2026-10-05", flight_end: "2026-10-18", is_new: false },
      { sponsor: "Patterson for Missouri", side: "support", station: "KSHB", market: "Kansas City", amount: 14035, grps: 117.4, cpp: 120, flight_start: "2026-10-05", flight_end: "2026-10-11", is_new: false },
      { sponsor: "Patterson for Missouri", side: "support", station: "KMBC", market: "Kansas City", amount: 14000, grps: 70.2, cpp: 199, flight_start: "2026-10-05", flight_end: "2026-10-11", is_new: false },
      { sponsor: "Patterson for Missouri", side: "support", station: "KCWE", market: "Kansas City", amount: 2000, grps: 21.4, cpp: 93, flight_start: "2026-10-05", flight_end: "2026-10-11", is_new: false },
    ],
    notes: [
      { source: "FCC/comps", text: "Alliance WDAF and SDCC KCTV gaps filled 10/5; SDCC KMBC/WDAF/KSHB still unfiled on FCC.", url: null },
    ],
    links: [{ label: "SD8 competitive (Almanac)", url: "https://www.thompsoncommunications.tech/competitive/mo-sd8?token=mo-sd8-2026" }],
    source: "competitive",
    updated_at: "2026-10-06T10:37:41.120378+00:00",
  },
  {
    brief_date: "2026-10-06",
    race: "SD30",
    headline: "Springfield air war: Forward PAC leads this weeks TV; Fogle adds radio",
    bullets: [
      "Forward PAC is the heaviest Springfield TV buyer this week (~$162k across KYTV/KOLR/KSPR/KRBK), with Missouri Senate Campaign Committee still on air through 10/11.",
      "Fogle for Missouri layered a new $6,160 radio flight (KTTS/KWTO/KTXR/KKLH, 10/5-10/12) on top of ongoing broadcast.",
      "Stinnett remains on the major Springfield stations this week; Legio XIII radio wraps 10/7.",
    ],
    spend: [
      { sponsor: "Forward PAC", side: "oppose", station: "KYTV", market: "Springfield", amount: 109185, grps: 662, cpp: 165, flight_start: "2026-10-03", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Fogle for Missouri", side: "oppose", station: "KYTV", market: "Springfield", amount: 70420, grps: 939, cpp: 75, flight_start: "2026-09-29", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Friends of Melanie Stinnett", side: "support", station: "KYTV", market: "Springfield", amount: 52745, grps: 704, cpp: 75, flight_start: "2026-10-05", flight_end: "2026-10-18", is_new: false },
      { sponsor: "Missouri Senate Campaign Committee", side: "support", station: "KYTV", market: "Springfield", amount: 47440, grps: 288, cpp: 165, flight_start: "2026-10-05", flight_end: "2026-10-11", is_new: false },
      { sponsor: "Fogle for Missouri", side: "oppose", station: "KOLR", market: "Springfield", amount: 17635, grps: 235, cpp: 75, flight_start: "2026-09-29", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Forward PAC", side: "oppose", station: "KSPR", market: "Springfield", amount: 17510, grps: 106, cpp: 165, flight_start: "2026-10-03", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Forward PAC", side: "oppose", station: "KOLR", market: "Springfield", amount: 16280, grps: 99, cpp: 164, flight_start: "2026-10-03", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Friends of Melanie Stinnett", side: "support", station: "KOLR", market: "Springfield", amount: 12860, grps: 172, cpp: 75, flight_start: "2026-09-28", flight_end: "2026-10-25", is_new: false },
      { sponsor: "Forward PAC", side: "oppose", station: "KRBK", market: "Springfield", amount: 12270, grps: 74, cpp: 166, flight_start: "2026-10-03", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Friends of Melanie Stinnett", side: "support", station: "KRBK", market: "Springfield", amount: 11535, grps: 153, cpp: 75, flight_start: "2026-09-28", flight_end: "2026-10-25", is_new: false },
      { sponsor: "Friends of Melanie Stinnett", side: "support", station: "KSPR", market: "Springfield", amount: 10810, grps: 144, cpp: 75, flight_start: "2026-10-05", flight_end: "2026-10-18", is_new: false },
      { sponsor: "Fogle for Missouri", side: "oppose", station: "KSPR", market: "Springfield", amount: 9580, grps: 128, cpp: 75, flight_start: "2026-09-29", flight_end: "2026-10-12", is_new: false },
      { sponsor: "Missouri Senate Campaign Committee", side: "support", station: "KSPR", market: "Springfield", amount: 8545, grps: 52, cpp: 164, flight_start: "2026-10-05", flight_end: "2026-10-11", is_new: false },
      { sponsor: "Fogle for Missouri", side: "oppose", station: "KTTS-FM", market: "Springfield", amount: 2676, grps: 0, cpp: null, flight_start: "2026-10-05", flight_end: "2026-10-12", is_new: true },
      { sponsor: "Fogle for Missouri", side: "oppose", station: "KWTO-FM", market: "Springfield", amount: 1190, grps: 0, cpp: null, flight_start: "2026-10-05", flight_end: "2026-10-12", is_new: true },
      { sponsor: "Fogle for Missouri", side: "oppose", station: "KTXR-FM", market: "Springfield", amount: 1157, grps: 0, cpp: null, flight_start: "2026-10-05", flight_end: "2026-10-12", is_new: true },
      { sponsor: "Fogle for Missouri", side: "oppose", station: "KKLH-FM", market: "Springfield", amount: 1137, grps: 0, cpp: null, flight_start: "2026-10-05", flight_end: "2026-10-12", is_new: true },
    ],
    notes: [
      { source: "Katz", text: "Fogle radio $6,160 loaded 10/5; labeled State Senate District 30.", url: null },
    ],
    links: [{ label: "SD30 competitive (Almanac)", url: "https://www.thompsoncommunications.tech/competitive/mo-sd30?token=mo-sd30-2026" }],
    source: "competitive",
    updated_at: "2026-10-06T10:37:41.120378+00:00",
  },
];

export function oct6LiveRaceBriefs(editionDate = "2026-10-06"): RaceBriefsDesk {
  const desk = asRaceBriefsDesk(OCT6_ROWS, editionDate);
  if (!desk) throw new Error("2026-10-06 race briefs failed to parse");
  return desk;
}
