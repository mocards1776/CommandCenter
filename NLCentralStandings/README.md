# NL Central Standings — iOS & macOS Widget

**Want this without cloning the repo or opening Xcode?** (Mac desktop only) Use the Übersicht widget:

→ See **[Uebersicht/README.md](Uebersicht/README.md)** (3 Terminal steps).

---

Native **WidgetKit** widget for the National League Central, for **iPhone / iPad (iOS 17+)** and **Apple Silicon Mac (macOS 14+)**. Needs Xcode once to install.

Live data comes from the same MLB Stats API CommandCenter uses (`statsapi.mlb.com`). The Cardinals row is highlighted to match your sports favorites.

## What’s included

| Piece | Role |
| --- | --- |
| `NLCentralStandings` | Small host app (required by WidgetKit) — also shows the table |
| `NLCentralWidgetExtension` | Medium / Large widgets (Extra Large on Mac) |
| `Shared/` | Models, MLB client, Fenway scoreboard theme |

**Sizes**

- **Medium** — rank, abbreviation, W, L, GB (best fit for iPhone Home Screen)
- **Large** — adds PCT + streak
- **Extra Large** — macOS only (Notification Center / desktop)

Refreshes about every 30 minutes (WidgetKit may batch updates).

![Medium and Large widget preview](preview.png)

## Install on iPhone or iPad

1. Open `NLCentralStandings.xcodeproj` in **Xcode 15+** on a Mac.
2. Select the **NLCentralStandings** scheme and your **iPhone** (or Simulator) as the run destination.
3. Signing: select your **Personal Team** on both the app and `NLCentralWidgetExtension` targets (Signing & Capabilities). Bundle IDs are `com.commandcenter.nlcentral` / `.widget`.
4. Press **⌘R** to install the host app on the device. Launch it once.
5. Add the widget:
   - Long-press the Home Screen → **Edit** → **Add Widget**
   - Search **NL Central** → choose **Medium** or **Large** → **Add Widget**

### Build from the terminal (optional)

```bash
cd NLCentralStandings
# Simulator
xcodebuild -scheme NLCentralStandings -destination 'platform=iOS Simulator,name=iPhone 16' -configuration Debug build
# Connected device (replace with your UDID)
xcodebuild -scheme NLCentralStandings -destination 'platform=iOS,id=DEVICE_UDID' -configuration Debug build
```

## Install on your M1 MacBook Pro

1. Open `NLCentralStandings.xcodeproj` in **Xcode 15+** on the Mac.
2. Select the **NLCentralStandings** scheme and your Mac as the run destination (`My Mac (Designed for iPad)` is wrong — use **My Mac**).
3. Signing: select your **Personal Team** on both the app and `NLCentralWidgetExtension` targets. Bundle IDs are `com.commandcenter.nlcentral` / `.widget`.
4. Press **⌘R** once. Leave the host app running (or quit after first launch — the widget stays registered).
5. Add the widget:
   - Right-click the desktop → **Edit Widgets**, or
   - Notification Center → **Edit Widgets**
   - Search **NL Central** → drag **Medium** or **Large** onto the desktop.

```bash
cd NLCentralStandings
xcodebuild -scheme NLCentralStandings -destination 'platform=macOS,arch=arm64' -configuration Debug build
```

## Design

Uses CommandCenter’s Fenway scoreboard palette (navy field, cream type, Cardinals red accent). Each club gets a thin franchise color bar; STL is bold + tinted.

## Notes

- **iOS 17+** / **macOS 14+** required (`containerBackground` WidgetKit API).
- **arm64 only** — tuned for modern iPhone and Apple Silicon Mac.
- Network client entitlement is enabled for both targets so sandboxed Mac builds can hit MLB; iOS apps can use the network by default.
- Offline: last successful fetch is cached under Application Support (each process keeps its own cache).
- MLB data is unofficial / for personal use; subject to [MLB copyright notice](http://gdx.mlb.com/components/copyright.txt).
