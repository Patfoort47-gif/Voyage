import {
  CloudSpace,
  validateCloud,
  newCloud,
  cloudLink,
  readCloudLink,
  cloudKey,
  hash,
} from "./cloud-space.js";
import { setupSQL } from "./cloud-schema.js";
import { tripLink, readTripLink } from "./share-links.js";
import { downloadFile } from "./backups.js";
export class CloudUI {
  constructor({
    root,
    getTrips,
    applyTrips,
    getCurrent,
    importShared,
    notice,
    isBusy,
  }) {
    Object.assign(this, {
      root,
      getTrips,
      getCurrent,
      importShared,
      notice,
    });
    this.cloud = new CloudSpace({
      getTrips,
      applyTrips,
      isBusy,
      status: (message) => this.status(message),
    });
    root.innerHTML = `<div class="section-title"><h2>Vos voyages, sur tous vos appareils</h2><button class="quiet" data-cloud-action="close" aria-label="Fermer">✕</button></div><p>Un espace commun pour votre PC, votre téléphone et vos compagnons de voyage. Les voyages, réservations et billets de cet espace sont synchronisés. Le carnet de lieux non utilisés reste sur chaque appareil.</p><p id="cloud-dialog-status" role="status"></p><section id="cloud-connected" hidden><p id="cloud-access"></p><div class="tools-actions"><button class="primary" data-cloud-action="sync">Synchroniser maintenant</button><button class="secondary" data-cloud-action="reader">Créer un lien de lecture</button><button class="secondary" data-cloud-action="writer">Créer un lien de modification</button></div><p class="small muted">Choisissez le lien selon la personne. Toute personne qui reçoit un lien peut le transmettre : les droits sont liés au lien, sans compte nominatif. Le lien de modification permet aussi de supprimer des voyages. Les deux accès incluent les réservations et billets de tout l’espace. Pour partager seulement un itinéraire sans ces informations, utilisez le bouton dédié dans son dossier.</p><button class="quiet" data-cloud-action="disconnect">Déconnecter cet appareil</button><p class="small muted">Déconnecter conserve les copies locales et ne révoque pas les liens déjà transmis.</p></section><section id="cloud-join" hidden><h3>Rejoindre cet espace</h3><p id="cloud-join-access"></p><p>Les voyages de cet espace seront ajoutés à cet appareil. Vos autres dossiers restent locaux. N’ouvrez que les liens reçus d’une personne de confiance.</p><button class="primary" data-cloud-action="join">Rejoindre et récupérer les voyages</button><button class="quiet" data-cloud-action="cancel-join">Annuler</button></section><section id="cloud-setup"><h3>Première installation gratuite</h3><p>GitHub Pages ne stocke pas les voyages. Créez un projet sur <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase</a>, avec l’offre Free, puis saisissez son URL et sa clé publique depuis les réglages API. Un seul projet suffit pour vos appareils et vos invités.</p><form id="cloud-setup-form"><label>URL du projet<input name="url" type="url" required placeholder="https://votre-projet.supabase.co" autocomplete="off"></label><label>Clé publique publishable ou anon<input name="apiKey" required maxlength="3000" autocomplete="off" placeholder="sb_publishable_…"></label><p class="small muted">N’utilisez jamais la clé secrète ou service_role. La clé demandée est publique ; les accès aux voyages reposent sur des clés distinctes conservées dans vos liens.</p><button class="secondary">Préparer l’installation</button></form><div id="cloud-sql-step" hidden><p>Copiez ce script dans le SQL Editor de votre projet Supabase et exécutez-le. Puis revenez ici et activez la synchronisation. Le script crée les protections et un espace vide ; il ne contient pas vos billets.</p><label>Script d’installation<textarea id="cloud-setup-sql" readonly rows="8" spellcheck="false"></textarea></label><div class="tools-actions"><button class="secondary" data-cloud-action="sql">Télécharger le script SQL</button><button class="primary" data-cloud-action="activate">J’ai exécuté le script : connecter et sauvegarder mes voyages</button></div><p class="small muted">Cette activation envoie tous les dossiers actuels, avec leurs réservations et billets, dans votre espace chiffré. Les nouveaux voyages créés sur un appareil ayant un accès de modification seront ajoutés à cet espace.</p></div></section><section id="cloud-link-result" hidden><label id="cloud-link-label" for="cloud-link-value">Lien privé à transmettre</label><textarea id="cloud-link-value" readonly rows="4" spellcheck="false"></textarea><button class="primary" data-cloud-action="copy">Copier le lien</button><p id="cloud-link-help" class="small muted"></p></section>`;
    root.addEventListener("click", (e) => this.click(e));
    root.querySelector("form").addEventListener("submit", (e) => this.setup(e));
    this.timer = setInterval(() => this.cloud.sync(), 15000);
    addEventListener("online", () => this.cloud.sync());
    addEventListener("visibilitychange", () => {
      if (!document.hidden) this.cloud.sync();
    });
    addEventListener("storage", (event) => {
      if (
        this.cloud.state &&
        [cloudKey, "voyage.trips.v1"].includes(event.key)
      ) {
        this.status(
          "La synchronisation a changé dans un autre onglet. Rechargez cette page avant de modifier les voyages.",
        );
        this.cloud.suspended = true;
      }
    });
    this.receiveLink();
    addEventListener("hashchange", () => this.receiveLink());
    try {
      const draft = JSON.parse(
        localStorage.getItem("voyage.cloud.draft.v1") || "null",
      );
      if (draft) {
        this.draft = validateCloud(draft);
        this.restoreDraft();
      }
    } catch {
      this.status(
        "Le brouillon d’installation est illisible. Préparez une nouvelle installation.",
      );
    }
    this.update();
    if (this.cloud.state) setTimeout(() => this.cloud.sync(), 500);
  }
  receiveLink() {
    try {
      const incoming = readCloudLink(location.hash),
        shared = readTripLink(location.hash);
      if (!incoming && !shared) return;
      this.incoming = incoming;
      this.shared = shared;
      this.root.querySelector("[data-cloud-action=join]").textContent = shared
        ? "Ajouter ce voyage à mes dossiers"
        : "Rejoindre et récupérer les voyages";
      if (shared)
        this.root.querySelector("#cloud-join-access").textContent =
          "Copie d’un itinéraire partagé, sans réservations ni billets. Les modifications suivantes ne seront pas synchronisées.";
      this.root.querySelector("#cloud-link-result").hidden = true;
      this.open();
    } catch (error) {
      this.notice("Lien de partage invalide : " + error.message);
    }
  }
  async restoreDraft() {
    const draft = this.draft;
    if (!draft) return;
    const sql = await setupSQL(draft, hash);
    if (this.draft !== draft) return;
    const form = this.root.querySelector("#cloud-setup-form");
    form.elements.url.value = draft.url;
    form.elements.apiKey.value = draft.apiKey;
    this.root.querySelector("#cloud-setup-sql").value = sql;
    this.root.querySelector("#cloud-sql-step").hidden = false;
  }
  status(message) {
    const target = document.querySelector("#cloud-status");
    if (target) target.textContent = message;
    const node = this.root.querySelector("#cloud-dialog-status");
    if (node) node.textContent = message;
    dispatchEvent(new Event("voyage-cloud-state"));
  }
  update() {
    const state = this.cloud.state,
      join = !!(this.incoming || this.shared);
    this.root.querySelector("#cloud-connected").hidden = !state || join;
    this.root.querySelector("#cloud-join").hidden = !join;
    this.root.querySelector("#cloud-setup").hidden = !!state || join;
    this.root.querySelector("[data-cloud-action=writer]").hidden =
      !state?.config.writeToken;
    if (state)
      this.root.querySelector("#cloud-access").textContent = state.config
        .writeToken
        ? "Votre accès : lecture et modification. Les nouveaux voyages sont synchronisés."
        : "Votre accès : lecture seule. Les copies personnelles restent sur cet appareil.";
    if (this.incoming)
      this.root.querySelector("#cloud-join-access").textContent = this.incoming
        .writeToken
        ? "Ce lien permet de consulter et modifier tout l’espace, y compris les réservations et billets."
        : "Ce lien permet de consulter tout l’espace, y compris les réservations et billets. Il ne permet pas de modifier la copie en ligne.";
  }
  open() {
    this.update();
    if (!this.root.open) this.root.showModal();
  }
  async setup(event) {
    event.preventDefault();
    const button = event.target.querySelector("button");
    button.disabled = true;
    try {
      const values = new FormData(event.target);
      this.draft = newCloud(
        String(values.get("url")).trim(),
        String(values.get("apiKey")).trim(),
      );
      localStorage.setItem("voyage.cloud.draft.v1", JSON.stringify(this.draft));
      await this.restoreDraft();
      this.status(
        "Installation préparée. Exécutez le script dans votre projet Supabase. Aucun voyage n’a encore été envoyé.",
      );
    } catch (error) {
      this.status(error.message);
    } finally {
      button.disabled = false;
    }
  }
  showLink(url, label, help) {
    this.root.querySelector("#cloud-link-result").hidden = false;
    this.root.querySelector("#cloud-link-value").value = url;
    this.root.querySelector("#cloud-link-label").textContent = label;
    this.root.querySelector("#cloud-link-help").textContent = help;
    this.open();
  }
  shareTrip() {
    const trip = this.getCurrent();
    if (!trip) return;
    try {
      this.showLink(
        tripLink(trip),
        "Lien de cet itinéraire, sans billets",
        "Toute personne ayant ce lien peut consulter et importer cette copie. Les changements suivants ne sont pas synchronisés.",
      );
    } catch (error) {
      this.notice(error.message);
    }
  }
  async click(event) {
    const button = event.target.closest("[data-cloud-action]");
    if (!button) return;
    const action = button.dataset.cloudAction;
    button.disabled = true;
    try {
      switch (action) {
        case "close":
          this.root.close();
          break;
        case "sql":
          downloadFile(
            new Blob([this.root.querySelector("#cloud-setup-sql").value], {
              type: "text/plain",
            }),
            "voyage-installation.sql",
          );
          break;
        case "activate":
          if (!this.draft) throw new Error("Préparez d’abord l’installation.");
          await this.cloud.connect(this.draft, { create: true });
          this.draft = null;
          localStorage.removeItem("voyage.cloud.draft.v1");
          this.root.querySelector("#cloud-setup-sql").value = "";
          this.root.querySelector("#cloud-sql-step").hidden = true;
          this.showLink(
            cloudLink(this.cloud.state.config, true),
            "Votre lien privé pour le téléphone",
            "Conservez ce lien de modification pour retrouver vos voyages sur vos autres appareils. Il contient votre clé d’accès : gardez-le privé.",
          );
          break;
        case "join":
          if (
            !this.shared &&
            this.cloud.state &&
            this.cloud.state.config.id !== this.incoming?.id
          )
            throw new Error(
              "Annulez cette invitation puis déconnectez l’espace actuel avant de rejoindre un autre espace. Vos copies locales seront conservées.",
            );
          if (this.shared) {
            await this.importShared(this.shared);
            this.shared = null;
            this.root.close();
            location.hash = "#voyages";
            this.notice("Itinéraire ajouté en copie personnelle.");
          } else {
            await this.cloud.connect(this.incoming);
            this.incoming = null;
            this.root.close();
            location.hash = "#voyages";
            this.notice(
              "Espace connecté. Retrouvez les dossiers dans Mes voyages.",
            );
          }
          break;
        case "cancel-join":
          this.incoming = null;
          this.shared = null;
          history.replaceState(
            null,
            "",
            location.pathname + location.search + "#voyages",
          );
          break;
        case "reader":
        case "writer":
          this.showLink(
            cloudLink(this.cloud.state.config, action === "writer"),
            action === "writer"
              ? "Lien de modification de l’espace"
              : "Lien de lecture de l’espace",
            "Transmettez ce lien uniquement aux personnes auxquelles vous voulez donner cet accès. Toutes les données de l’espace sont accessibles par ce lien.",
          );
          break;
        case "copy":
          try {
            await navigator.clipboard.writeText(
              this.root.querySelector("#cloud-link-value").value,
            );
            this.status("Lien copié.");
          } catch {
            this.root.querySelector("#cloud-link-value").select();
            this.status("Sélectionnez puis copiez le lien affiché.");
          }
          break;
        case "sync":
          this.root.close();
          await this.cloud.sync();
          break;
        case "disconnect":
          if (
            !confirm(
              "Déconnecter cet appareil ? Les voyages locaux sont conservés et les liens déjà partagés restent valides.",
            )
          )
            break;
          this.cloud.disconnect();
          this.root.querySelector("#cloud-link-result").hidden = true;
          break;
      }
    } catch (error) {
      this.status(error.message);
    } finally {
      button.disabled = false;
      this.update();
    }
  }
}
