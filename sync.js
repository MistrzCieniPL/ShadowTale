/* ShadowTale — synchronizacja lokalnych plików produktów z backendem.
 * Pliki produktów i opisy są zapisywane na komputerze, w backend/products.
 * Supabase jest używany wyłącznie do uwierzytelnienia operacji administracyjnych.
 */
(function () {
  "use strict";

  const DEFAULT_API = "http://127.0.0.1:5500";
  const CHECK_INTERVAL = 30000;
  let lastHealth = null;

  function getApiUrl() {
    const config = window.CONFIG || {};
    const value = config.productFilesApi || config.apiBaseUrl || config.backendUrl || DEFAULT_API;
    return String(value).trim().replace(/\/+$/, "");
  }

  async function getAccessToken() {
    const client = window.db || window.supabaseClient || window.purchaseSupabase || null;
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      throw new Error("Brak aktywnej biblioteki/sesji Supabase wymaganej do operacji administracyjnej.");
    }
    const result = await client.auth.getSession();
    if (result.error) throw result.error;
    const token = result.data && result.data.session && result.data.session.access_token;
    if (!token) throw new Error("Zaloguj się ponownie — brak tokenu sesji.");
    return token;
  }

  async function request(endpoint, options) {
    const opts = options || {};
    const requiresAuth = opts.auth !== false;
    const headers = new Headers(opts.headers || {});
    if (!(opts.body instanceof FormData) && opts.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");
    if (requiresAuth) headers.set("Authorization", "Bearer " + await getAccessToken());

    const response = await fetch(getApiUrl() + endpoint, {
      method: opts.method || "GET",
      headers,
      body: opts.body == null ? undefined : opts.body,
      credentials: "include"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      throw new Error(result.error || ("Błąd backendu HTTP " + response.status));
    }
    return result;
  }

  async function getHealth() {
    return request("/api/health", { auth: false });
  }

  async function checkConnection() {
    try {
      lastHealth = await getHealth();
      window.dispatchEvent(new CustomEvent("shadowtale:sync-status", {
        detail: { online: true, health: lastHealth }
      }));
      return { online: true, health: lastHealth };
    } catch (error) {
      lastHealth = null;
      window.dispatchEvent(new CustomEvent("shadowtale:sync-status", {
        detail: { online: false, error: error.message }
      }));
      return { online: false, error: error.message };
    }
  }

  async function uploadProductFile(file, details) {
    if (!(file instanceof File)) throw new Error("Wybierz plik produktu.");
    const data = details || {};
    const body = new FormData();
    body.append("file", file);
    ["world", "category", "slug", "version", "description", "instructions"].forEach(key => {
      body.append(key, String(data[key] == null ? "" : data[key]));
    });
    return request("/api/admin/product-files", { method: "POST", body });
  }

  async function deleteProductFiles(details) {
    return request("/api/admin/product-files", {
      method: "DELETE",
      body: JSON.stringify(details || {})
    });
  }

  async function saveProductDescription(details) {
    return request("/api/admin/product-files/description", {
      method: "POST",
      body: JSON.stringify(details || {})
    });
  }

  async function getProduct(id) {
    if (id == null || String(id).trim() === "") throw new Error("Brak ID produktu.");
    return request("/api/products/" + encodeURIComponent(String(id)), { auth: false });
  }

  const api = {
    getApiUrl,
    getAccessToken,
    request,
    getHealth,
    checkConnection,
    uploadProductFile,
    deleteProductFiles,
    saveProductDescription,
    getProduct,
    getLastHealth: () => lastHealth
  };

  window.ShadowTaleSync = api;
  checkConnection();
  window.setInterval(checkConnection, CHECK_INTERVAL);
})();
