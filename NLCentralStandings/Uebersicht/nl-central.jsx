// NL Central standings — Übersicht desktop widget
// No Xcode / no CommandCenter repo required.
//
// Install:
//   1. Download Übersicht: https://tracesof.net/uebersicht/
//   2. Open Übersicht → it creates ~/Library/Application Support/Übersicht/widgets
//   3. Save this file there as: nl-central.jsx
//      (or: curl -L -o ~/Library/Application\ Support/Übersicht/widgets/nl-central.jsx \
//            https://raw.githubusercontent.com/mocards1776/CommandCenter/main/NLCentralStandings/Uebersicht/nl-central.jsx)
//   4. Drag it on the desktop; right-click widget → refresh if needed.

export const refreshFrequency = 1000 * 60 * 30; // 30 minutes

export const command = (dispatch) => {
  const year = currentSeason();
  const url =
    "https://statsapi.mlb.com/api/v1/standings" +
    `?leagueId=104&season=${year}&standingsTypes=regularSeason&hydrate=division,team`;

  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const block = (data.records || []).find(
        (rec) =>
          (rec.division && rec.division.id === 205) ||
          ((rec.division && rec.division.name) || "").includes("Central")
      );
      if (!block) throw new Error("NL Central not found");

      const rows = (block.teamRecords || []).map((r, i) => {
        const t = r.team || {};
        const gbRaw = r.gamesBack;
        const gb =
          gbRaw === "-" || gbRaw === "0" || gbRaw === "0.0" || !gbRaw
            ? "—"
            : String(gbRaw);
        return {
          id: t.id || i,
          rank: Number(r.divisionRank) || i + 1,
          abbr: t.abbreviation || "—",
          name: t.teamName || shortName(t.name),
          w: r.wins || 0,
          l: r.losses || 0,
          pct: r.winningPercentage || "—",
          gb,
          streak: (r.streak && r.streak.streakCode) || "",
          isStl: t.id === 138,
        };
      });

      dispatch({
        type: "OK",
        rows,
        season: year,
        at: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    })
    .catch((error) => dispatch({ type: "ERR", error: String(error) }));
};

export const initialState = { rows: [], season: null, at: null, error: null };

export const updateState = (event, prev) => {
  if (event.type === "OK") {
    return {
      rows: event.rows,
      season: event.season,
      at: event.at,
      error: null,
    };
  }
  if (event.type === "ERR") {
    return { ...prev, error: event.error };
  }
  // shell output path unused
  if (event.output != null || event.error != null) return prev;
  return prev;
};

export const className = `
  top: 48px;
  right: 48px;
  width: 380px;
  color: #f4f1e9;
  font-family: "Avenir Next", "SF Pro Rounded", -apple-system, sans-serif;
  background: linear-gradient(145deg, rgba(22,41,79,0.92), rgba(10,23,48,0.94) 55%, rgba(8,18,40,0.96));
  border-radius: 16px;
  padding: 14px 16px 12px;
  box-shadow: 0 18px 40px rgba(0,0,0,0.35);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  user-select: none;
  pointer-events: none;
`;

const ACCENT = {
  158: "#FFC52F",
  112: "#0E3386",
  138: "#C41E3A",
  134: "#FDB827",
  113: "#C6011F",
};

export const render = (state) => {
  const { rows = [], season, at, error } = state || {};

  if (error && (!rows || !rows.length)) {
    return (
      <div style={{ fontSize: 12, color: "rgba(237,239,245,0.55)" }}>
        NL Central unavailable
        <div style={{ marginTop: 4, fontFamily: "Menlo, monospace", fontSize: 10 }}>
          {error}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ fontSize: 12, color: "rgba(237,239,245,0.55)" }}>
        Loading NL Central…
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              color: "#d9515c",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "1.4px",
            }}
          >
            NL CENTRAL
          </div>
          <div
            style={{
              color: "rgba(237,239,245,0.55)",
              fontSize: 10,
              marginTop: 2,
            }}
          >
            {season} · Major League Baseball
          </div>
        </div>
        <div
          style={{
            fontFamily: "Menlo, monospace",
            fontSize: 10,
            color: "rgba(237,239,245,0.3)",
          }}
        >
          {at || ""}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3px 18px 1fr 30px 30px 42px 36px 34px",
          gap: "0 0",
          fontSize: 9,
          fontWeight: 600,
          color: "rgba(237,239,245,0.3)",
          letterSpacing: "0.04em",
          padding: "0 6px 4px",
        }}
      >
        <span />
        <span>#</span>
        <span>TEAM</span>
        <span style={{ textAlign: "right" }}>W</span>
        <span style={{ textAlign: "right" }}>L</span>
        <span style={{ textAlign: "right" }}>PCT</span>
        <span style={{ textAlign: "right" }}>GB</span>
        <span style={{ textAlign: "right" }}>STR</span>
      </div>

      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns: "3px 18px 1fr 30px 30px 42px 36px 34px",
            alignItems: "center",
            fontFamily: "Menlo, SF Mono, monospace",
            fontSize: 12,
            padding: "5px 6px",
            margin: "1px 0",
            borderRadius: 6,
            background: r.isStl ? "rgba(192,48,59,0.22)" : "transparent",
            fontWeight: r.isStl ? 700 : 500,
          }}
        >
          <span
            style={{
              width: 3,
              height: 14,
              borderRadius: 1.5,
              background: ACCENT[r.id] || "#d9515c",
              display: "inline-block",
            }}
          />
          <span style={{ color: "rgba(237,239,245,0.55)" }}>{r.rank}</span>
          <span
            style={{
              fontFamily: "Avenir Next, SF Pro Rounded, sans-serif",
              fontWeight: r.isStl ? 700 : 600,
              paddingLeft: 6,
            }}
          >
            {r.name}
          </span>
          <span style={{ textAlign: "right" }}>{r.w}</span>
          <span style={{ textAlign: "right" }}>{r.l}</span>
          <span style={{ textAlign: "right", color: "rgba(237,239,245,0.55)" }}>
            {r.pct}
          </span>
          <span style={{ textAlign: "right" }}>{r.gb}</span>
          <span
            style={{
              textAlign: "right",
              color: r.streak.startsWith("W")
                ? "#3d9b6e"
                : r.streak.startsWith("L")
                  ? "#d9515c"
                  : "rgba(237,239,245,0.55)",
            }}
          >
            {r.streak}
          </span>
        </div>
      ))}
    </div>
  );
};

function currentSeason() {
  const now = new Date();
  // Approximate Central time season year
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year").value);
  const month = Number(parts.find((p) => p.type === "month").value);
  return month < 3 ? year - 1 : year;
}

function shortName(name) {
  if (!name) return "—";
  return name
    .replace(/^St\. Louis /, "")
    .replace(/^Chicago /, "")
    .replace(/^Milwaukee /, "")
    .replace(/^Pittsburgh /, "")
    .replace(/^Cincinnati /, "");
}
