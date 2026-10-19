import test from "node:test";
import assert from "node:assert/strict";
import {
  newCloud,
  validateCloud,
  cloudLink,
  readCloudLink,
  seal,
  unseal,
  mergeCloudTrips,
  tripHashes,
  CloudSpace,
  cloudKey,
  prepareCloudFiles,
  hash,
} from "../src/cloud-space.js";
import { tripLink, readTripLink } from "../src/share-links.js";
const config = () =>
  newCloud("https://example.supabase.co", "sb_publishable_example");
const trip = (id = "trip", name = "Stockholm") => ({
  id,
  name,
  country: "Suède",
  days: 1,
  mode: "walking",
  fileOrder: false,
  startId: "p",
  places: [{ id: "p", name: "Vasa", lat: 59.32, lng: 18.09 }],
  createdAt: "2026-10-19T12:00:00Z",
});
const data = (trips) => ({
  format: "voyage-workspace",
  version: 1,
  trips,
  places: [],
  files: [],
});
const memory = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
function server() {
  const spaces = new Map();
  return {
    spaces,
    install: (c) =>
      spaces.set(c.id, {
        read: c.readToken,
        write: c.writeToken,
        revision: 0,
        payload: null,
      }),
    request: async (url, options) => {
      const args = JSON.parse(options.body),
        s = spaces.get(args.p_id),
        writing = url.endsWith("voyage_write");
      if (!s || args.p_token !== (writing ? s.write : s.read))
        return { ok: false, status: 403 };
      if (!writing)
        return {
          ok: true,
          json: async () => ({
            revision: s.revision,
            payload: s.revision === args.p_revision ? null : s.payload,
            unchanged: s.revision === args.p_revision,
          }),
        };
      if (args.p_expected !== s.revision)
        return { ok: true, json: async () => ({ conflict: true }) };
      s.payload = args.p_payload;
      s.revision++;
      return { ok: true, json: async () => ({ revision: s.revision }) };
    },
  };
}
function device(backend, initial = []) {
  let trips = structuredClone(initial),
    busy = false;
  const storage = memory(),
    messages = [];
  const cloud = new CloudSpace({
    storage,
    getTrips: () => trips,
    request: backend.request,
    backup: async (ts) => data(structuredClone(ts)),
    prepareFiles: async () => ({ rollback: async () => {} }),
    isBusy: () => busy,
    status: (m) => messages.push(m),
    applyTrips: async (incoming, { initial, previousIds }) => {
      const ids = new Set(incoming.map((t) => t.id)),
        previous = new Set(previousIds);
      trips = [
        ...structuredClone(incoming),
        ...trips.filter((t) => !ids.has(t.id) && !previous.has(t.id)),
      ];
    },
  });
  return {
    cloud,
    storage,
    messages,
    get trips() {
      return trips;
    },
    edit(next) {
      cloud.readOnlyGuard(next);
      const old = trips;
      trips = next;
      cloud.changed(next, old);
    },
    busy(v) {
      busy = v;
    },
  };
}
test("liens : espaces lecture et modification séparés, secrets dans le fragment uniquement", () => {
  const c = config(),
    read = cloudLink(c, false, "https://example.github.io/Voyage/?x=1#accueil"),
    write = cloudLink(c, true, "https://example.github.io/Voyage/");
  assert.equal(new URL(read).pathname, "/Voyage/");
  assert.equal(new URL(read).search, "");
  assert.equal(readCloudLink(new URL(read).hash).writeToken, undefined);
  assert.equal(readCloudLink(new URL(write).hash).writeToken, c.writeToken);
  assert.throws(() =>
    cloudLink(readCloudLink(new URL(read).hash), true, "https://example.org"),
  );
  assert.throws(() => validateCloud({ ...c, apiKey: "sb_secret_danger" }));
  assert.throws(() =>
    validateCloud({ ...c, url: "https://example.supabase.co.evil.test" }),
  );
});
test("lien d’itinéraire ouvrable sur un appareil vide, sans réservations ni billets", () => {
  const t = trip();
  t.organizer = {
    startDate: "",
    bookings: [
      {
        id: "b",
        title: "Vol",
        kind: "flight",
        day: 1,
        time: "",
        endTime: "",
        notes: "",
        placeId: "",
        reference: "SECRET",
      },
    ],
  };
  const read = readTripLink(
    new URL(tripLink(t, "https://example.org/Voyage/")).hash,
  );
  assert.equal(read.trips[0].name, "Stockholm");
  assert.doesNotMatch(JSON.stringify(read), /SECRET/);
});
test("chiffrement authentifié : clé erronée, espace différent et altération refusés", async () => {
  const c = config(),
    payload = await seal(c, data([trip()]));
  assert.equal((await unseal(c, payload)).trips[0].name, "Stockholm");
  assert.doesNotMatch(JSON.stringify(payload), /Stockholm|Vasa/);
  await assert.rejects(
    unseal({ ...c, key: config().key }, payload),
    /déchiffrer/,
  );
  await assert.rejects(
    unseal({ ...c, id: crypto.randomUUID() }, payload),
    /déchiffrer/,
  );
  await assert.rejects(
    unseal(c, { ...payload, data: payload.data.slice(0, -8) + "AAAAAAAA" }),
  );
});
test("fusion trois voies : modifications de dossiers différents, suppressions et conflits sans perte", async () => {
  const a = trip("a"),
    b = trip("b"),
    base = await tripHashes([a, b]);
  let r = await mergeCloudTrips(
    base,
    [{ ...a, name: "PC" }, b],
    [a, { ...b, name: "Téléphone" }],
  );
  assert.equal(r.conflicts.length, 0);
  assert.deepEqual(
    r.trips.map((t) => t.name),
    ["PC", "Téléphone"],
  );
  r = await mergeCloudTrips(
    base,
    [{ ...a, name: "PC" }, b],
    [{ ...a, name: "Téléphone" }, b],
  );
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.trips.length, 3);
  assert.ok(r.trips.some((t) => t.name === "Téléphone"));
  assert.ok(r.trips.some((t) => t.name.includes("PC")));
  r = await mergeCloudTrips(base, [], [a, b]);
  assert.equal(r.trips.length, 0);
  r = await mergeCloudTrips(base, [{ ...a, name: "Correction" }, b], [b]);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.trips.length, 2);
});
test("deux appareils : première sauvegarde, récupération, modifications, nouveaux voyages et suppressions", async () => {
  const s = server(),
    c = config();
  s.install(c);
  const pc = device(s, [trip()]),
    phone = device(s, [trip("private", "Local")]);
  await pc.cloud.connect(c, { create: true });
  await phone.cloud.connect(c);
  assert.equal(phone.trips.length, 2);
  phone.edit(
    phone.trips.map((t) =>
      t.id === "trip" ? { ...t, name: "Modifié au téléphone" } : t,
    ),
  );
  await phone.cloud.sync();
  await pc.cloud.sync();
  assert.equal(pc.trips[0].name, "Modifié au téléphone");
  assert.ok(!pc.trips.some((t) => t.id === "private"));
  pc.edit([...pc.trips, trip("new", "Nouveau")]);
  await pc.cloud.sync();
  await phone.cloud.sync();
  assert.ok(phone.trips.some((t) => t.id === "new"));
  pc.edit(pc.trips.filter((t) => t.id !== "trip"));
  await pc.cloud.sync();
  await phone.cloud.sync();
  assert.ok(!phone.trips.some((t) => t.id === "trip"));
  assert.ok(phone.trips.some((t) => t.id === "private"));
});
test("lecteur : récupère les changements, conserve ses copies, aucun droit d’écriture", async () => {
  const s = server(),
    c = config();
  s.install(c);
  const writer = device(s, [trip()]);
  await writer.cloud.connect(c, { create: true });
  const read = { ...c };
  delete read.writeToken;
  const reader = device(s);
  await reader.cloud.connect(read);
  assert.throws(
    () => reader.edit([{ ...reader.trips[0], name: "Interdit" }]),
    /lecture seule/,
  );
  reader.edit([...reader.trips, trip("copy", "Copie")]);
  await reader.cloud.sync();
  writer.edit([{ ...writer.trips[0], name: "Mise à jour" }]);
  await writer.cloud.sync();
  await reader.cloud.sync();
  assert.equal(reader.trips.find((t) => t.id === "trip").name, "Mise à jour");
  assert.ok(reader.trips.some((t) => t.id === "copy"));
  await assert.rejects(
    new CloudSpace({
      storage: memory(),
      getTrips: () => [],
      applyTrips: () => {},
      request: s.request,
    }).connect({ ...c, writeToken: config().writeToken }, { create: true }),
  );
});
test("hors ligne : modifications conservées puis synchronisées sans écrasement concurrent", async () => {
  const s = server(),
    c = config();
  s.install(c);
  const a = device(s, [trip()]),
    b = device(s);
  await a.cloud.connect(c, { create: true });
  await b.cloud.connect(c);
  a.edit([{ ...a.trips[0], name: "PC" }]);
  b.edit([{ ...b.trips[0], name: "Téléphone" }]);
  const request = b.cloud.request;
  b.cloud.request = async () => {
    throw new Error("offline");
  };
  assert.equal(await b.cloud.sync(), false);
  assert.equal(b.trips[0].name, "Téléphone");
  assert.ok(b.cloud.state.dirty);
  await a.cloud.sync();
  b.cloud.request = request;
  await b.cloud.sync();
  assert.equal(b.trips.length, 2);
  await a.cloud.sync();
  assert.equal(a.trips.length, 2);
  assert.ok(b.messages.some((m) => m.includes("simultanées")));
});
test("rechargement retrouve l’espace et les modifications en attente ; formulaires non interrompus", async () => {
  const s = server(),
    c = config();
  s.install(c);
  const a = device(s, [trip()]);
  await a.cloud.connect(c, { create: true });
  a.edit([{ ...a.trips[0], name: "En attente" }]);
  const state = JSON.parse(a.storage.getItem(cloudKey));
  assert.ok(state.dirty);
  assert.equal(state.config.id, c.id);
  a.busy(true);
  await a.cloud.sync();
  assert.equal(s.spaces.get(c.id).revision, 1);
  a.busy(false);
  await a.cloud.sync();
  assert.equal(s.spaces.get(c.id).revision, 2);
  a.cloud.disconnect();
  assert.equal(a.storage.getItem(cloudKey), null);
  assert.equal(a.trips[0].name, "En attente");
});
test("documents : intégrité, stockage et annulation avant import invalide", async () => {
  const content = "data:application/pdf;base64," + btoa("%PDF-test"),
    id = "cloud-" + (await hash(content)),
    t = trip();
  t.organizer = {
    bookings: [
      {
        id: "b",
        title: "Billet",
        kind: "museum",
        day: 1,
        time: "",
        endTime: "",
        notes: "",
        placeId: "p",
        reference: "",
        attachment: {
          id,
          name: "billet.pdf",
          type: "application/pdf",
          size: 9,
        },
      },
    ],
  };
  const store = new Map(),
    api = async (action, id, file) =>
      action === "get"
        ? store.get(id)
        : action === "put"
          ? store.set(id, file)
          : store.delete(id),
    d = { ...data([t]), files: [{ id, content }] };
  const prepared = await prepareCloudFiles(d, api);
  assert.equal(store.size, 1);
  await prepared.rollback();
  assert.equal(store.size, 0);
  await assert.rejects(
    prepareCloudFiles({ ...d, files: [{ id, content: content + "bad" }] }, api),
    /invalide/,
  );
  assert.equal(store.size, 0);
});
test("échec du stockage des réglages : pas d’import partiel et documents préparés annulés", async () => {
  const s = server(),
    c = config();
  s.install(c);
  const source = device(s, [trip()]);
  await source.cloud.connect(c, { create: true });
  let applied = false,
    rolledBack = false;
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {},
  };
  const cloud = new CloudSpace({
    storage,
    getTrips: () => [],
    applyTrips: async () => {
      applied = true;
    },
    request: s.request,
    prepareFiles: async () => ({
      rollback: async () => {
        rolledBack = true;
      },
    }),
  });
  await assert.rejects(cloud.connect(c), /quota/);
  assert.equal(applied, false);
  assert.ok(rolledBack);
  assert.equal(cloud.state, undefined);
});
test("échec de la sauvegarde locale : les anciens réglages de synchronisation sont restaurés", async () => {
  const s = server(),
    c = config();
  s.install(c);
  const source = device(s, [trip()]);
  await source.cloud.connect(c, { create: true });
  const storage = memory();
  let rolledBack = false;
  const cloud = new CloudSpace({
    storage,
    getTrips: () => [],
    applyTrips: async () => {
      throw new Error("local quota");
    },
    request: s.request,
    prepareFiles: async () => ({
      rollback: async () => {
        rolledBack = true;
      },
    }),
  });
  await assert.rejects(cloud.connect(c), /local quota/);
  assert.equal(storage.getItem(cloudKey), null);
  assert.ok(rolledBack);
});
test("supprimer une réservation ne retire pas le billet utilisé par une copie personnelle", async () => {
  const { deleteUnusedDocument } = await import("../src/travel-files.js");
  const storage = memory(),
    removed = [];
  storage.setItem(
    "voyage.trips.v1",
    JSON.stringify([
      { organizer: { bookings: [{ attachment: { id: "shared" } }] } },
    ]),
  );
  await deleteUnusedDocument("shared", storage, async (id) => removed.push(id));
  assert.equal(removed.length, 0);
  storage.setItem("voyage.trips.v1", "[]");
  await deleteUnusedDocument("shared", storage, async (id) => removed.push(id));
  assert.deepEqual(removed, ["shared"]);
});
