/* =========================================================
   SHADOWTALE.PL
   APP.JS
   Supabase + logowanie + profil + panel admina + produkty
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    /* =====================================================
       KONFIGURACJA
       ===================================================== */

    const CONFIG =
        window.CONFIG ||
        window.SHADOWTALE_CONFIG ||
        {};

    const SUPABASE_URL =
        CONFIG.supabaseUrl ||
        CONFIG.SUPABASE_URL ||
        CONFIG.supabase_url;

    const SUPABASE_KEY =
        CONFIG.supabaseKey ||
        CONFIG.SUPABASE_ANON_KEY ||
        CONFIG.SUPABASE_PUBLISHABLE_KEY ||
        CONFIG.supabaseAnonKey ||
        CONFIG.publishableKey;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error(
            "ShadowTale: brak konfiguracji Supabase."
        );
        return;
    }

    if (!window.supabase) {
        console.error(
            "ShadowTale: biblioteka Supabase nie została załadowana."
        );
        return;
    }

    /* =====================================================
       SUPABASE
       WAŻNE:
       Nie ustawiamy własnego storageKey.
       Dzięki temu login.html, index.html, konto.html
       i app.js korzystają z tej samej sesji Supabase.
       ===================================================== */

    let client;

    try {
        client = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );
    } catch (error) {
        console.error(
            "ShadowTale: nie udało się uruchomić Supabase.",
            error
        );
        return;
    }

    window.supabaseClient = client;
    window.authClient = client;

    /* =====================================================
       ELEMENTY KONTA
       ===================================================== */

    const accountButton =
        document.getElementById("account-button");

    const accountName =
        document.getElementById("account-name");

    const accountAvatar =
        document.getElementById("account-avatar");

    const panelButton =
        document.getElementById("panel-button");

    /*
     * Rangi mają być przechowywane w profiles.role.
     *
     * Na razie obsługujemy jedną rangę w profiles.role.
     * Wielorangi można później podłączyć przez user_roles.
     */

    const ADMIN_ROLES = [
        "owner",
        "admin",
        "programista",
        "moderator",
        "support"
    ];

    let currentUser = null;
    let currentProfile = null;
    let currentUsername = "";

    /* =====================================================
       POMOCNICZE
       ===================================================== */

    function escapeHTML(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalize(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ł/g, "l")
            .trim();
    }

    function normalizeRole(value) {
        return normalize(value)
            .replace(/[\s-]+/g, "_");
    }

    function slugify(text) {
        return String(text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ł/g, "l")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 100);
    }

    function formatPrice(
        price,
        isFree = false
    ) {
        if (isFree) {
            return "DARMOWY";
        }

        return Number(price || 0)
            .toLocaleString(
                "pl-PL",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            ) + " zł";
    }

    function formatDate(date) {
        if (!date) {
            return "-";
        }

        try {
            return new Date(date)
                .toLocaleString("pl-PL");
        } catch {
            return "-";
        }
    }

    /* =====================================================
       NAZWY RANG
       ===================================================== */

    const ROLE_LABELS = {
        owner: "👑 Właściciel",
        admin: "🛡️ Administrator",
        programista: "💻 Programista",
        moderator: "🔨 Moderator",
        support: "🎧 Support",
        early_access: "⚡ Early Access",
        earlyaccess: "⚡ Early Access",
        media: "🎨 Media",
        tworca: "🎨 Twórca",
        creator: "🎨 Twórca",
        friend: "💜 Friend",
        winner: "🏆 Wygrany konkurs",
        content_winner: "🏆 Wygrany konkurs",
        klient: "👤 Klient",
        client: "👤 Klient",
        user: "👤 Klient"
    };

    function getRoleLabel(role) {

        const normalized =
            normalizeRole(role);

        return (
            ROLE_LABELS[normalized] ||
            "👤 Klient"
        );
    }

    function getRoleName(role) {

        const normalized =
            normalizeRole(role);

        return (
            ROLE_LABELS[normalized] ||
            String(role || "Klient")
        );
    }

    /* =====================================================
       PROFIL / NICK GRACZA
       ===================================================== */

    function getUsernameFromUser(user) {

        if (!user) {
            return "";
        }

        const metadata =
            user.user_metadata || {};

        return (
            currentProfile?.username ||
            metadata.username ||
            metadata.nick ||
            metadata.nickname ||
            metadata.name ||
            metadata.display_name ||
            metadata.full_name ||
            (
                user.email
                    ? user.email.split("@")[0]
                    : ""
            ) ||
            ""
        );
    }

    /* =====================================================
       AKTUALNY UŻYTKOWNIK
       ===================================================== */

    async function getCurrentUser() {

        try {

            const {
                data,
                error
            } = await client.auth.getUser();

            if (error) {

                console.warn(
                    "ShadowTale: getUser:",
                    error
                );

                return null;
            }

            return data?.user || null;

        } catch (error) {

            console.warn(
                "ShadowTale: błąd getCurrentUser:",
                error
            );

            return null;
        }
    }

    /* =====================================================
       POBIERANIE PROFILU
       ===================================================== */

    async function getProfile(userId) {

        if (!userId) {
            return null;
        }

        try {

            const {
                data,
                error
            } = await client
                .from("profiles")
                .select(
                    "username, avatar_url, role"
                )
                .eq("id", userId)
                .maybeSingle();

            if (error) {

                console.error(
                    "ShadowTale: błąd pobierania profilu:",
                    error
                );

                return null;
            }

            return data || null;

        } catch (error) {

            console.error(
                "ShadowTale: wyjątek podczas pobierania profilu:",
                error
            );

            return null;
        }
    }

    /* =====================================================
       WYLOGOWANY
       ===================================================== */

    function showLoggedOut() {

        currentUser = null;
        currentProfile = null;
        currentUsername = "";

        window.ShadowTaleUsername = "";

        if (accountButton) {
            accountButton.href =
                "login.html";
        }

        if (accountName) {
            accountName.textContent =
                "Nick gracza";
            accountName.title =
                "";
        }

        if (accountAvatar) {

            accountAvatar.src =
                "assets/logo.png";

            accountAvatar.alt =
                "Avatar";
        }

        if (panelButton) {

            panelButton.style.display =
                "none";
        }
    }

    /* =====================================================
       AKTUALIZACJA ELEMENTÓW KONTA
       ===================================================== */

    function updateAccountPage(
        username,
        user
    ) {

        const usernameElements = [
            document.getElementById(
                "account-username"
            ),
            document.getElementById(
                "account-page-username"
            )
        ];

        usernameElements.forEach(
            element => {

                if (element) {
                    element.textContent =
                        username || "-";
                }
            }
        );

        const emailElements = [
            document.getElementById(
                "account-email"
            ),
            document.getElementById(
                "account-page-email"
            )
        ];

        emailElements.forEach(
            element => {

                if (element) {
                    element.textContent =
                        user?.email || "-";
                }
            }
        );

        const roleElement =
            document.getElementById(
                "account-page-role"
            );

        if (roleElement) {

            roleElement.textContent =
                getRoleLabel(
                    currentProfile?.role
                );
        }

        const statusElement =
            document.getElementById(
                "account-page-status"
            );

        if (statusElement) {

            /*
             * profiles nie musi posiadać kolumny status.
             * Aktywna sesja oznacza, że konto jest aktywne.
             */

            statusElement.textContent =
                currentUser
                    ? "Aktywne"
                    : "Nieaktywne";
        }
    }

    /* =====================================================
       ZALOGOWANY
       ===================================================== */

    async function showLoggedIn(user) {

        if (!user) {
            showLoggedOut();
            return;
        }

        currentUser = user;

        currentProfile =
            await getProfile(user.id);

        const username =
            getUsernameFromUser(user);

        currentUsername =
            String(username || "").trim();

        window.ShadowTaleUsername =
            currentUsername;

        /*
         * Jeżeli profil nie istnieje, nie zmieniamy sesji
         * na wylogowaną. Użytkownik nadal jest zalogowany.
         */

        if (accountButton) {

            accountButton.href =
                "konto.html";
        }

        if (accountName) {

            accountName.textContent =
                currentUsername ||
                "Nick gracza";

            accountName.title =
                currentUsername;
        }

        if (accountAvatar) {

            const avatar =
                currentProfile?.avatar_url;

            accountAvatar.src =
                avatar ||
                "assets/logo.png";

            accountAvatar.alt =
                `Avatar ${currentUsername || "gracza"}`;

            accountAvatar.onerror =
                () => {

                    accountAvatar.src =
                        "assets/logo.png";
                };
        }

        updateAccountPage(
            currentUsername,
            user
        );

        await checkAdminAccess(user);
    }

    /* =====================================================
       ADMIN
       ===================================================== */

    function hidePanel() {

        if (panelButton) {

            panelButton.style.display =
                "none";
        }
    }

    async function checkAdminAccess(user) {

        hidePanel();

        if (!user) {
            return false;
        }

        let profile =
            currentProfile;

        if (!profile) {

            profile =
                await getProfile(
                    user.id
                );

            currentProfile =
                profile;
        }

        const role =
            normalizeRole(
                profile?.role
            );

        const allowed =
            ADMIN_ROLES
                .map(normalizeRole)
                .includes(role);

        if (
            allowed &&
            panelButton
        ) {

            panelButton.style.display =
                "inline-flex";

            panelButton.href =
                "admin.html";

            return true;
        }

        return false;
    }

    /* =====================================================
       PUBLICZNE API SHADOWTALE
       ===================================================== */

    window.ShadowTale = {

        getUser() {
            return currentUser;
        },

        getProfile() {
            return currentProfile;
        },

        getUsername() {
            return currentUsername;
        },

        getDisplayName() {
            return currentUsername;
        },

        getRoles() {

            const role =
                currentProfile?.role;

            return role
                ? [role]
                : [];
        },

        getRole() {

            return currentProfile?.role ||
                "user";
        },

        getRoleLabel() {

            return getRoleLabel(
                currentProfile?.role
            );
        },

        isStaff() {

            const role =
                normalizeRole(
                    currentProfile?.role
                );

            return ADMIN_ROLES
                .map(normalizeRole)
                .includes(role);
        },

        getSupabase() {
            return client;
        }
    };

    /* =====================================================
       MINECRAFT WERSJE
       ===================================================== */

    function loadMinecraftVersions() {

        const select =
            document.getElementById(
                "product-minecraft-version"
            );

        if (!select) {
            return;
        }

        const versions = [
            "1.21.10",
            "1.21.9",
            "1.21.8",
            "1.21.7",
            "1.21.6",
            "1.21.5",
            "1.21.4",
            "1.21.3",
            "1.21.2",
            "1.21.1",
            "1.21",
            "1.20.6",
            "1.20.4",
            "1.20.2",
            "1.20.1",
            "1.19.4",
            "1.19.3",
            "1.19.2",
            "1.18.2",
            "1.16.5",
            "Inna"
        ];

        select.innerHTML =
            `<option value="">Wybierz wersję</option>` +
            versions
                .map(
                    version => `
                        <option value="${escapeHTML(version)}">
                            ${escapeHTML(version)}
                        </option>
                    `
                )
                .join("");
    }

    /* =====================================================
       PLUGINY
       ===================================================== */

    function loadMinecraftPlugins() {

        const container =
            document.getElementById(
                "product-required-plugins"
            );

        if (!container) {
            return;
        }

        const plugins = [
            "Skript",
            "SkBee",
            "Vault",
            "EssentialsX",
            "WorldEdit",
            "WorldGuard",
            "PlaceholderAPI",
            "LuckPerms",
            "ProtocolLib",
            "ViaVersion",
            "Citizens",
            "MythicMobs",
            "DeluxeMenus",
            "ItemsAdder",
            "Oraxen",
            "Multiverse-Core",
            "TAB",
            "Other"
        ];

        container.innerHTML =
            [
                ...new Set(plugins)
            ]
                .map(
                    plugin => `
                        <label>
                            <input
                                type="checkbox"
                                value="${escapeHTML(plugin)}"
                            >
                            <span>
                                ${escapeHTML(plugin)}
                            </span>
                        </label>
                    `
                )
                .join("");
    }

    function getSelectedPlugins() {

        const container =
            document.getElementById(
                "product-required-plugins"
            );

        if (!container) {
            return [];
        }

        return [
            ...container.querySelectorAll(
                'input[type="checkbox"]:checked'
            )
        ].map(
            input => input.value
        );
    }

    function setSelectedPlugins(
        plugins
    ) {

        const container =
            document.getElementById(
                "product-required-plugins"
            );

        if (!container) {
            return;
        }

        let values = [];

        if (Array.isArray(plugins)) {

            values = plugins;

        } else if (
            typeof plugins === "string"
        ) {

            try {

                const parsed =
                    JSON.parse(plugins);

                if (Array.isArray(parsed)) {

                    values = parsed;

                } else {

                    values =
                        plugins
                            .split(",")
                            .map(
                                x => x.trim()
                            )
                            .filter(Boolean);
                }

            } catch {

                values =
                    plugins
                        .split(",")
                        .map(
                            x => x.trim()
                        )
                        .filter(Boolean);
            }
        }

        container
            .querySelectorAll(
                'input[type="checkbox"]'
            )
            .forEach(input => {

                input.checked =
                    values.includes(
                        input.value
                    );
            });
    }

    /* =====================================================
       PRODUCT MODAL
       ===================================================== */

    function openProductModal(
        product = null
    ) {

        const modal =
            document.getElementById(
                "product-modal"
            );

        if (!modal) {
            return;
        }

        const form =
            document.getElementById(
                "product-form"
            );

        if (form) {
            form.reset();
        }

        const setValue = (
            id,
            value
        ) => {

            const element =
                document.getElementById(id);

            if (element) {
                element.value =
                    value ?? "";
            }
        };

        setValue(
            "product-id",
            product?.id || ""
        );

        setValue(
            "product-name",
            product?.name || ""
        );

        setValue(
            "product-slug",
            product?.slug || ""
        );

        setValue(
            "product-world",
            product?.world || "minecraft"
        );

        setValue(
            "product-category",
            product?.category || "Skrypty"
        );

        setValue(
            "product-type",
            product?.product_type || "script"
        );

        setValue(
            "product-price",
            product?.price ?? 0
        );

        setValue(
            "product-status",
            product?.status || "active"
        );

        setValue(
            "product-minecraft-version",
            product?.minecraft_version || ""
        );

        setValue(
            "product-youtube-url",
            product?.youtube_url || ""
        );

        setValue(
            "product-description",
            product?.description || ""
        );

        setValue(
            "product-instructions",
            product?.instructions || ""
        );

        const free =
            document.getElementById(
                "product-is-free"
            );

        if (free) {

            free.checked =
                Boolean(
                    product?.is_free
                );
        }

        setSelectedPlugins(
            product?.required_plugins || []
        );

        const title =
            modal.querySelector(
                ".modal-header h2"
            );

        if (title) {

            title.textContent =
                product
                    ? "Edytuj produkt"
                    : "Dodaj produkt";
        }

        updateMinecraftFields();

        modal.hidden = false;
    }

    function closeProductModal() {

        const modal =
            document.getElementById(
                "product-modal"
            );

        if (modal) {
            modal.hidden = true;
        }
    }

    function updateMinecraftFields() {

        const world =
            document.getElementById(
                "product-world"
            )?.value;

        const fields =
            document.getElementById(
                "minecraft-product-fields"
            );

        if (fields) {

            fields.hidden =
                world !== "minecraft";
        }
    }

    /* =====================================================
       UPLOAD PLIKU
       ===================================================== */

    function sanitizeFileName(name) {

        return String(
            name || "plik"
        )
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /ł/g,
                "l"
            )
            .replace(
                /Ł/g,
                "L"
            )
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            )
            .replace(
                /_+/g,
                "_"
            );
    }

    async function uploadProductFile(
        file
    ) {

        if (!file) {
            return null;
        }

        if (!currentUser) {

            throw new Error(
                "Nie jesteś zalogowany."
            );
        }

        const safeName =
            sanitizeFileName(
                file.name
            );

        const uniqueName =
            `${crypto.randomUUID()}-${safeName}`;

        const path =
            `${currentUser.id}/${uniqueName}`;

        const {
            data,
            error
        } = await client.storage
            .from("products")
            .upload(
                path,
                file,
                {
                    cacheControl: "3600",
                    upsert: false
                }
            );

        if (error) {

            throw new Error(
                "Nie udało się wysłać pliku: " +
                error.message
            );
        }

        return data?.path || path;
    }

    /* =====================================================
       ZAPIS PRODUKTU
       ===================================================== */

    async function saveProduct(event) {

        event.preventDefault();

        const button =
            document.getElementById(
                "product-save-button"
            );

        if (
            !currentUser ||
            !currentProfile
        ) {

            alert(
                "Nie masz aktywnej sesji administratora."
            );

            return;
        }

        const value = id => {

            return (
                document.getElementById(id)
                    ?.value || ""
            ).trim();
        };

        const name =
            value("product-name");

        const id =
            value("product-id");

        if (!name) {

            alert(
                "Podaj nazwę produktu."
            );

            return;
        }

        const world =
            value("product-world");

        const category =
            value("product-category");

        const type =
            value("product-type");

        const price =
            Number(
                value("product-price") || 0
            );

        const isFree =
            document.getElementById(
                "product-is-free"
            )?.checked || false;

        const status =
            value("product-status");

        const fileInput =
            document.getElementById(
                "product-file"
            );

        const file =
            fileInput?.files?.[0] ||
            null;

        let slug =
            value("product-slug");

        if (!slug) {
            slug =
                slugify(name);
        }

        const payload = {

            name,

            slug,

            world,

            category:
                category ||
                (
                    type === "script"
                        ? "Skrypty"
                        : "Inne"
                ),

            product_type:
                type,

            price:
                isFree
                    ? 0
                    : price,

            is_free:
                isFree,

            minecraft_version:
                world === "minecraft"
                    ? value(
                        "product-minecraft-version"
                    ) || null
                    : null,

            required_plugins:
                world === "minecraft"
                    ? getSelectedPlugins()
                    : [],

            youtube_url:
                value(
                    "product-youtube-url"
                ) || null,

            description:
                value(
                    "product-description"
                ) || null,

            instructions:
                value(
                    "product-instructions"
                ) || null,

            status,

            created_by:
                currentUser.id
        };

        try {

            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    file
                        ? "Wysyłanie pliku..."
                        : "Zapisywanie...";
            }

            if (file) {

                payload.file_path =
                    await uploadProductFile(
                        file
                    );
            }

            let result;

            if (id) {

                const updatePayload = {
                    ...payload
                };

                if (!file) {
                    delete updatePayload.file_path;
                }

                result =
                    await client
                        .from("products")
                        .update(
                            updatePayload
                        )
                        .eq("id", id)
                        .select()
                        .single();

            } else {

                result =
                    await client
                        .from("products")
                        .insert(
                            payload
                        )
                        .select()
                        .single();
            }

            if (result.error) {
                throw result.error;
            }

            alert(
                id
                    ? "Produkt został zaktualizowany."
                    : "Produkt został utworzony."
            );

            closeProductModal();

            await loadProductsAdmin();
            await loadDashboard();

        } catch (error) {

            console.error(
                "ShadowTale:",
                error
            );

            alert(
                "Nie udało się zapisać produktu.\n\n" +
                error.message
            );

        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Zapisz produkt";
            }
        }
    }

    /* =====================================================
       PRODUKTY ADMIN
       ===================================================== */

    let adminProducts = [];

    async function loadProductsAdmin() {

        const table =
            document.getElementById(
                "products-table"
            );

        if (!table) {
            return;
        }

        table.innerHTML = `
            <tr>
                <td colspan="9">
                    Ładowanie produktów...
                </td>
            </tr>
        `;

        const {
            data,
            error
        } = await client
            .from("products")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {

            table.innerHTML = `
                <tr>
                    <td colspan="9">
                        Błąd:
                        ${escapeHTML(
                            error.message
                        )}
                    </td>
                </tr>
            `;

            return;
        }

        adminProducts =
            data || [];

        if (!adminProducts.length) {

            table.innerHTML = `
                <tr>
                    <td colspan="9">
                        Brak produktów.
                    </td>
                </tr>
            `;

            return;
        }

        table.innerHTML =
            adminProducts
                .map(product => {

                    const plugins =
                        Array.isArray(
                            product.required_plugins
                        )
                            ? product.required_plugins
                                .join(", ")
                            : (
                                product.required_plugins ||
                                "-"
                            );

                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHTML(
                                        product.name
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(
                                    product.world || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    product.category || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    product.minecraft_version || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    plugins
                                )}
                            </td>

                            <td>
                                ${formatPrice(
                                    product.price,
                                    product.is_free
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    product.status || "-"
                                )}
                            </td>

                            <td>
                                ${
                                    product.file_path
                                        ? "📦 Tak"
                                        : "❌ Brak"
                                }
                            </td>

                            <td>

                                <div
                                    style="
                                        display:flex;
                                        gap:6px;
                                        flex-wrap:wrap;
                                    "
                                >

                                    <button
                                        class="admin-small-button"
                                        data-edit-product="${escapeHTML(
                                            product.id
                                        )}"
                                    >
                                        Edytuj
                                    </button>

                                    <button
                                        class="admin-small-button"
                                        data-delete-product="${escapeHTML(
                                            product.id
                                        )}"
                                    >
                                        Usuń
                                    </button>

                                </div>

                            </td>

                        </tr>
                    `;
                })
                .join("");

        table
            .querySelectorAll(
                "[data-edit-product]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const product =
                            adminProducts.find(
                                item =>
                                    item.id ===
                                    button.dataset
                                        .editProduct
                            );

                        if (product) {

                            openProductModal(
                                product
                            );
                        }
                    }
                );
            });

        table
            .querySelectorAll(
                "[data-delete-product]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteProduct(
                            button.dataset
                                .deleteProduct
                        );
                    }
                );
            });
    }

    /* =====================================================
       USUWANIE PRODUKTU
       ===================================================== */

    async function deleteProduct(id) {

        const product =
            adminProducts.find(
                item =>
                    item.id === id
            );

        if (!product) {
            return;
        }

        if (
            !confirm(
                `Czy na pewno chcesz usunąć produkt "${product.name}"?`
            )
        ) {
            return;
        }

        try {

            const {
                error
            } = await client
                .from("products")
                .delete()
                .eq("id", id);

            if (error) {
                throw error;
            }

            if (product.file_path) {

                const {
                    error: storageError
                } = await client.storage
                    .from("products")
                    .remove([
                        product.file_path
                    ]);

                if (storageError) {

                    console.warn(
                        "Storage:",
                        storageError
                    );
                }
            }

            alert(
                "Produkt został usunięty."
            );

            await loadProductsAdmin();
            await loadDashboard();

        } catch (error) {

            alert(
                "Nie udało się usunąć produktu:\n\n" +
                error.message
            );
        }
    }

    /* =====================================================
       PUBLICZNE SKRYPTY
       ===================================================== */

    async function loadMinecraftScripts() {

        const grid =
            document.getElementById(
                "mc-products-grid"
            );

        if (!grid) {
            return;
        }

        grid.innerHTML = `
            <div class="card">
                <h3>
                    Ładowanie skryptów...
                </h3>
            </div>
        `;

        const {
            data,
            error
        } = await client
            .from("products")
            .select("*")
            .eq("status", "active")
            .eq("world", "minecraft")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {

            grid.innerHTML = `
                <div class="card">
                    <h3>
                        Nie udało się załadować skryptów
                    </h3>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>
                </div>
            `;

            return;
        }

        const scripts =
            (data || [])
                .filter(product => {

                    const category =
                        normalize(
                            product.category
                        );

                    const type =
                        normalize(
                            product.product_type
                        );

                    return (
                        category.includes(
                            "skrypt"
                        ) ||
                        type === "script"
                    );
                });

        if (!scripts.length) {

            grid.innerHTML = `
                <div class="card">
                    <h3>
                        Brak skryptów
                    </h3>

                    <p>
                        Aktualnie nie ma jeszcze
                        aktywnych skryptów Minecraft.
                    </p>
                </div>
            `;

            return;
        }

        grid.innerHTML =
            scripts
                .map(product => {

                    const plugins =
                        Array.isArray(
                            product.required_plugins
                        )
                            ? product.required_plugins
                            : [];

                    return `
                        <article class="product-card">

                            <div class="product-card-top">

                                <span class="product-badge">
                                    ⛏️ SKRYPT
                                </span>

                                <span class="product-price">
                                    ${formatPrice(
                                        product.price,
                                        product.is_free
                                    )}
                                </span>

                            </div>

                            <h3>
                                ${escapeHTML(
                                    product.name
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    product.description ||
                                    "Skrypt Minecraft dostępny w ShadowTale."
                                )}
                            </p>

                            ${
                                product.minecraft_version
                                    ? `
                                        <div class="product-meta">
                                            🎮 Minecraft:
                                            ${escapeHTML(
                                                product.minecraft_version
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                            ${
                                plugins.length
                                    ? `
                                        <div class="product-meta">
                                            🔌 Pluginy:
                                            ${escapeHTML(
                                                plugins.join(", ")
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                            <div class="product-card-actions">

                                <a
                                    href="produkt.html?id=${encodeURIComponent(
                                        product.id
                                    )}"
                                    class="btn primary"
                                >
                                    Zobacz produkt
                                </a>

                            </div>

                        </article>
                    `;
                })
                .join("");
    }

    /* =====================================================
       DASHBOARD
       ===================================================== */

    async function loadDashboard() {

        const usersCount =
            document.getElementById(
                "stat-users"
            );

        const productsCount =
            document.getElementById(
                "stat-products"
            );

        const ordersCount =
            document.getElementById(
                "stat-orders"
            );

        const revenue =
            document.getElementById(
                "stat-revenue"
            );

        const [
            usersResult,
            productsResult,
            ordersResult
        ] = await Promise.all([

            client
                .from("profiles")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            client
                .from("products")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            client
                .from("orders")
                .select(
                    "id, amount, status"
                )
        ]);

        if (usersCount) {

            usersCount.textContent =
                usersResult.count ?? 0;
        }

        if (productsCount) {

            productsCount.textContent =
                productsResult.count ?? 0;
        }

        const orders =
            ordersResult.data || [];

        if (ordersCount) {

            ordersCount.textContent =
                orders.length;
        }

        const total =
            orders
                .filter(
                    order =>
                        order.status ===
                        "paid"
                )
                .reduce(
                    (sum, order) =>
                        sum +
                        Number(
                            order.amount || 0
                        ),
                    0
                );

        if (revenue) {

            revenue.textContent =
                formatPrice(total);
        }
    }

    /* =====================================================
       UŻYTKOWNICY
       ===================================================== */

    async function loadUsers() {

        const table =
            document.getElementById(
                "users-table"
            );

        if (!table) {
            return;
        }

        table.innerHTML = `
            <tr>
                <td colspan="6">
                    Ładowanie...
                </td>
            </tr>
        `;

        const {
            data,
            error
        } = await client
            .from("profiles")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {

            table.innerHTML = `
                <tr>
                    <td colspan="6">
                        ${escapeHTML(
                            error.message
                        )}
                    </td>
                </tr>
            `;

            return;
        }

        if (!data?.length) {

            table.innerHTML = `
                <tr>
                    <td colspan="6">
                        Brak użytkowników.
                    </td>
                </tr>
            `;

            return;
        }

        table.innerHTML =
            data
                .map(user => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                user.username ||
                                "-"
                            )}
                        </td>

                        <td>
                            -
                        </td>

                        <td>
                            <span class="role-chip">
                                ${escapeHTML(
                                    getRoleLabel(
                                        user.role
                                    )
                                )}
                            </span>
                        </td>

                        <td>
                            Aktywne
                        </td>

                        <td>
                            ${formatDate(
                                user.created_at
                            )}
                        </td>

                        <td>

                            <button
                                class="admin-small-button"
                                data-edit-user="${escapeHTML(
                                    user.id
                                )}"
                            >
                                Edytuj
                            </button>

                        </td>

                    </tr>

                `)
                .join("");

        table
            .querySelectorAll(
                "[data-edit-user]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const user =
                            data.find(
                                item =>
                                    item.id ===
                                    button.dataset
                                        .editUser
                            );

                        if (user) {

                            openUserModal(
                                user
                            );
                        }
                    }
                );
            });
    }

    /* =====================================================
       USER MODAL
       ===================================================== */

    function openUserModal(user) {

        const modal =
            document.getElementById(
                "user-modal"
            );

        if (!modal) {
            return;
        }

        const id =
            document.getElementById(
                "user-id"
            );

        const username =
            document.getElementById(
                "user-username"
            );

        const status =
            document.getElementById(
                "user-status"
            );

        if (id) {
            id.value =
                user.id;
        }

        if (username) {
            username.value =
                user.username || "";
        }

        if (status) {
            status.value =
                "active";
        }

        const roles =
            document.getElementById(
                "user-role-editor"
            );

        if (roles) {

            const currentRole =
                normalizeRole(
                    user.role
                );

            roles.innerHTML = `

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="user"
                        ${
                            currentRole === "user" ||
                            currentRole === "klient" ||
                            currentRole === "client"
                                ? "checked"
                                : ""
                        }
                    >
                    👤 Klient
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="admin"
                        ${
                            currentRole === "admin"
                                ? "checked"
                                : ""
                        }
                    >
                    🛡️ Administrator
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="owner"
                        ${
                            currentRole === "owner"
                                ? "checked"
                                : ""
                        }
                    >
                    👑 Właściciel
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="programista"
                        ${
                            currentRole === "programista"
                                ? "checked"
                                : ""
                        }
                    >
                    💻 Programista
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="moderator"
                        ${
                            currentRole === "moderator"
                                ? "checked"
                                : ""
                        }
                    >
                    🔨 Moderator
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="support"
                        ${
                            currentRole === "support"
                                ? "checked"
                                : ""
                        }
                    >
                    🎧 Support
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="early_access"
                        ${
                            currentRole === "early_access"
                                ? "checked"
                                : ""
                        }
                    >
                    ⚡ Early Access
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="media"
                        ${
                            currentRole === "media"
                                ? "checked"
                                : ""
                        }
                    >
                    🎨 Media
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="friend"
                        ${
                            currentRole === "friend"
                                ? "checked"
                                : ""
                        }
                    >
                    💜 Friend
                </label>

                <label>
                    <input
                        type="radio"
                        name="user-role"
                        value="winner"
                        ${
                            currentRole === "winner" ||
                            currentRole === "content_winner"
                                ? "checked"
                                : ""
                        }
                    >
                    🏆 Wygrany konkurs
                </label>

            `;
        }

        modal.hidden = false;
    }

    async function saveUser(event) {

        event.preventDefault();

        const id =
            document.getElementById(
                "user-id"
            )?.value;

        const username =
            document.getElementById(
                "user-username"
            )?.value.trim();

        const role =
            document.querySelector(
                'input[name="user-role"]:checked'
            )?.value || "user";

        if (!id) {
            return;
        }

        const {
            error
        } = await client
            .from("profiles")
            .update({
                username,
                role,
                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                id
            );

        if (error) {

            alert(
                "Nie udało się zapisać użytkownika:\n\n" +
                error.message
            );

            return;
        }

        /*
         * Jeżeli edytujemy aktualnie zalogowanego
         * użytkownika, odświeżamy profil natychmiast.
         */

        if (
            currentUser &&
            currentUser.id === id
        ) {

            currentProfile =
                await getProfile(
                    currentUser.id
                );

            currentUsername =
                getUsernameFromUser(
                    currentUser
                );

            await showLoggedIn(
                currentUser
            );
        }

        const modal =
            document.getElementById(
                "user-modal"
            );

        if (modal) {
            modal.hidden = true;
        }

        await loadUsers();
    }

    /* =====================================================
       KATEGORIE
       ===================================================== */

    async function loadCategories() {

        const table =
            document.getElementById(
                "categories-table"
            );

        if (!table) {
            return;
        }

        const {
            data,
            error
        } = await client
            .from("categories")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {

            table.innerHTML = `
                <tr>
                    <td colspan="5">
                        Tabela kategorii nie jest jeszcze skonfigurowana.
                    </td>
                </tr>
            `;

            return;
        }

        table.innerHTML =
            (data || [])
                .map(category => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                category.name
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                category.slug ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                category.world ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${
                                category.active === false
                                    ? "Nie"
                                    : "Tak"
                            }
                        </td>

                        <td>
                            ${formatDate(
                                category.created_at
                            )}
                        </td>

                    </tr>

                `)
                .join("");
    }

    /* =====================================================
       ZAMÓWIENIA
       ===================================================== */

    async function loadOrders() {

        const table =
            document.getElementById(
                "orders-table"
            );

        if (!table) {
            return;
        }

        const {
            data,
            error
        } = await client
            .from("orders")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {

            table.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${escapeHTML(
                            error.message
                        )}
                    </td>
                </tr>
            `;

            return;
        }

        table.innerHTML =
            (data || [])
                .map(order => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                order.id
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                order.user_id
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                order.status
                            )}
                        </td>

                        <td>
                            ${formatPrice(
                                order.amount
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                order.payment_provider ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                order.payment_id ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                order.created_at
                            )}
                        </td>

                    </tr>

                `)
                .join("");
    }

    /* =====================================================
       PŁATNOŚCI
       ===================================================== */

    async function loadPayments() {

        const {
            data,
            error
        } = await client
            .from("orders")
            .select(
                "amount,status"
            );

        if (error) {

            console.error(
                "ShadowTale payments:",
                error
            );

            return;
        }

        const orders =
            data || [];

        const paid =
            orders.filter(
                x =>
                    x.status ===
                    "paid"
            ).length;

        const pending =
            orders.filter(
                x =>
                    x.status ===
                    "pending"
            ).length;

        const cancelled =
            orders.filter(
                x =>
                    x.status ===
                    "cancelled"
            ).length;

        const revenue =
            orders
                .filter(
                    x =>
                        x.status ===
                        "paid"
                )
                .reduce(
                    (sum, x) =>
                        sum +
                        Number(
                            x.amount || 0
                        ),
                    0
                );

        const paidElement =
            document.getElementById(
                "payment-paid"
            );

        const pendingElement =
            document.getElementById(
                "payment-pending"
            );

        const cancelledElement =
            document.getElementById(
                "payment-cancelled"
            );

        const revenueElement =
            document.getElementById(
                "payment-revenue"
            );

        if (paidElement) {
            paidElement.textContent =
                paid;
        }

        if (pendingElement) {
            pendingElement.textContent =
                pending;
        }

        if (cancelledElement) {
            cancelledElement.textContent =
                cancelled;
        }

        if (revenueElement) {
            revenueElement.textContent =
                formatPrice(
                    revenue
                );
        }
    }

    /* =====================================================
       LOGI
       ===================================================== */

    async function loadLogs() {

        const table =
            document.getElementById(
                "logs-table"
            );

        if (table) {

            table.innerHTML = `
                <tr>
                    <td colspan="5">
                        Logi będą dostępne po skonfigurowaniu tabeli logs.
                    </td>
                </tr>
            `;
        }
    }

    /* =====================================================
       TICKETY
       ===================================================== */

    async function loadTickets() {

        const table =
            document.getElementById(
                "tickets-table"
            );

        if (table) {

            table.innerHTML = `
                <tr>
                    <td colspan="6">
                        Zgłoszenia będą dostępne po skonfigurowaniu tabeli tickets.
                    </td>
                </tr>
            `;
        }
    }

    /* =====================================================
       ROLE
       ===================================================== */

    async function loadRoles() {

        const table =
            document.getElementById(
                "roles-table"
            );

        if (table) {

            table.innerHTML = `
                <tr>
                    <td colspan="5">
                        Rangi użytkowników są zarządzane w sekcji Użytkownicy.
                    </td>
                </tr>
            `;
        }
    }

    /* =====================================================
       ADMIN NAVIGATION
       ===================================================== */

    function setupAdminNavigation() {

        const buttons =
            document.querySelectorAll(
                ".admin-nav-button[data-section]"
            );

        const sections =
            document.querySelectorAll(
                ".admin-section"
            );

        buttons.forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const section =
                        button.dataset.section;

                    buttons.forEach(btn =>
                        btn.classList.remove(
                            "active"
                        )
                    );

                    button.classList.add(
                        "active"
                    );

                    sections.forEach(element => {

                        element.hidden =
                            element.id !==
                            `admin-section-${section}`;
                    });

                    if (
                        section ===
                        "dashboard"
                    ) {
                        await loadDashboard();
                    }

                    if (
                        section ===
                        "users"
                    ) {
                        await loadUsers();
                    }

                    if (
                        section ===
                        "products"
                    ) {
                        await loadProductsAdmin();
                    }

                    if (
                        section ===
                        "categories"
                    ) {
                        await loadCategories();
                    }

                    if (
                        section ===
                        "orders"
                    ) {
                        await loadOrders();
                    }

                    if (
                        section ===
                        "payments"
                    ) {
                        await loadPayments();
                    }

                    if (
                        section ===
                        "logs"
                    ) {
                        await loadLogs();
                    }

                    if (
                        section ===
                        "tickets"
                    ) {
                        await loadTickets();
                    }

                    if (
                        section ===
                        "roles"
                    ) {
                        await loadRoles();
                    }
                }
            );
        });
    }

    /* =====================================================
       EVENT LISTENERS
       ===================================================== */

    const logoutButton =
        document.getElementById(
            "admin-logout"
        );

    logoutButton?.addEventListener(
        "click",
        async () => {

            await client.auth.signOut();

            window.location.href =
                "index.html";
        }
    );

    document
        .getElementById(
            "add-product"
        )
        ?.addEventListener(
            "click",
            () =>
                openProductModal()
        );

    document
        .getElementById(
            "refresh-products"
        )
        ?.addEventListener(
            "click",
            loadProductsAdmin
        );

    document
        .getElementById(
            "product-form"
        )
        ?.addEventListener(
            "submit",
            saveProduct
        );

    document
        .getElementById(
            "product-modal-close"
        )
        ?.addEventListener(
            "click",
            closeProductModal
        );

    document
        .getElementById(
            "product-cancel-button"
        )
        ?.addEventListener(
            "click",
            closeProductModal
        );

    document
        .getElementById(
            "product-world"
        )
        ?.addEventListener(
            "change",
            updateMinecraftFields
        );

    document
        .getElementById(
            "user-form"
        )
        ?.addEventListener(
            "submit",
            saveUser
        );

    document
        .getElementById(
            "user-modal-close"
        )
        ?.addEventListener(
            "click",
            () => {

                const modal =
                    document.getElementById(
                        "user-modal"
                    );

                if (modal) {
                    modal.hidden = true;
                }
            }
        );

    document
        .getElementById(
            "refresh-users"
        )
        ?.addEventListener(
            "click",
            loadUsers
        );

    document
        .getElementById(
            "refresh-orders"
        )
        ?.addEventListener(
            "click",
            loadOrders
        );

    document
        .getElementById(
            "refresh-payments"
        )
        ?.addEventListener(
            "click",
            loadPayments
        );

    document
        .getElementById(
            "refresh-categories"
        )
        ?.addEventListener(
            "click",
            loadCategories
        );

    document
        .getElementById(
            "refresh-logs"
        )
        ?.addEventListener(
            "click",
            loadLogs
        );

    document
        .getElementById(
            "refresh-tickets"
        )
        ?.addEventListener(
            "click",
            loadTickets
        );

    document
        .getElementById(
            "refresh-roles"
        )
        ?.addEventListener(
            "click",
            loadRoles
        );

    /* =====================================================
       WYSZUKIWANIE
       ===================================================== */

    const searchInput =
        document.getElementById(
            "global-search"
        );

    const searchButton =
        document.getElementById(
            "search-button"
        );

    function performSearch() {

        const value =
            String(
                searchInput?.value ||
                ""
            ).trim();

        if (!value) {
            return;
        }

        window.location.href =
            "index.html?search=" +
            encodeURIComponent(
                value
            );
    }

    searchButton?.addEventListener(
        "click",
        performSearch
    );

    searchInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                performSearch();
            }
        }
    );

    /* =====================================================
       START
       ===================================================== */

    loadMinecraftVersions();
    loadMinecraftPlugins();
    setupAdminNavigation();

    const isAdminPage =
        Boolean(
            document.getElementById(
                "admin-app"
            )
        );

    /*
     * Najpierw odczytujemy sesję.
     * Dopiero potem uruchamiamy elementy zależne
     * od użytkownika.
     */

    try {

        const {
            data,
            error
        } = await client.auth.getSession();

        if (error) {

            console.error(
                "ShadowTale: błąd sesji:",
                error
            );

            showLoggedOut();

        } else {

            const user =
                data?.session?.user ||
                null;

            if (user) {

                currentUser =
                    user;

                currentProfile =
                    await getProfile(
                        user.id
                    );

                await showLoggedIn(
                    user
                );

            } else {

                showLoggedOut();
            }
        }

    } catch (error) {

        console.error(
            "ShadowTale: błąd podczas uruchamiania sesji:",
            error
        );

        showLoggedOut();
    }

    /*
     * Admin.
     */

    if (isAdminPage) {

        if (currentUser) {

            const allowed =
                await checkAdminAccess(
                    currentUser
                );

            if (allowed) {

                await loadDashboard();
                await loadProductsAdmin();
            }
        }

    } else {

        await loadMinecraftScripts();
    }

    /* =====================================================
       ZMIANY SESJI
       ===================================================== */

    client.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            /*
             * SIGNED_IN / TOKEN_REFRESHED /
             * INITIAL_SESSION
             */

            if (session?.user) {

                /*
                 * Nie wymuszamy ponownego logowania.
                 * Supabase sam zarządza sesją.
                 */

                currentUser =
                    session.user;

                currentProfile =
                    await getProfile(
                        session.user.id
                    );

                await showLoggedIn(
                    session.user
                );

                if (
                    document.getElementById(
                        "admin-app"
                    )
                ) {

                    await checkAdminAccess(
                        session.user
                    );
                }

            } else if (
                event ===
                "SIGNED_OUT"
            ) {

                showLoggedOut();
            }
        }
    );

});