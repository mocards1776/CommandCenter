# NL Central — no Xcode, no repo clone

Native WidgetKit needs a signed Mac app (Xcode). If you just want the table on your desktop, use **Übersicht** instead.

## 3 steps

1. Install [Übersicht](https://tracesof.net/uebersicht/) (free Mac app).
2. Open it once so it creates its widgets folder.
3. In Terminal:

```bash
curl -L -o "$HOME/Library/Application Support/Übersicht/widgets/nl-central.jsx" \
  "https://raw.githubusercontent.com/mocards1776/CommandCenter/main/NLCentralStandings/Uebersicht/nl-central.jsx"
```

The widget appears on the desktop (top-right). Drag to reposition. It refreshes every 30 minutes from the MLB Stats API; Cardinals are highlighted.

To remove it, delete that `.jsx` file or quit Übersicht.
