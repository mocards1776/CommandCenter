import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getAccessToken } from "@/lib/supabase";
import { visibleFavorites, type SportsFavorite, type SportsLayout } from "@/lib/sports";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sports-push`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const DISMISS_KEY = "sports-push-banner-dismissed";

export type PushFavorite = {
  key: string;
  sport: string;
  teamId: string;
  shortName: string;
};

export type PushPermission = NotificationPermission | "unsupported";

type PushSnap = {
  ready: boolean;
  permission: PushPermission;
  standalone: boolean;
  ios: boolean;
  subscribed: boolean;
  heat: boolean;
  favorites: boolean;
  vapidConfigured: boolean;
  dismissed: boolean;
  busy: boolean;
  error: string | null;
};

const INITIAL: PushSnap = {
  ready: false,
  permission: "default",
  heat: true,
  favorites: false,
  subscribed: false,
  vapidConfigured: false,
  dismissed: false,
  standalone: false,
  ios: false,
  busy: false,
  error: null,
};

let snap: PushSnap = INITIAL;

const listeners = new Set<() => void>();

function emit(patch: Partial<PushSnap>) {
  snap = { ...snap, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnap() {
  return snap;
}

function getServerSnap() {
  return INITIAL;
}

export function pushFavorites(layout: SportsLayout): PushFavorite[] {
  const out: PushFavorite[] = [];
  for (const fav of visibleFavorites(layout)) {
    const row = favoriteRef(fav);
    if (row) out.push(row);
  }
  return out;
}

function favoriteRef(fav: SportsFavorite): PushFavorite | null {
  if (fav.kind !== "team") return null;
  const teamId = /\/teams\/(\d+)/.exec(fav.espnPath)?.[1];
  if (!teamId) return null;
  let sport = "";
  if (fav.league === "MLB" || fav.mlbTeamId) sport = "mlb";
  else if (fav.league === "NHL") sport = "nhl";
  else if (fav.league === "NFL") sport = "nfl";
  else if (fav.league === "NBA") sport = "nba";
  else if (fav.sport === "Football" && fav.league === "NCAA") sport = "cfb";
  else if (fav.sport === "Basketball" && fav.league === "NCAA") sport = "cbb";
  else if (fav.sport === "Soccer") sport = "soccer";
  else return null;
  return { key: fav.key, sport, teamId, shortName: fav.shortName };
}

function readEnv() {
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as { standalone?: boolean }).standalone === true;
  const permission: PushPermission =
    typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  return {
    ios,
    standalone,
    permission,
    dismissed: localStorage.getItem(DISMISS_KEY) === "1",
  };
}

async function call<T>(action: string, extra: Record<string, unknown> = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  };
  if (auth) {
    const token = await getAccessToken();
    if (!token) throw new Error("Sign in to turn on alerts");
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(FN, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...extra }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Alerts ${res.status}`);
  return data;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerSportsWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

let loaded = false;
let loading: Promise<void> | null = null;
let statusKnown = false;

async function refreshStatus() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const status = await call<{
        subscribed: boolean;
        heatAlerts: boolean;
        favoriteAlerts: boolean;
        vapidConfigured: boolean;
      }>("status");
      statusKnown = true;
      emit({
        ready: true,
        subscribed: status.subscribed,
        heat: status.subscribed ? status.heatAlerts : snap.heat,
        favorites: status.subscribed ? status.favoriteAlerts : snap.favorites,
        vapidConfigured: status.vapidConfigured,
        error: null,
      });
    } catch {
      statusKnown = false;
      emit({ ready: true });
    } finally {
      loading = null;
      loaded = true;
    }
  })();
  return loading;
}

async function savePrefs(layout: SportsLayout, patch: { heat?: boolean; favorites?: boolean }) {
  const heat = patch.heat ?? snap.heat;
  const favorites = patch.favorites ?? snap.favorites;
  emit({ heat, favorites, busy: true, error: null });
  try {
    await call("prefs", {
      heatAlerts: heat,
      favoriteAlerts: favorites,
      favorites: pushFavorites(layout),
    });
    emit({ busy: false, subscribed: true });
  } catch (err) {
    emit({ busy: false, error: err instanceof Error ? err.message : "Could not save alerts" });
    throw err;
  }
}

export function useSportsPush(layout: SportsLayout) {
  const state = useSyncExternalStore(subscribe, getSnap, getServerSnap);
  const favKey = useMemo(() => JSON.stringify(pushFavorites(layout)), [layout]);

  useEffect(() => {
    emit(readEnv());
    void registerSportsWorker().catch(() => undefined);
    if (!loaded) void refreshStatus();
  }, []);

  useEffect(() => {
    if (!state.ready || !state.subscribed) return;
    const handle = window.setTimeout(() => {
      void call("prefs", {
        heatAlerts: snap.heat,
        favoriteAlerts: snap.favorites,
        favorites: JSON.parse(favKey) as PushFavorite[],
      }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [favKey, state.ready, state.subscribed]);

  const enable = useCallback(async () => {
    emit(readEnv());
    if (snap.ios && !snap.standalone) {
      emit({ error: "Open the Sports app on your Home Screen to allow alerts." });
      return;
    }
    if (!("Notification" in window) || !("PushManager" in window)) {
      emit({ permission: "unsupported", error: "This browser can’t receive alerts." });
      return;
    }
    if (statusKnown && !snap.vapidConfigured) {
      emit({ error: "Alerts aren’t available until the server push keys are set." });
      return;
    }
    emit({ busy: true, error: null });
    try {
      const permission = await Notification.requestPermission();
      emit({ permission });
      if (permission !== "granted") {
        emit({ busy: false, error: permission === "denied" ? "Alerts are blocked for this app." : null });
        return;
      }
      const registration = await registerSportsWorker();
      if (!registration) throw new Error("The Sports service worker didn’t install.");
      const keyRes = await call<{ publicKey: string | null }>("vapid-public-key", {}, false);
      if (!keyRes.publicKey) throw new Error("Push isn’t configured on the server yet.");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) as BufferSource,
        }));
      await call("subscribe", {
        subscription: subscription.toJSON(),
        heatAlerts: true,
        favoriteAlerts: snap.favorites,
        favorites: pushFavorites(layout),
      });
      emit({ busy: false, subscribed: true, heat: true, vapidConfigured: true, error: null });
    } catch (err) {
      emit({ busy: false, error: err instanceof Error ? err.message : "Could not enable alerts" });
    }
  }, [layout]);

  const setHeat = useCallback(
    async (on: boolean) => {
      if (snap.permission !== "granted" || !snap.subscribed) {
        if (on) await enable();
        return;
      }
      await savePrefs(layout, { heat: on });
    },
    [enable, layout],
  );

  const setFavoriteAlerts = useCallback(
    async (on: boolean) => {
      if (snap.permission !== "granted" || !snap.subscribed) {
        if (on) {
          emit({ favorites: true });
          await enable();
        }
        return;
      }
      await savePrefs(layout, { favorites: on });
    },
    [enable, layout],
  );

  const stop = useCallback(async () => {
    emit({ busy: true, error: null });
    try {
      const registration = await navigator.serviceWorker?.getRegistration("/");
      const existing = await registration?.pushManager.getSubscription();
      await existing?.unsubscribe();
      await call("unsubscribe");
      emit({ busy: false, subscribed: false, heat: true, favorites: false });
    } catch (err) {
      emit({ busy: false, error: err instanceof Error ? err.message : "Could not stop alerts" });
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    emit({ dismissed: true });
  }, []);

  return { ...state, enable, setHeat, setFavoriteAlerts, stop, dismiss };
}
