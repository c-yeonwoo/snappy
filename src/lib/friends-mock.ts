// Frontend-only mock store for the friends/allow-window feature.
// Persists in localStorage so the UI behaves consistently between reloads.
// Replace with real backend calls when the Spring/AWS API lands.
import { useEffect, useSyncExternalStore } from "react";

const FRIENDS_KEY = "snappy.friends.v1";
const WINDOW_KEY = "snappy.allowWindow.v1"; // epoch ms expiry

export type Friend = { id: string; handle: string; display_name: string };

type State = { friends: Friend[]; windowUntil: number | null };

const listeners = new Set<() => void>();
function emit() {
  cached = compute();
  listeners.forEach((l) => l());
}

function compute(): State {
  if (typeof window === "undefined") return { friends: [], windowUntil: null };
  let friends: Friend[] = [];
  try {
    friends = JSON.parse(localStorage.getItem(FRIENDS_KEY) || "[]");
  } catch {
    friends = [];
  }
  const w = Number(localStorage.getItem(WINDOW_KEY) || 0);
  const windowUntil = w && w > Date.now() ? w : null;
  return { friends, windowUntil };
}

let cached: State = compute();
function read(): State {
  return cached;
}

function writeFriends(list: Friend[]) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(list));
  emit();
}
function writeWindow(until: number | null) {
  if (until) localStorage.setItem(WINDOW_KEY, String(until));
  else localStorage.removeItem(WINDOW_KEY);
  emit();
}

export function useFriendsStore() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => ({ friends: [], windowUntil: null }),
  );

  // tick every second so the countdown updates
  useEffect(() => {
    if (!state.windowUntil) return;
    const t = setInterval(() => emit(), 1000);
    return () => clearInterval(t);
  }, [state.windowUntil]);

  return {
    friends: state.friends,
    windowUntil: state.windowUntil,
    isFriend: (id: string) => state.friends.some((f) => f.id === id),
    addFriend: (f: Friend) => {
      const cur = read().friends;
      if (cur.some((x) => x.id === f.id)) return;
      writeFriends([...cur, f]);
    },
    removeFriend: (id: string) => writeFriends(read().friends.filter((f) => f.id !== id)),
    openWindow: (minutes = 10) => writeWindow(Date.now() + minutes * 60_000),
    closeWindow: () => writeWindow(null),
  };
}

export function formatRemaining(until: number) {
  const ms = Math.max(0, until - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}