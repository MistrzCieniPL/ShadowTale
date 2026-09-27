import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

type JsonObject = Record<string, unknown>;

function response(
  body: JsonObject,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}

function ok(data: JsonObject = {}): Response {
  return response({
    success: true,
    ...data,
  });
}

function fail(
  message: string,
  status = 400,
  extra: JsonObject = {},
): Response {
  return response({
    success: false,
    error: message,
    ...extra,
  }, status);
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Obsługuje:
 * - role jako string
 * - JSON string
 * - tablicę
 * - JSONB
 * - pojedyncze role
 */
function parseRoles(profile: any): string[] {
  const result: string[] = [];

  const add = (value: unknown) => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      for (const item of value) add(item);
      return;
    }

    if (typeof value === "object") {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        if ((value as Record<string, unknown>)[key]) {
          result.push(normalize(key));
        }
      }
      return;
    }

    const text = String(value).trim();

    if (!text) return;

    if (
      (text.startsWith("[") && text.endsWith("]")) ||
      (text.startsWith("{") && text.endsWith("}"))
    ) {
      try {
        add(JSON.parse(text));
        return;
      } catch {
        // dalej jako zwykły tekst
      }
    }

    for (const part of text.split(",")) {
      const clean = normalize(part);
      if (clean) result.push(clean);
    }
  };

  add(profile?.roles);
  add(profile?.role);

  return [...new Set(result)];
}

function isOwner(profile: any): boolean {
  const roles = parseRoles(profile);

  return roles.includes("owner") ||
    roles.includes("właściciel") ||
    roles.includes("wlasciciel");
}

function isAdministrator(profile: any): boolean {
  const roles = parseRoles(profile);

  return isOwner(profile) ||
    roles.includes("admin") ||
    roles.includes("administrator");
}

function isBlocked(profile: any): boolean {
  return profile?.blocked === true;
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    throw new Error("Brak nagłówka Authorization.");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Brak tokenu sesji.");
  }

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    throw new Error("Nieprawidłowa sesja.");
  }

  const user = userData.user;

  /*
   * Nie pobieramy email z profiles.
   * Email istnieje w auth.users.
   */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("profileError:", profileError);
    throw new Error("Nie udało się pobrać profilu administratora.");
  }

  if (!profile) {
    throw new Error("Nie znaleziono profilu użytkownika.");
  }

  if (isBlocked(profile)) {
    throw new Error("To konto jest zablokowane.");
  }

  return {
    user,
    profile,
  };
}

async function requireAdmin(profile: any) {
  if (!isAdministrator(profile)) {
    throw new Error("Brak uprawnień administratora.");
  }
}

async function requireOwner(profile: any) {
  if (!isOwner(profile)) {
    throw new Error("Ta operacja wymaga uprawnień właściciela.");
  }
}

/* ============================================================
   AUDYT
   ============================================================ */

async function audit(
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string | null,
  details: JsonObject = {},
) {
  try {
    await supabase
      .from("audit_logs")
      .insert({
        actor_id: actorId,
        action,
        target_type: targetType ?? null,
        target_id: targetId ?? null,
        details,
      });
  } catch (error) {
    console.error("audit error:", error);
  }
}

/* ============================================================
   POWIADOMIENIA
   ============================================================ */

async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data: JsonObject = {},
) {
  const { data: notification, error } = await supabase
    .from("admin_notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      read: false,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("notification error:", error);
    throw new Error(
      `Nie udało się utworzyć powiadomienia: ${error.message}`,
    );
  }

  return notification;
}

/* ============================================================
   PRODUCT
   ============================================================ */

async function verifyProduct(
  actorId: string,
  productId: string,
  verified: boolean,
) {
  if (!productId) {
    throw new Error("Brak productId.");
  }

  const {
    data: product,
    error: findError,
  } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (!product) {
    throw new Error("Nie znaleziono produktu.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      file_verified: verified,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(
      `Nie udało się zmienić weryfikacji produktu: ${error.message}`,
    );
  }

  await audit(
    actorId,
    verified ? "verify_product" : "unverify_product",
    "product",
    productId,
    {
      verified,
      product_name: product.name ?? null,
    },
  );

  return {
    product,
    verified,
  };
}

async function blockProduct(
  actorId: string,
  productId: string,
  blocked: boolean,
) {
  if (!productId) {
    throw new Error("Brak productId.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      blocked,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }

  await audit(
    actorId,
    blocked ? "block_product" : "unblock_product",
    "product",
    productId,
    { blocked },
  );

  return {
    productId,
    blocked,
  };
}

async function deleteProduct(
  actorId: string,
  productId: string,
) {
  if (!productId) {
    throw new Error("Brak productId.");
  }

  const {
    data: product,
    error: findError,
  } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (!product) {
    throw new Error("Nie znaleziono produktu.");
  }

  /*
   * Usuwamy plik z bucketa, jeżeli istnieje ścieżka.
   */
  const filePath =
    product.file_path ??
    product.storage_path ??
    null;

  if (filePath) {
    const { error: storageError } = await supabase
      .storage
      .from("products")
      .remove([String(filePath)]);

    if (storageError) {
      console.warn(
        "Nie udało się usunąć pliku produktu:",
        storageError.message,
      );
    }
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    throw new Error(
      `Nie udało się usunąć produktu: ${error.message}`,
    );
  }

  await audit(
    actorId,
    "delete_product",
    "product",
    productId,
    {
      product_name: product.name ?? null,
    },
  );

  return {
    productId,
  };
}

/* ============================================================
   TICKETS
   ============================================================ */

async function deleteTicket(
  actorId: string,
  ticketId: string,
) {
  if (!ticketId) {
    throw new Error("Brak ticketId.");
  }

  /*
   * Najpierw wiadomości.
   */
  const { error: messagesError } = await supabase
    .from("ticket_messages")
    .delete()
    .eq("ticket_id", ticketId);

  if (
    messagesError &&
    !messagesError.message.toLowerCase().includes("does not exist")
  ) {
    throw new Error(
      `Nie udało się usunąć wiadomości ticketu: ${messagesError.message}`,
    );
  }

  /*
   * Opcjonalne ticket_actions.
   * Jeżeli tabela nie istnieje, ignorujemy błąd.
   */
  try {
    await supabase
      .from("ticket_actions")
      .delete()
      .eq("ticket_id", ticketId);
  } catch {
    // opcjonalna tabela
  }

  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", ticketId);

  if (error) {
    throw new Error(
      `Nie udało się usunąć ticketu: ${error.message}`,
    );
  }

  await audit(
    actorId,
    "delete_ticket",
    "ticket",
    ticketId,
  );

  return {
    ticketId,
  };
}

async function updateTicket(
  actorId: string,
  payload: JsonObject,
) {
  const ticketId = String(
    payload.ticket_id ??
    payload.ticketId ??
    payload.id ??
    "",
  );

  if (!ticketId) {
    throw new Error("Brak ticketId.");
  }

  const update: JsonObject = {};

  if (payload.status !== undefined) {
    update.status = payload.status;
  }

  if (payload.assigned_to !== undefined) {
    update.assigned_to = payload.assigned_to;
  }

  if (payload.assignedTo !== undefined) {
    update.assigned_to = payload.assignedTo;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("Brak danych do aktualizacji ticketu.");
  }

  const { data, error } = await supabase
    .from("tickets")
    .update(update)
    .eq("id", ticketId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      `Nie udało się zaktualizować ticketu: ${error.message}`,
    );
  }

  await audit(
    actorId,
    "update_ticket",
    "ticket",
    ticketId,
    update,
  );

  return {
    ticket: data,
  };
}

async function replyToTicket(
  actorId: string,
  payload: JsonObject,
) {
  const ticketId = String(
    payload.ticket_id ??
    payload.ticketId ??
    "",
  );

  const message = String(
    payload.message ??
    payload.content ??
    "",
  ).trim();

  if (!ticketId) {
    throw new Error("Brak ticketId.");
  }

  if (!message) {
    throw new Error("Wiadomość jest pusta.");
  }

  const { data, error } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      user_id: actorId,
      message,
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      `Nie udało się wysłać odpowiedzi: ${error.message}`,
    );
  }

  await audit(
    actorId,
    "ticket_reply",
    "ticket",
    ticketId,
  );

  return {
    message: data,
  };
}

/* ============================================================
   UŻYTKOWNICY
   ============================================================ */

async function blockUser(
  actorId: string,
  userId: string,
  blocked: boolean,
) {
  if (!userId) {
    throw new Error("Brak userId.");
  }

  const update: JsonObject = {
    blocked,
  };

  if (blocked) {
    update.blocked_at = new Date().toISOString();
    update.blocked_by = actorId;
  } else {
    update.blocked_at = null;
    update.blocked_by = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId);

  if (error) {
    throw new Error(
      `Nie udało się zmienić blokady użytkownika: ${error.message}`,
    );
  }

  await audit(
    actorId,
    blocked ? "block_user" : "unblock_user",
    "user",
    userId,
  );

  return {
    userId,
    blocked,
  };
}

async function deleteUser(
  actorId: string,
  userId: string,
) {
  if (!userId) {
    throw new Error("Brak userId.");
  }

  /*
   * Najpierw profil.
   */
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    throw new Error(
      `Nie udało się usunąć profilu: ${profileError.message}`,
    );
  }

  /*
   * Następnie konto Auth.
   */
  const { error: authError } =
    await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    throw new Error(
      `Profil został usunięty, ale konto Auth nie zostało usunięte: ${authError.message}`,
    );
  }

  await audit(
    actorId,
    "delete_user",
    "user",
    userId,
  );

  return {
    userId,
  };
}

/* ============================================================
   ROLE UŻYTKOWNIKA
   ============================================================ */

async function updateUserRoles(
  actorId: string,
  userId: string,
  roles: unknown,
) {
  if (!userId) {
    throw new Error("Brak userId.");
  }

  if (!Array.isArray(roles)) {
    throw new Error("roles musi być tablicą.");
  }

  const cleanRoles = [
    ...new Set(
      roles
        .map((role) => String(role).trim())
        .filter(Boolean),
    ),
  ];

  /*
   * Najpierw próbujemy JSONB.
   */
  let { error } = await supabase
    .from("profiles")
    .update({
      roles: cleanRoles,
    })
    .eq("id", userId);

  /*
   * Jeżeli istniejąca kolumna roles jest TEXT,
   * próbujemy zapisać JSON jako tekst.
   */
  if (error) {
    const retry = await supabase
      .from("profiles")
      .update({
        roles: JSON.stringify(cleanRoles),
      })
      .eq("id", userId);

    error = retry.error;
  }

  if (error) {
    throw new Error(
      `Nie udało się zmienić ról: ${error.message}`,
    );
  }

  /*
   * Zachowujemy pierwszą rolę również w starszym polu role,
   * jeśli jest używane przez istniejący panel.
   */
  if (cleanRoles.length > 0) {
    const roleResult = await supabase
      .from("profiles")
      .update({
        role: cleanRoles[0],
      })
      .eq("id", userId);

    if (roleResult.error) {
      console.warn(
        "Nie udało się zsynchronizować profiles.role:",
        roleResult.error.message,
      );
    }
  }

  await audit(
    actorId,
    "update_user_roles",
    "user",
    userId,
    {
      roles: cleanRoles,
    },
  );

  return {
    userId,
    roles: cleanRoles,
  };
}

/* ============================================================
   POWIADOMIENIA
   ============================================================ */

async function getNotifications(
  userId: string,
) {
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  if (error) {
    throw new Error(
      `Nie udało się pobrać powiadomień: ${error.message}`,
    );
  }

  return {
    notifications: data ?? [],
  };
}

async function markNotificationRead(
  userId: string,
  notificationId: string,
) {
  if (!notificationId) {
    throw new Error("Brak notificationId.");
  }

  const { error } = await supabase
    .from("admin_notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    notificationId,
  };
}

async function markAllNotificationsRead(
  userId: string,
) {
  const { error } = await supabase
    .from("admin_notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    throw new Error(error.message);
  }

  return {
    userId,
  };
}

/* ============================================================
   PROPOZYCJE PODZIAŁU
   ============================================================ */

async function createShareProposal(
  actorId: string,
  payload: JsonObject,
) {
  const productId =
    payload.product_id ??
    payload.productId ??
    null;

  const receiverId =
    payload.receiver_id ??
    payload.receiverId;

  const proposerPercent = Number(
    payload.proposer_percent ??
    payload.proposerPercent ??
    0,
  );

  const receiverPercent = Number(
    payload.receiver_percent ??
    payload.receiverPercent ??
    0,
  );

  if (!receiverId) {
    throw new Error("Brak odbiorcy.");
  }

  if (
    proposerPercent < 0 ||
    receiverPercent < 0 ||
    proposerPercent + receiverPercent !== 100
  ) {
    throw new Error(
      "Procenty muszą razem wynosić dokładnie 100%.",
    );
  }

  const { data, error } = await supabase
    .from("admin_share_proposals")
    .insert({
      product_id: productId,
      proposer_id: actorId,
      receiver_id: receiverId,
      proposer_percent: proposerPercent,
      receiver_percent: receiverPercent,
      status: "pending",
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      `Nie udało się utworzyć propozycji: ${error.message}`,
    );
  }

  await createNotification(
    String(receiverId),
    "share_proposal",
    "Nowa propozycja podziału",
    "Otrzymałeś nową propozycję podziału zarobku.",
    {
      proposal_id: data?.id ?? null,
      product_id: productId,
    },
  );

  await audit(
    actorId,
    "create_share_proposal",
    "share_proposal",
    data?.id ?? null,
  );

  return {
    proposal: data,
  };
}

async function respondShareProposal(
  actorId: string,
  proposalId: string,
  accepted: boolean,
) {
  if (!proposalId) {
    throw new Error("Brak proposalId.");
  }

  const {
    data: proposal,
    error: findError,
  } = await supabase
    .from("admin_share_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (!proposal) {
    throw new Error("Nie znaleziono propozycji.");
  }

  if (String(proposal.receiver_id) !== actorId) {
    throw new Error(
      "Nie możesz odpowiedzieć na tę propozycję.",
    );
  }

  if (proposal.status !== "pending") {
    throw new Error(
      "Ta propozycja została już rozpatrzona.",
    );
  }

  const { error } = await supabase
    .from("admin_share_proposals")
    .update({
      status: accepted ? "accepted" : "rejected",
      responded_at: new Date().toISOString(),
    })
    .eq("id", proposalId);

  if (error) {
    throw new Error(error.message);
  }

  await createNotification(
    String(proposal.proposer_id),
    "share_proposal_response",
    accepted
      ? "Propozycja zaakceptowana"
      : "Propozycja odrzucona",
    accepted
      ? "Twoja propozycja podziału została zaakceptowana."
      : "Twoja propozycja podziału została odrzucona.",
    {
      proposal_id: proposalId,
    },
  );

  await audit(
    actorId,
    accepted
      ? "accept_share_proposal"
      : "reject_share_proposal",
    "share_proposal",
    proposalId,
  );

  return {
    proposalId,
    status: accepted ? "accepted" : "rejected",
  };
}

/* ============================================================
   ZMIANY PROFILU
   ============================================================ */

async function requestProfileChange(
  actorId: string,
  payload: JsonObject,
) {
  const targetUserId = String(
    payload.user_id ??
    payload.userId ??
    actorId,
  );

  const field = String(
    payload.field ??
    payload.type ??
    "",
  ).trim();

  const value = payload.value;

  if (!field) {
    throw new Error("Brak rodzaju zmiany.");
  }

  const allowedFields = [
    "username",
    "avatar_url",
    "email",
    "password",
  ];

  if (!allowedFields.includes(field)) {
    throw new Error("Nieobsługiwany rodzaj zmiany.");
  }

  await createNotification(
    targetUserId,
    "profile_change_request",
    "Prośba o zmianę danych",
    `Administrator otrzymał prośbę dotyczącą pola: ${field}.`,
    {
      requested_by: actorId,
      field,
      value: field === "password"
        ? null
        : value ?? null,
    },
  );

  await audit(
    actorId,
    "request_profile_change",
    "user",
    targetUserId,
    {
      field,
    },
  );

  return {
    requested: true,
    field,
  };
}

/* ============================================================
   ZMIANA HASŁA AUTH
   ============================================================ */

async function changeUserPassword(
  actorId: string,
  userId: string,
  password: string,
) {
  if (!userId) {
    throw new Error("Brak userId.");
  }

  if (!password || password.length < 8) {
    throw new Error(
      "Hasło musi mieć co najmniej 8 znaków.",
    );
  }

  const { error } =
    await supabase.auth.admin.updateUserById(
      userId,
      {
        password,
      },
    );

  if (error) {
    throw new Error(
      `Nie udało się zmienić hasła: ${error.message}`,
    );
  }

  await audit(
    actorId,
    "change_user_password",
    "user",
    userId,
  );

  return {
    userId,
  };
}

/* ============================================================
   HASŁO PANELU ADMINISTRACYJNEGO
   ============================================================ */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function hashPanelPassword(
  password: string,
  salt: Uint8Array,
): Promise<string> {
  const encoder = new TextEncoder();

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 210000,
        hash: "SHA-256",
      },
      keyMaterial,
      256,
    );

  return bytesToBase64(
    new Uint8Array(bits),
  );
}

async function panelPasswordStatus(
  userId: string,
) {
  const { data, error } = await supabase
    .from("admin_panel_credentials")
    .select("user_id, reset_required, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    exists: !!data,
    reset_required: data?.reset_required ?? false,
  };
}

async function panelPasswordSet(
  userId: string,
  password: string,
) {
  if (!password || password.length < 8) {
    throw new Error(
      "Hasło panelu musi mieć co najmniej 8 znaków.",
    );
  }

  const salt = crypto.getRandomValues(
    new Uint8Array(16),
  );

  const passwordHash =
    await hashPanelPassword(password, salt);

  const { error } = await supabase
    .from("admin_panel_credentials")
    .upsert({
      user_id: userId,
      password_hash: passwordHash,
      salt: bytesToBase64(salt),
      reset_required: false,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(
      `Nie udało się zapisać hasła panelu: ${error.message}`,
    );
  }

  return {
    saved: true,
  };
}

async function panelPasswordVerify(
  userId: string,
  password: string,
) {
  const { data, error } = await supabase
    .from("admin_panel_credentials")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      verified: false,
      setup_required: true,
    };
  }

  if (data.reset_required) {
    return {
      verified: false,
      reset_required: true,
    };
  }

  if (!data.password_hash || !data.salt) {
    return {
      verified: false,
      setup_required: true,
    };
  }

  const salt =
    base64ToBytes(String(data.salt));

  const hash =
    await hashPanelPassword(password, salt);

  return {
    verified:
      hash === String(data.password_hash),
  };
}

async function resetPanelPassword(
  actorId: string,
  targetUserId: string,
) {
  await supabase
    .from("admin_panel_credentials")
    .upsert({
      user_id: targetUserId,
      reset_required: true,
      updated_at: new Date().toISOString(),
    });

  await audit(
    actorId,
    "reset_admin_panel_password",
    "user",
    targetUserId,
  );

  return {
    reset_required: true,
  };
}

/* ============================================================
   IP BANS
   ============================================================ */

async function banIp(
  actorId: string,
  payload: JsonObject,
) {
  const ip = String(
    payload.ip ?? "",
  ).trim();

  if (!ip) {
    throw new Error("Brak adresu IP.");
  }

  const { data, error } = await supabase
    .from("ip_bans")
    .upsert({
      ip,
      reason: payload.reason ?? null,
      created_by: actorId,
      expires_at: payload.expires_at ??
        payload.expiresAt ??
        null,
    }, {
      onConflict: "ip",
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      `Nie udało się zablokować IP: ${error.message}`,
    );
  }

  await audit(
    actorId,
    "ban_ip",
    "ip",
    null,
    { ip },
  );

  return {
    ban: data,
  };
}

async function unbanIp(
  actorId: string,
  ip: string,
) {
  if (!ip) {
    throw new Error("Brak adresu IP.");
  }

  const { error } = await supabase
    .from("ip_bans")
    .delete()
    .eq("ip", ip);

  if (error) {
    throw new Error(
      `Nie udało się odblokować IP: ${error.message}`,
    );
  }

  await audit(
    actorId,
    "unban_ip",
    "ip",
    null,
    { ip },
  );

  return {
    ip,
  };
}

/* ============================================================
   ROLE ADMINISTRACYJNE
   ============================================================ */

async function listRoles() {
  /*
   * Nie zakładamy konkretnego klucza "key" / "role_key".
   * Pobieramy cały rekord.
   */
  const { data, error } = await supabase
    .from("admin_roles")
    .select("*")
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Nie udało się pobrać ról: ${error.message}`,
    );
  }

  return {
    roles: data ?? [],
  };
}

/* ============================================================
   DISPATCH
   ============================================================ */

async function dispatch(
  action: string,
  payload: JsonObject,
  user: any,
  profile: any,
) {
  const normalizedAction =
    normalize(action);

  /*
   * ----------------------------------------------------------
   * ROLE / INFORMACJE
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "list_roles" ||
    normalizedAction === "get_roles"
  ) {
    await requireAdmin(profile);

    return listRoles();
  }

  /*
   * ----------------------------------------------------------
   * PRODUKTY
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "verify_product" ||
    normalizedAction === "set_product_verified"
  ) {
    await requireAdmin(profile);

    const productId = String(
      payload.product_id ??
      payload.productId ??
      "",
    );

    return verifyProduct(
      user.id,
      productId,
      true,
    );
  }

  if (
    normalizedAction === "unverify_product"
  ) {
    await requireAdmin(profile);

    const productId = String(
      payload.product_id ??
      payload.productId ??
      "",
    );

    return verifyProduct(
      user.id,
      productId,
      false,
    );
  }

  if (
    normalizedAction === "block_product"
  ) {
    await requireAdmin(profile);

    const productId = String(
      payload.product_id ??
      payload.productId ??
      "",
    );

    return blockProduct(
      user.id,
      productId,
      true,
    );
  }

  if (
    normalizedAction === "unblock_product"
  ) {
    await requireAdmin(profile);

    const productId = String(
      payload.product_id ??
      payload.productId ??
      "",
    );

    return blockProduct(
      user.id,
      productId,
      false,
    );
  }

  if (
    normalizedAction === "delete_product"
  ) {
    await requireAdmin(profile);

    const productId = String(
      payload.product_id ??
      payload.productId ??
      "",
    );

    return deleteProduct(
      user.id,
      productId,
    );
  }

  /*
   * ----------------------------------------------------------
   * TICKETY
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "delete_ticket" ||
    normalizedAction === "ticket_delete"
  ) {
    await requireAdmin(profile);

    const ticketId = String(
      payload.ticket_id ??
      payload.ticketId ??
      payload.id ??
      "",
    );

    return deleteTicket(
      user.id,
      ticketId,
    );
  }

  if (
    normalizedAction === "ticket_action" ||
    normalizedAction === "update_ticket"
  ) {
    await requireAdmin(profile);

    return updateTicket(
      user.id,
      payload,
    );
  }

  if (
    normalizedAction === "ticket_reply"
  ) {
    await requireAdmin(profile);

    return replyToTicket(
      user.id,
      payload,
    );
  }

  /*
   * ----------------------------------------------------------
   * UŻYTKOWNICY
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "block_user"
  ) {
    await requireAdministrator(profile);

    const targetId = String(
      payload.user_id ??
      payload.userId ??
      "",
    );

    return blockUser(
      user.id,
      targetId,
      true,
    );
  }

  if (
    normalizedAction === "unblock_user"
  ) {
    await requireAdministrator(profile);

    const targetId = String(
      payload.user_id ??
      payload.userId ??
      "",
    );

    return blockUser(
      user.id,
      targetId,
      false,
    );
  }

  if (
    normalizedAction === "delete_user"
  ) {
    await requireOwner(profile);

    const targetId = String(
      payload.user_id ??
      payload.userId ??
      "",
    );

    if (targetId === user.id) {
      throw new Error(
        "Nie możesz usunąć własnego konta z tego panelu.",
      );
    }

    return deleteUser(
      user.id,
      targetId,
    );
  }

  if (
    normalizedAction === "update_user_roles"
  ) {
    await requireOwner(profile);

    const targetId = String(
      payload.user_id ??
      payload.userId ??
      "",
    );

    return updateUserRoles(
      user.id,
      targetId,
      payload.roles,
    );
  }

  /*
   * ----------------------------------------------------------
   * POWIADOMIENIA
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "get_notifications"
  ) {
    await requireAdmin(profile);

    return getNotifications(user.id);
  }

  if (
    normalizedAction === "mark_notification_read"
  ) {
    await requireAdmin(profile);

    const notificationId = String(
      payload.notification_id ??
      payload.notificationId ??
      "",
    );

    return markNotificationRead(
      user.id,
      notificationId,
    );
  }

  if (
    normalizedAction === "mark_all_notifications_read"
  ) {
    await requireAdmin(profile);

    return markAllNotificationsRead(
      user.id,
    );
  }

  /*
   * ----------------------------------------------------------
   * PODZIAŁ ZAROBKÓW
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "create_share_proposal"
  ) {
    await requireAdmin(profile);

    return createShareProposal(
      user.id,
      payload,
    );
  }

  if (
    normalizedAction === "respond_share_proposal"
  ) {
    await requireAdmin(profile);

    const proposalId = String(
      payload.proposal_id ??
      payload.proposalId ??
      "",
    );

    const accepted =
      payload.accepted === true ||
      payload.status === "accepted";

    return respondShareProposal(
      user.id,
      proposalId,
      accepted,
    );
  }

  /*
   * ----------------------------------------------------------
   * ZMIANY PROFILU
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "request_profile_change"
  ) {
    await requireAdmin(profile);

    return requestProfileChange(
      user.id,
      payload,
    );
  }

  /*
   * ----------------------------------------------------------
   * HASŁO UŻYTKOWNIKA
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "change_user_password"
  ) {
    await requireOwner(profile);

    const targetId = String(
      payload.user_id ??
      payload.userId ??
      "",
    );

    const password = String(
      payload.password ?? "",
    );

    return changeUserPassword(
      user.id,
      targetId,
      password,
    );
  }

  /*
   * ----------------------------------------------------------
   * HASŁO PANELU
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "admin_panel_password_status"
  ) {
    await requireAdmin(profile);

    return panelPasswordStatus(
      user.id,
    );
  }

  if (
    normalizedAction === "admin_panel_password_set"
  ) {
    await requireAdmin(profile);

    return panelPasswordSet(
      user.id,
      String(payload.password ?? ""),
    );
  }

  if (
    normalizedAction === "admin_panel_password_verify"
  ) {
    await requireAdmin(profile);

    return panelPasswordVerify(
      user.id,
      String(payload.password ?? ""),
    );
  }

  if (
    normalizedAction === "admin_panel_password_reset" ||
    normalizedAction === "reset_admin_panel_password"
  ) {
    await requireOwner(profile);

    const targetId = String(
      payload.user_id ??
      payload.userId ??
      "",
    );

    if (targetId === user.id) {
      throw new Error(
        "Użyj ustawienia hasła zamiast resetowania własnego konta.",
      );
    }

    return resetPanelPassword(
      user.id,
      targetId,
    );
  }

  /*
   * ----------------------------------------------------------
   * IP
   * ----------------------------------------------------------
   */

  if (
    normalizedAction === "ban_ip"
  ) {
    await requireOwner(profile);

    return banIp(
      user.id,
      payload,
    );
  }

  if (
    normalizedAction === "unban_ip"
  ) {
    await requireOwner(profile);

    return unbanIp(
      user.id,
      String(payload.ip ?? ""),
    );
  }

  throw new Error(
    `Nieznana akcja: ${action}`,
  );
}

/* ============================================================
   HELPER — ADMINISTRATOR
   ============================================================ */

async function requireAdministrator(
  profile: any,
) {
  if (!isAdministrator(profile)) {
    throw new Error(
      "Brak uprawnień administratora.",
    );
  }
}

/* ============================================================
   HTTP
   ============================================================ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  }

  if (req.method !== "POST") {
    return fail(
      "Dozwolona jest tylko metoda POST.",
      405,
    );
  }

  try {
    const {
      user,
      profile,
    } = await authenticate(req);

    const body =
      await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return fail(
        "Nieprawidłowe dane JSON.",
        400,
      );
    }

    const action = String(
      (body as any).action ?? "",
    ).trim();

    if (!action) {
      return fail(
        "Brak action.",
        400,
      );
    }

    const payload =
      ((body as any).payload &&
        typeof (body as any).payload === "object")
        ? (body as any).payload
        : body as JsonObject;

    const result =
      await dispatch(
        action,
        payload,
        user,
        profile,
      );

    return ok(result);
  } catch (error) {
    console.error(
      "admin-actions error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Wystąpił nieznany błąd.";

    const status =
      message.includes("Brak uprawnień")
        ? 403
        : message.includes("sesja")
          ? 401
          : 400;

    return fail(
      message,
      status,
    );
  }
});
