#!/usr/bin/env python3
"""Sanity-check the MLB NL Central payload the Swift widget expects."""

from __future__ import annotations

import json
import sys
import urllib.request

DIVISION_ID = 205
LEAGUE_ID = 104
URL = (
    "https://statsapi.mlb.com/api/v1/standings"
    f"?leagueId={LEAGUE_ID}&season=2026&standingsTypes=regularSeason&hydrate=division,team"
)


def main() -> int:
    with urllib.request.urlopen(URL, timeout=20) as resp:
        data = json.load(resp)

    block = next(
        (r for r in data.get("records", []) if (r.get("division") or {}).get("id") == DIVISION_ID),
        None,
    )
    if not block:
        print("FAIL: NL Central (division 205) missing", file=sys.stderr)
        return 1

    rows = block.get("teamRecords") or []
    if len(rows) != 5:
        print(f"FAIL: expected 5 teams, got {len(rows)}", file=sys.stderr)
        return 1

    print("NL Central standings OK")
    for r in rows:
        t = r.get("team") or {}
        gb = r.get("gamesBack")
        gb_disp = "—" if gb in ("-", "0", "0.0", None) else gb
        print(
            f"  {r.get('divisionRank')} {t.get('abbreviation'):3} "
            f"{t.get('teamName') or t.get('name'):12} "
            f"{r.get('wins')}-{r.get('losses')}  GB {gb_disp}  "
            f"{r.get('winningPercentage')}  {((r.get('streak') or {}).get('streakCode') or '')}"
        )
        for key in ("id", "abbreviation", "name", "teamName"):
            if not t.get(key):
                print(f"FAIL: team missing {key}", file=sys.stderr)
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
