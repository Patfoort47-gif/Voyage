import { encode64, decode64 } from "./share-links.js";
import { validateBackup, workspaceBackup } from "./backups.js";
import { documentFile, validateFile } from "./travel-files.js";
const encoder = new TextEncoder(),
  MAX = 12 * 1024 * 1024;
export const cloudKey = "voyage.cloud.v1";
export async function hash(text) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(text)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export function validateCloud(config) {
  if (!config || config.version !== 1)
    throw new Error("Lien d’espace non reconnu.");
  const url = new URL(config.url);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    !["", "/"].includes(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Indiquez l’URL HTTPS de votre projet Supabase (*.supabase.co).",
    );
  if (typeof config.apiKey !== "string" || config.apiKey.length > 3000)
    throw new Error("Clé publique Supabase invalide.");
  if (!/^sb_publishable_[\w-]+$/.test(config.apiKey)) {
    let role;
    try {
      role = JSON.parse(
        new TextDecoder().decode(decode64(config.apiKey.split(".")[1], 3000)),
      ).role;
    } catch {}
    if (role !== "anon")
      throw new Error(
        "Utilisez uniquement la clé publique publishable ou anon, jamais une clé secrète ou service_role.",
      );
  }
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(config.id))
    throw new Error("Identifiant d’espace invalide.");
  for (const field of [
    "readToken",
    "key",
    ...(config.writeToken ? ["writeToken"] : []),
  ])
    if (
      typeof config[field] !== "string" ||
      decode64(config[field], 32).length !== 32
    )
      throw new Error("Clé d’accès invalide.");
  return {
    version: 1,
    url: url.origin,
    apiKey: config.apiKey,
    id: config.id,
    readToken: config.readToken,
    key: config.key,
    ...(config.writeToken ? { writeToken: config.writeToken } : {}),
  };
}
export function newCloud(url, apiKey) {
  const random = () => encode64(crypto.getRandomValues(new Uint8Array(32)));
  return validateCloud({
    version: 1,
    url,
    apiKey,
    id: crypto.randomUUID(),
    readToken: random(),
    writeToken: random(),
    key: random(),
  });
}
export function cloudLink(config, editable = false, base = location.href) {
  const safe = validateCloud(config);
  if (!editable) delete safe.writeToken;
  else if (!safe.writeToken)
    throw new Error(
      "Cet accès ne permet pas de créer un lien de modification.",
    );
  const url = new URL(base);
  url.search = "";
  url.hash = "espace=" + encode64(encoder.encode(JSON.stringify(safe)));
  return url.href;
}
export function readCloudLink(hash) {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("espace");
  return value
    ? validateCloud(
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            decode64(value, 8000),
          ),
        ),
      )
    : null;
}
async function cryptoKey(config) {
  return crypto.subtle.importKey(
    "raw",
    decode64(config.key, 32),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(config, data) {
  const bytes = encoder.encode(JSON.stringify(data));
  if (bytes.length > MAX)
    throw new Error(
      "Espace trop volumineux : 12 Mo maximum, données et billets encodés inclus. Exportez vos gros documents séparément.",
    );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return {
    v: 1,
    iv: encode64(iv),
    data: encode64(
      new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv, additionalData: encoder.encode(config.id) },
          await cryptoKey(config),
          bytes,
        ),
      ),
    ),
  };
}
export async function unseal(config, payload) {
  if (!payload || payload.v !== 1 || decode64(payload.iv, 12).length !== 12)
    throw new Error("Données chiffrées invalides.");
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode64(payload.iv, 12),
        additionalData: encoder.encode(config.id),
      },
      await cryptoKey(config),
      decode64(payload.data, MAX + 16),
    );
  } catch {
    throw new Error(
      "Impossible de déchiffrer cet espace. Vérifiez le lien d’accès.",
    );
  }
  if (plain.byteLength > MAX) throw new Error("Espace trop volumineux.");
  const data = validateBackup(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain)),
  );
  if (new Set(data.trips.map((t) => t.id)).size !== data.trips.length)
    throw new Error("Dossiers dupliqués dans l’espace.");
  return data;
}
export async function rpc(config, name, args, request = fetch) {
  let response;
  try {
    response = await request(config.url + "/rest/v1/rpc/voyage_" + name, {
      method: "POST",
      headers: { apikey: config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(20000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new Error(
      "Synchronisation indisponible. Vos modifications restent sur cet appareil ; réessayez avec du réseau.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Accès refusé : vérifiez la clé publique, le lien et l’installation SQL."
        : `Espace indisponible (HTTP ${response.status}). Vérifiez l’installation SQL ou réessayez plus tard.`,
    );
  const result = await response.json();
  if (
    !result ||
    (!(name === "write" && result.conflict === true) &&
      (!Number.isSafeInteger(result.revision) || result.revision < 0)) ||
    (name === "read" && !Object.hasOwn(result, "payload"))
  )
    throw new Error("Réponse de synchronisation invalide.");
  return result;
}
// IDs de documents fondés sur leur contenu : stables entre appareils et sans écraser les fichiers locaux.
export async function cloudBackup(trips) {
  const data = JSON.parse(await (await workspaceBackup(trips)).text()),
    ids = new Map(),
    files = new Map();
  for (const file of data.files) {
    const id = "cloud-" + (await hash(file.content));
    ids.set(file.id, id);
    files.set(id, { ...file, id });
  }
  for (const trip of data.trips)
    for (const b of trip.organizer?.bookings || [])
      if (b.attachment) b.attachment.id = ids.get(b.attachment.id);
  data.files = [...files.values()];
  if (encoder.encode(JSON.stringify(data)).length > MAX)
    throw new Error(
      "Espace trop volumineux : 12 Mo maximum, données et billets encodés inclus.",
    );
  return data;
}
export async function prepareCloudFiles(data, store = documentFile) {
  const created = [];
  try {
    const used = new Set(
      data.trips.flatMap((t) =>
        (t.organizer?.bookings || [])
          .filter((b) => b.attachment)
          .map((b) => b.attachment.id),
      ),
    );
    if (data.files.length > 1000)
      throw new Error("Trop de documents dans cet espace.");
    const files = new Map(data.files.map((f) => [f.id, f]));
    for (const id of used) {
      const f = files.get(id);
      if (
        !f ||
        typeof f.content !== "string" ||
        !/^data:(application\/pdf|image\/(png|jpeg|webp));base64,/.test(
          f.content,
        ) ||
        id !== "cloud-" + (await hash(f.content))
      )
        throw new Error("Document partagé manquant ou invalide.");
      const [header, body] = f.content.split(","),
        blob = new Blob([Uint8Array.from(atob(body), (c) => c.charCodeAt(0))], {
          type: header.slice(5, header.indexOf(";")),
        });
      validateFile(blob);
      if (!(await store("get", id))) {
        await store("put", id, blob);
        created.push(id);
      }
    }
    return {
      rollback: async () => {
        for (const id of created) await store("delete", id).catch(() => {});
      },
    };
  } catch (error) {
    for (const id of created) await store("delete", id).catch(() => {});
    throw error;
  }
}
export async function tripHashes(trips) {
  return Object.fromEntries(
    await Promise.all(
      trips.map(async (t) => [t.id, await hash(JSON.stringify(t))]),
    ),
  );
}
export async function mergeCloudTrips(base, local, remote) {
  const lh = await tripHashes(local),
    rh = await tripHashes(remote),
    lm = new Map(local.map((t) => [t.id, t])),
    rm = new Map(remote.map((t) => [t.id, t])),
    result = [],
    conflicts = [];
  for (const id of new Set([
    ...Object.keys(base),
    ...lm.keys(),
    ...rm.keys(),
  ])) {
    const l = lm.get(id),
      r = rm.get(id);
    if (lh[id] === rh[id] || lh[id] === base[id]) {
      if (r) result.push(r);
    } else if (rh[id] === base[id]) {
      if (l) result.push(l);
    } else {
      if (r) result.push(r);
      if (l)
        result.push({
          ...structuredClone(l),
          id: crypto.randomUUID(),
          name: l.name + " (version locale conservée)",
          updatedAt: new Date().toISOString(),
        });
      conflicts.push(id);
    }
  }
  return { trips: result, conflicts };
}
export class CloudSpace {
  constructor({
    storage = localStorage,
    getTrips,
    applyTrips,
    isBusy = () => false,
    status = () => {},
    request = fetch,
    backup = cloudBackup,
    prepareFiles = prepareCloudFiles,
  }) {
    Object.assign(this, {
      storage,
      getTrips,
      applyTrips,
      isBusy,
      status,
      request,
      backup,
      prepareFiles,
    });
    try {
      const state = JSON.parse(storage.getItem(cloudKey) || "null");
      if (state) {
        state.config = validateCloud(state.config);
        if (
          !Number.isSafeInteger(state.revision) ||
          state.revision < 0 ||
          !Array.isArray(state.pending || []) ||
          !state.base ||
          typeof state.base !== "object" ||
          Array.isArray(state.base) ||
          Object.entries(state.base).some(
            ([id, h]) => !id || !/^([a-f0-9]{64})$/.test(h),
          )
        )
          throw new Error("État de synchronisation invalide.");
        this.state = { ...state, refresh: true };
      }
    } catch {
      this.invalid = true;
      status(
        "Les réglages de synchronisation sont illisibles. Vos voyages locaux sont conservés.",
      );
    }
  }
  persist(state) {
    this.storage.setItem(cloudKey, JSON.stringify(state));
    this.state = state;
  }
  changed(next, previous) {
    if (this.state) {
      const oldIds = new Set(previous.map((t) => t.id)),
        pending = new Set(this.state.pending || []);
      if (this.state.config.writeToken)
        for (const t of next) if (!oldIds.has(t.id)) pending.add(t.id);
      this.persist({ ...this.state, pending: [...pending], dirty: true });
      this.status(
        "Modifications sauvegardées sur cet appareil · synchronisation en attente.",
      );
    }
  }
  readOnlyGuard(next) {
    if (this.suspended)
      throw new Error(
        "Les données ont changé dans un autre onglet. Rechargez cette page avant de modifier les voyages.",
      );
    if (!this.state || this.state.config.writeToken) return;
    const shared = new Set(Object.keys(this.state.base));
    for (const trip of this.getTrips())
      if (
        shared.has(trip.id) &&
        JSON.stringify(next.find((t) => t.id === trip.id)) !==
          JSON.stringify(trip)
      )
        throw new Error(
          "Cet espace est en lecture seule. Utilisez « Créer une copie personnelle » ou demandez un lien de modification.",
        );
  }
  async commit(data, state, context, prepared) {
    const previous = this.state,
      raw = this.storage.getItem(cloudKey);
    try {
      this.persist(state);
      await this.applyTrips(data.trips, context);
    } catch (error) {
      this.state = previous;
      try {
        raw === null
          ? this.storage.removeItem(cloudKey)
          : this.storage.setItem(cloudKey, raw);
      } catch {
        this.suspended = true;
      }
      await prepared.rollback();
      throw error;
    }
  }
  async read(config, revision = -1) {
    const result = await rpc(
      config,
      "read",
      { p_id: config.id, p_token: config.readToken, p_revision: revision },
      this.request,
    );
    return {
      ...result,
      data: result.payload
        ? await unseal(config, result.payload)
        : { trips: [], places: [], files: [] },
    };
  }
  async connect(config, { create = false } = {}) {
    if (this.running) throw new Error("Attendez la fin de la synchronisation.");
    this.running = true;
    try {
      config = validateCloud(config);
      const remote = await this.read(config);
      if (create && remote.payload)
        throw new Error(
          "Cet espace contient déjà des voyages. Rejoignez-le pour les récupérer.",
        );
      const local = create ? await this.backup(this.getTrips()) : null;
      let data = remote.data,
        revision = remote.revision;
      if (create) {
        if (!config.writeToken)
          throw new Error("Un lien de modification est requis.");
        const result = await rpc(
          config,
          "write",
          {
            p_id: config.id,
            p_token: config.writeToken,
            p_expected: revision,
            p_payload: await seal(config, local),
          },
          this.request,
        );
        if (result.conflict)
          throw new Error(
            "Cet espace a changé. Rejoignez-le au lieu de l’initialiser.",
          );
        revision = result.revision;
        data = local;
      }
      const prepared = await this.prepareFiles(data);
      const state = {
        config,
        revision,
        base: await tripHashes(data.trips),
        dirty: false,
        pending: [],
      };
      await this.commit(
        data,
        state,
        {
          initial: !create,
          previousIds: create ? this.getTrips().map((t) => t.id) : [],
        },
        prepared,
      );
      this.status(
        config.writeToken
          ? "Espace connecté · voyages synchronisés."
          : "Espace connecté en lecture seule.",
      );
      return data.trips;
    } finally {
      this.running = false;
    }
  }
  async sync() {
    if (!this.state || this.suspended || this.running || this.isBusy()) return;
    this.running = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const state = this.state,
          remote = await this.read(
            state.config,
            state.refresh ? -1 : state.revision,
          );
        if (
          remote.revision === state.revision &&
          !state.dirty &&
          !state.refresh
        ) {
          this.status(
            state.config.writeToken
              ? "À jour · synchronisation active."
              : "À jour · espace en lecture seule.",
          );
          return;
        }
        const current = this.getTrips(),
          sharedIds = new Set(Object.keys(state.base)),
          local = await this.backup(
            current.filter(
              (t) =>
                sharedIds.has(t.id) ||
                (state.config.writeToken &&
                  (state.pending || []).includes(t.id)),
            ),
          );
        const captured = JSON.stringify(current);
        let merged = remote.unchanged
          ? { trips: local.trips, conflicts: [] }
          : state.config.writeToken && state.dirty
            ? await mergeCloudTrips(state.base, local.trips, remote.data.trips)
            : { trips: remote.data.trips, conflicts: [] };
        let data = {
          format: "voyage-workspace",
          version: 1,
          trips: merged.trips,
          places: [],
          files: [
            ...new Map(
              [...remote.data.files, ...local.files].map((f) => [f.id, f]),
            ).values(),
          ],
        };
        const used = new Set(
          data.trips.flatMap((t) =>
            (t.organizer?.bookings || [])
              .filter((b) => b.attachment)
              .map((b) => b.attachment.id),
          ),
        );
        data.files = data.files.filter((f) => used.has(f.id));
        const changed =
          JSON.stringify(await tripHashes(data.trips)) !==
          JSON.stringify(
            remote.unchanged ? state.base : await tripHashes(remote.data.trips),
          );
        if (captured !== JSON.stringify(this.getTrips()) || this.isBusy()) {
          this.status(
            "Modifications locales en cours · synchronisation différée.",
          );
          return;
        }
        let revision = remote.revision;
        if (state.config.writeToken && changed) {
          const result = await rpc(
            state.config,
            "write",
            {
              p_id: state.config.id,
              p_token: state.config.writeToken,
              p_expected: remote.revision,
              p_payload: await seal(state.config, data),
            },
            this.request,
          );
          if (result.conflict) continue;
          revision = result.revision;
        }
        const prepared = await this.prepareFiles(data);
        if (captured !== JSON.stringify(this.getTrips()) || this.isBusy()) {
          await prepared.rollback();
          this.status("Modifications locales en attente de synchronisation.");
          return;
        }
        await this.commit(
          data,
          {
            config: state.config,
            revision,
            base: await tripHashes(data.trips),
            dirty: false,
            pending: [],
          },
          {
            initial: false,
            previousIds: [...Object.keys(state.base), ...(state.pending || [])],
          },
          prepared,
        );
        this.status(
          merged.conflicts.length
            ? "Synchronisé · modifications simultanées : les deux versions sont conservées dans des dossiers distincts."
            : "À jour · voyages synchronisés.",
        );
        return;
      }
      throw new Error(
        "Plusieurs modifications simultanées. Réessayez dans un instant.",
      );
    } catch (error) {
      this.status(error.message);
      return false;
    } finally {
      this.running = false;
    }
  }
  disconnect() {
    this.storage.removeItem(cloudKey);
    this.state = null;
    this.invalid = false;
    this.status(
      "Synchronisation déconnectée. Les voyages restent sur cet appareil.",
    );
  }
}
