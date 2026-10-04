// The city behind the Shabbat times, and the list to pick it from. Kept apart
// from jewish-calendar.ts so a screen that only picks the city (the profile)
// doesn't load the whole calendar library.
import { useSyncExternalStore } from "react";

// ── Cities ───────────────────────────────────────────────────────────────────
// hebcal knows a handful of Israeli cities by name (and lights 40 minutes
// before sunset in Jerusalem, 30 in Haifa and Zikhron Ya'akov); the rest are
// placed by coordinates.

export type City = { id: string; label: string; en: string; lat?: number; lng?: number };

export const CITIES: City[] = [
  { id: "jerusalem", label: "ירושלים", en: "Jerusalem" },
  { id: "tel-aviv", label: "תל אביב", en: "Tel Aviv" },
  { id: "haifa", label: "חיפה", en: "Haifa" },
  { id: "beer-sheva", label: "באר שבע", en: "Beer Sheva" },
  { id: "ashdod", label: "אשדוד", en: "Ashdod" },
  { id: "ashkelon", label: "אשקלון", en: "Ashkelon", lat: 31.6688, lng: 34.5743 },
  { id: "bat-yam", label: "בת ים", en: "Bat Yam", lat: 32.0171, lng: 34.7454 },
  { id: "beit-shemesh", label: "בית שמש", en: "Beit Shemesh", lat: 31.747, lng: 34.9881 },
  { id: "bnei-brak", label: "בני ברק", en: "Bnei Brak", lat: 32.0807, lng: 34.8338 },
  { id: "hadera", label: "חדרה", en: "Hadera", lat: 32.434, lng: 34.9196 },
  { id: "herzliya", label: "הרצליה", en: "Herzliya", lat: 32.1663, lng: 34.8433 },
  { id: "holon", label: "חולון", en: "Holon", lat: 32.0158, lng: 34.7874 },
  { id: "tiberias", label: "טבריה", en: "Tiberias" },
  { id: "eilat", label: "אילת", en: "Eilat" },
  { id: "karmiel", label: "כרמיאל", en: "Karmiel", lat: 32.919, lng: 35.2951 },
  { id: "kfar-saba", label: "כפר סבא", en: "Kfar Saba", lat: 32.175, lng: 34.9069 },
  { id: "modiin", label: "מודיעין", en: "Modiin", lat: 31.898, lng: 35.0104 },
  { id: "nazareth", label: "נצרת", en: "Nazareth", lat: 32.6996, lng: 35.3035 },
  { id: "netanya", label: "נתניה", en: "Netanya", lat: 32.3215, lng: 34.8532 },
  { id: "afula", label: "עפולה", en: "Afula", lat: 32.6078, lng: 35.2897 },
  { id: "safed", label: "צפת", en: "Safed", lat: 32.9646, lng: 35.496 },
  { id: "kiryat-shmona", label: "קריית שמונה", en: "Kiryat Shmona", lat: 33.2073, lng: 35.5697 },
  { id: "rishon", label: "ראשון לציון", en: "Rishon LeZion", lat: 31.973, lng: 34.7925 },
  { id: "petah-tikva", label: "פתח תקווה", en: "Petach Tikvah" },
  { id: "rehovot", label: "רחובות", en: "Rehovot", lat: 31.8928, lng: 34.8113 },
  { id: "ramat-gan", label: "רמת גן", en: "Ramat Gan", lat: 32.0823, lng: 34.8106 },
  { id: "raanana", label: "רעננה", en: "Raanana", lat: 32.1848, lng: 34.8713 },
  { id: "zikhron", label: "זכרון יעקב", en: "Zikhron Yaakov", lat: 32.5707, lng: 34.9547 },
];

/** The person said no to Shabbat times. */
export const NO_CITY = "none";

export function cityLabel(id: string): string {
  return CITIES.find((c) => c.id === id)?.label ?? "";
}

// The chosen city is a per-device preference, like a theme: kept in
// localStorage and shared live by every component that shows times. Nothing
// stored = not asked yet; the home page asks before showing anything.
const CITY_KEY = "nahel-hakol:shabbat-city";
const cityListeners = new Set<() => void>();
// Where the answer lives when storage is blocked, so it still holds until reload
let memoryCity: string | null = null;

function readCity(): string | null {
  try {
    return localStorage.getItem(CITY_KEY) ?? memoryCity;
  } catch {
    return memoryCity;
  }
}

export function setShabbatCity(id: string) {
  memoryCity = id;
  try {
    localStorage.setItem(CITY_KEY, id);
  } catch {
    /* storage blocked — memoryCity carries it */
  }
  cityListeners.forEach((l) => l());
}

function subscribeCity(listener: () => void) {
  cityListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    cityListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The city for Shabbat times: a CITIES id, NO_CITY, or null when not asked yet. */
export function useShabbatCity(): string | null {
  return useSyncExternalStore(subscribeCity, readCity, () => null);
}
