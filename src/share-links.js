import { itineraryCopy, validateBackup } from "./backups.js";
export const encode64 = (bytes) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export function decode64(value, max = 18 * 1024 * 1024) {
  if (
    typeof value !== "string" ||
    value.length > Math.ceil((max * 4) / 3) + 4 ||
    !/^[\w-]+$/.test(value)
  )
    throw new Error("Lien invalide ou trop volumineux.");
  const bytes = Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  if (bytes.length > max) throw new Error("Lien trop volumineux.");
  return bytes;
}
export function tripLink(trip, base = location.href) {
  const data = itineraryCopy(trip);
  if (trip.dayGroups) data.trips[0].dayGroups = structuredClone(trip.dayGroups);
  const encoded = encode64(new TextEncoder().encode(JSON.stringify(data)));
  if (encoded.length > 48000)
    throw new Error(
      "Ce voyage est trop volumineux pour un lien. Utilisez le partage JSON ou l’espace synchronisé.",
    );
  const url = new URL(base);
  url.search = "";
  url.hash = "partage=" + encoded;
  return url.href;
}
export function readTripLink(hash) {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("partage");
  if (!value) return null;
  return validateBackup(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(decode64(value, 36000)),
    ),
  );
}
