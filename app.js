/* =========================================================
   SHADOWTALE - APP.JS
   Wspólny system strony
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://vbxyshxmnsfnlwuihzse.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_XszGm5td2PP0Tso0ZEX0-g_dfVQEILw";

const CONFIG = {
    name: "ShadowTale",
    domain: "ShadowTale.pl"
};

let supabaseClient = null;

if (
    window.supabase &&
    typeof window.supabase.createClient === "function"
) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
} else {
    console.error(
        "ShadowTale: Nie znaleziono biblioteki Supabase."
    );
}


/* =========================================================
   POMOCNICZE
   ========================================================= */

async function getCurrentUser() {

    if (!supabaseClient) {
        return null;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getUser();

        if (error) {
            console.error(
                "ShadowTale - getCurrentUser:",
                error
            );

            return null;
        }

        return data?.user || null;

    } catch (error) {

        console.error(error);

        return null;
    }
}


async function getProfile(userId) {

    if (!supabaseClient || !userId) {
        return null;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("profiles")
            .select("id, username, avatar_url, role")
            .eq("id", userId)
            .maybeSingle();

        if (error) {

            console.error(
                "ShadowTale - Profile error:",
                error
            );

            return null;
        }

        return data || null;

    } catch (error) {

        console.error(error);

        return null;
    }
}


function getUsername(user, profile) {

    if (profile?.username) {
        return profile.username;
    }

    if (user?.user_metadata?.username) {
        return user.user_metadata.username;
    }

    if (user?.email) {
        return user.email.split("@")[0];
    }

    return "Użytkownik";
}


function getRoleName(role) {

    switch (role) {

        case "owner":
            return "👑 Właściciel";

        case "admin":
            return "🛡 Administrator";

        case "user":
        case "zalogowany":
        default:
            return "● Użytkownik";
    }
}


function getRoleClass(role) {

    switch (role) {

        case "owner":
            return "role-owner";

        case "admin":
            return "role-admin";

        default:
            return "role-user";
    }
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function getErrorMessage(
    error,
    fallback = "Wystąpił nieznany błąd."
) {

    if (!error) {
        return fallback;
    }

    const message =
        error.message ||
        error.error_description ||
        error.error ||
        "";

    const lower =
        message.toLowerCase();

    if (
        lower.includes("invalid login") ||
        lower.includes("invalid credentials")
    ) {
        return "Nieprawidłowy e-mail lub hasło.";
    }

    if (
        lower.includes("email not confirmed")
    ) {
        return "Najpierw potwierdź adres e-mail.";
    }

    if (
        lower.includes("already registered") ||
        lower.includes("user already registered")
    ) {
        return "Konto z tym adresem już istnieje.";
    }

    if (
        lower.includes("duplicate key")
    ) {
        return "Taka wartość jest już używana.";
    }

    return message || fallback;
}


function redirectToLogin() {

    if (
        !window.location.pathname.endsWith(
            "login.html"
        )
    ) {
        window.location.href = "login.html";
    }
}


/* =========================================================
   ACCOUNT BUTTON
   ========================================================= */

async function updateAccountButton() {

    const button =
        document.getElementById(
            "account-button"
        );

    if (!button) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {

        button.href = "login.html";

        button.innerHTML = `
            <span class="account-icon">👤</span>
            <span>Konto</span>
        `;

        return;
    }

    const profile =
        await getProfile(user.id);

    const username =
        getUsername(
            user,
            profile
        );

    const avatar =
        profile?.avatar_url || "";

    button.href = "konto.html";

    if (avatar) {

        button.innerHTML = `
            <img
                class="account-button-avatar"
                src="${escapeHtml(avatar)}"
                alt="Avatar"
            >

            <span>
                ${escapeHtml(username)}
            </span>
        `;

    } else {

        button.innerHTML = `
            <span class="account-icon">👤</span>

            <span>
                ${escapeHtml(username)}
            </span>
        `;
    }
}


/* =========================================================
   PROFIL - KONTO.HTML
   ========================================================= */

async function initProfilePage() {

    const usernameElement =
        document.getElementById(
            "profile-username"
        );

    const emailElement =
        document.getElementById(
            "profile-email"
        );

    const roleElement =
        document.getElementById(
            "profile-role"
        );

    const avatar =
        document.getElementById(
            "profile-avatar"
        );

    const placeholder =
        document.getElementById(
            "profile-avatar-placeholder"
        );

    const status =
        document.getElementById(
            "profile-status"
        );

    /*
     * Jeśli nie jesteśmy na stronie konta,
     * nic nie robimy.
     */

    if (
        !usernameElement &&
        !emailElement &&
        !roleElement &&
        !avatar
    ) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {

        redirectToLogin();

        return;
    }

    const profile =
        await getProfile(user.id);

    /*
     * NICK
     */

    if (usernameElement) {

        usernameElement.textContent =
            getUsername(
                user,
                profile
            );
    }

    /*
     * E-MAIL
     */

    if (emailElement) {

        emailElement.textContent =
            user.email || "Brak adresu e-mail";
    }

    /*
     * RANGA
     */

    if (roleElement) {

        const role =
            profile?.role || "user";

        roleElement.textContent =
            getRoleName(role);

        roleElement.className =
            `profile-role ${getRoleClass(role)}`;
    }

    /*
     * AVATAR
     */

    const avatarUrl =
        profile?.avatar_url || "";

    if (
        avatar &&
        avatarUrl
    ) {

        avatar.src =
            avatarUrl;

        avatar.style.display =
            "block";

        avatar.onload = () => {

            if (placeholder) {
                placeholder.style.display =
                    "none";
            }
        };

        avatar.onerror = () => {

            avatar.style.display =
                "none";

            if (placeholder) {
                placeholder.style.display =
                    "flex";
            }
        };

    } else {

        if (avatar) {
            avatar.src = "";
            avatar.style.display = "none";
        }

        if (placeholder) {
            placeholder.style.display = "flex";
        }
    }

    /*
     * STATUS
     */

    if (status) {

        status.textContent =
            "";

        status.className =
            "account-status";
    }
}


/* =========================================================
   AVATAR - USTAWIENIA
   ========================================================= */

async function initAvatarSettings() {

    const fileInput =
        document.getElementById(
            "avatar-file"
        );

    const uploadButton =
        document.getElementById(
            "upload-avatar"
        );

    const removeButton =
        document.getElementById(
            "remove-avatar"
        );

    const preview =
        document.getElementById(
            "avatar-preview"
        );

    const placeholder =
        document.getElementById(
            "avatar-placeholder"
        );

    const message =
        document.getElementById(
            "avatar-message"
        );

    if (
        !fileInput &&
        !uploadButton &&
        !removeButton
    ) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {

        redirectToLogin();

        return;
    }

    const profile =
        await getProfile(user.id);

    if (profile?.avatar_url) {

        showAvatar(
            profile.avatar_url,
            preview,
            placeholder
        );

    } else {

        hideAvatar(
            preview,
            placeholder
        );
    }


    /* =====================================================
       UPLOAD
       ===================================================== */

    if (
        uploadButton &&
        fileInput
    ) {

        uploadButton.addEventListener(
            "click",
            async () => {

                const file =
                    fileInput.files?.[0];

                if (!file) {

                    showMessage(
                        message,
                        "Wybierz najpierw zdjęcie.",
                        "error"
                    );

                    return;
                }

                if (
                    file.size >
                    2 * 1024 * 1024
                ) {

                    showMessage(
                        message,
                        "Avatar może mieć maksymalnie 2 MB.",
                        "error"
                    );

                    return;
                }

                const allowedTypes = [
                    "image/png",
                    "image/jpeg",
                    "image/webp"
                ];

                if (
                    !allowedTypes.includes(
                        file.type
                    )
                ) {

                    showMessage(
                        message,
                        "Dozwolone są PNG, JPG i WEBP.",
                        "error"
                    );

                    return;
                }

                uploadButton.disabled = true;

                uploadButton.textContent =
                    "Przesyłanie...";

                try {

                    /*
                     * Jeden stały plik:
                     * userID/avatar
                     *
                     * Dzięki temu nie zostają
                     * stare rozszerzenia.
                     */

                    const path =
                        `${user.id}/avatar`;

                    const {
                        error:
                            uploadError
                    } =
                        await supabaseClient
                            .storage
                            .from("avatars")
                            .upload(
                                path,
                                file,
                                {
                                    upsert: true,
                                    contentType:
                                        file.type
                                }
                            );

                    if (uploadError) {
                        throw uploadError;
                    }

                    const {
                        data
                    } =
                        supabaseClient
                            .storage
                            .from("avatars")
                            .getPublicUrl(path);

                    if (!data?.publicUrl) {

                        throw new Error(
                            "Nie udało się uzyskać adresu avatara."
                        );
                    }

                    const avatarUrl =
                        `${data.publicUrl}?v=${Date.now()}`;

                    const {
                        error:
                            profileError
                    } =
                        await supabaseClient
                            .from("profiles")
                            .update({
                                avatar_url:
                                    avatarUrl
                            })
                            .eq(
                                "id",
                                user.id
                            );

                    if (profileError) {
                        throw profileError;
                    }

                    showAvatar(
                        avatarUrl,
                        preview,
                        placeholder
                    );

                    fileInput.value = "";

                    showMessage(
                        message,
                        "Avatar został zmieniony.",
                        "success"
                    );

                    await updateAccountButton();

                } catch (error) {

                    console.error(error);

                    showMessage(
                        message,
                        getErrorMessage(
                            error,
                            "Nie udało się zmienić avatara."
                        ),
                        "error"
                    );

                } finally {

                    uploadButton.disabled =
                        false;

                    uploadButton.textContent =
                        "Ustaw avatar";
                }
            }
        );
    }


    /* =====================================================
       USUWANIE AVATARA
       ===================================================== */

    if (removeButton) {

        removeButton.addEventListener(
            "click",
            async () => {

                removeButton.disabled = true;

                removeButton.textContent =
                    "Usuwanie...";

                try {

                    const {
                        error:
                            storageError
                    } =
                        await supabaseClient
                            .storage
                            .from("avatars")
                            .remove([
                                `${user.id}/avatar`
                            ]);

                    /*
                     * Brak pliku w storage
                     * nie powinien blokować
                     * usunięcia URL z profilu.
                     */

                    if (
                        storageError &&
                        !storageError.message
                            ?.toLowerCase()
                            .includes("not found")
                    ) {
                        console.warn(storageError);
                    }

                    const {
                        error
                    } =
                        await supabaseClient
                            .from("profiles")
                            .update({
                                avatar_url: null
                            })
                            .eq(
                                "id",
                                user.id
                            );

                    if (error) {
                        throw error;
                    }

                    hideAvatar(
                        preview,
                        placeholder
                    );

                    showMessage(
                        message,
                        "Avatar został usunięty.",
                        "success"
                    );

                    await updateAccountButton();

                } catch (error) {

                    console.error(error);

                    showMessage(
                        message,
                        getErrorMessage(
                            error,
                            "Nie udało się usunąć avatara."
                        ),
                        "error"
                    );

                } finally {

                    removeButton.disabled =
                        false;

                    removeButton.textContent =
                        "Usuń avatar";
                }
            }
        );
    }
}


function showAvatar(
    url,
    preview,
    placeholder
) {

    if (preview) {

        preview.src =
            url;

        preview.style.display =
            "block";
    }

    if (placeholder) {

        placeholder.style.display =
            "none";
    }
}


function hideAvatar(
    preview,
    placeholder
) {

    if (preview) {

        preview.src =
            "";

        preview.style.display =
            "none";
    }

    if (placeholder) {

        placeholder.style.display =
            "flex";
    }
}


/* =========================================================
   NICK
   ========================================================= */

async function initUsernameSettings() {

    const input =
        document.getElementById(
            "new-username"
        );

    const button =
        document.getElementById(
            "save-username"
        );

    const message =
        document.getElementById(
            "username-message"
        );

    if (!input || !button) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {

        redirectToLogin();

        return;
    }

    const profile =
        await getProfile(user.id);

    input.value =
        getUsername(
            user,
            profile
        );

    button.addEventListener(
        "click",
        async () => {

            const username =
                input.value.trim();

            if (
                username.length < 3
            ) {

                showMessage(
                    message,
                    "Nick musi mieć minimum 3 znaki.",
                    "error"
                );

                return;
            }

            if (
                username.length > 24
            ) {

                showMessage(
                    message,
                    "Nick może mieć maksymalnie 24 znaki.",
                    "error"
                );

                return;
            }

            if (
                !/^[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _.\\-]+$/.test(
                    username
                )
            ) {

                showMessage(
                    message,
                    "Nick zawiera niedozwolone znaki.",
                    "error"
                );

                return;
            }

            button.disabled = true;

            button.textContent =
                "Zapisywanie...";

            try {

                const {
                    error
                } =
                    await supabaseClient
                        .from("profiles")
                        .update({
                            username
                        })
                        .eq(
                            "id",
                            user.id
                        );

                if (error) {
                    throw error;
                }

                showMessage(
                    message,
                    "Nick został zmieniony.",
                    "success"
                );

                await updateAccountButton();

                await initProfilePage();

            } catch (error) {

                console.error(error);

                showMessage(
                    message,
                    getErrorMessage(
                        error,
                        "Nie udało się zmienić nicku."
                    ),
                    "error"
                );

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Zapisz";
            }
        }
    );
}


/* =========================================================
   EMAIL
   ========================================================= */

async function initEmailSettings() {

    const currentEmail =
        document.getElementById(
            "current-email"
        );

    const newEmail =
        document.getElementById(
            "new-email"
        );

    const button =
        document.getElementById(
            "change-email"
        );

    const message =
        document.getElementById(
            "email-message"
        );

    if (!newEmail || !button) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {

        redirectToLogin();

        return;
    }

    if (currentEmail) {

        currentEmail.value =
            user.email || "";
    }

    button.addEventListener(
        "click",
        async () => {

            const email =
                newEmail.value.trim();

            if (!email) {

                showMessage(
                    message,
                    "Wpisz nowy adres e-mail.",
                    "error"
                );

                return;
            }

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    email
                )
            ) {

                showMessage(
                    message,
                    "Podaj poprawny adres e-mail.",
                    "error"
                );

                return;
            }

            button.disabled = true;

            button.textContent =
                "Zmienianie...";

            try {

                const {
                    error
                } =
                    await supabaseClient
                        .auth
                        .updateUser({
                            email
                        });

                if (error) {
                    throw error;
                }

                newEmail.value = "";

                showMessage(
                    message,
                    "Wysłano wiadomość potwierdzającą zmianę e-maila.",
                    "success"
                );

            } catch (error) {

                console.error(error);

                showMessage(
                    message,
                    getErrorMessage(
                        error,
                        "Nie udało się zmienić e-maila."
                    ),
                    "error"
                );

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Zmień e-mail";
            }
        }
    );
}


/* =========================================================
   HASŁO
   ========================================================= */

async function initPasswordSettings() {

    const oldPassword =
        document.getElementById(
            "old-password"
        );

    const newPassword =
        document.getElementById(
            "new-password"
        );

    const repeatPassword =
        document.getElementById(
            "new-password-repeat"
        );

    const changeButton =
        document.getElementById(
            "change-password"
        );

    const resetButton =
        document.getElementById(
            "reset-password"
        );

    const message =
        document.getElementById(
            "password-message"
        );

    if (
        !changeButton &&
        !resetButton
    ) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {

        redirectToLogin();

        return;
    }


    /* =====================================================
       ZMIANA HASŁA
       ===================================================== */

    if (changeButton) {

        changeButton.addEventListener(
            "click",
            async () => {

                const oldValue =
                    oldPassword?.value || "";

                const newValue =
                    newPassword?.value || "";

                const repeatValue =
                    repeatPassword?.value || "";

                if (!oldValue) {

                    showMessage(
                        message,
                        "Wpisz obecne hasło.",
                        "error"
                    );

                    return;
                }

                if (
                    newValue.length < 8
                ) {

                    showMessage(
                        message,
                        "Nowe hasło musi mieć minimum 8 znaków.",
                        "error"
                    );

                    return;
                }

                if (
                    newValue !==
                    repeatValue
                ) {

                    showMessage(
                        message,
                        "Nowe hasła nie są takie same.",
                        "error"
                    );

                    return;
                }

                changeButton.disabled = true;

                changeButton.textContent =
                    "Sprawdzanie...";

                try {

                    const {
                        error:
                            loginError
                    } =
                        await supabaseClient
                            .auth
                            .signInWithPassword({
                                email:
                                    user.email,
                                password:
                                    oldValue
                            });

                    if (loginError) {

                        throw new Error(
                            "Obecne hasło jest nieprawidłowe."
                        );
                    }

                    changeButton.textContent =
                        "Zmiana...";

                    const {
                        error
                    } =
                        await supabaseClient
                            .auth
                            .updateUser({
                                password:
                                    newValue
                            });

                    if (error) {
                        throw error;
                    }

                    if (oldPassword) {
                        oldPassword.value = "";
                    }

                    if (newPassword) {
                        newPassword.value = "";
                    }

                    if (repeatPassword) {
                        repeatPassword.value = "";
                    }

                    showMessage(
                        message,
                        "Hasło zostało zmienione.",
                        "success"
                    );

                } catch (error) {

                    console.error(error);

                    showMessage(
                        message,
                        getErrorMessage(
                            error,
                            "Nie udało się zmienić hasła."
                        ),
                        "error"
                    );

                } finally {

                    changeButton.disabled =
                        false;

                    changeButton.textContent =
                        "Zmień hasło";
                }
            }
        );
    }


    /* =====================================================
       RESET HASŁA
       ===================================================== */

    if (resetButton) {

        resetButton.addEventListener(
            "click",
            async () => {

                resetButton.disabled = true;

                resetButton.textContent =
                    "Wysyłanie...";

                try {

                    const redirectUrl =
                        `${window.location.origin}/reset-hasla.html`;

                    const {
                        error
                    } =
                        await supabaseClient
                            .auth
                            .resetPasswordForEmail(
                                user.email,
                                {
                                    redirectTo:
                                        redirectUrl
                                }
                            );

                    if (error) {
                        throw error;
                    }

                    showMessage(
                        message,
                        "Link do resetowania hasła został wysłany.",
                        "success"
                    );

                } catch (error) {

                    console.error(error);

                    showMessage(
                        message,
                        getErrorMessage(
                            error,
                            "Nie udało się wysłać wiadomości."
                        ),
                        "error"
                    );

                } finally {

                    resetButton.disabled =
                        false;

                    resetButton.textContent =
                        "Wyślij link resetujący";
                }
            }
        );
    }
}


/* =========================================================
   PŁATNOŚCI
   ========================================================= */

async function loadPaymentCount() {

    const element =
        document.getElementById(
            "payment-count"
        );

    if (!element) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("payment_methods")
                .select("id")
                .eq(
                    "user_id",
                    user.id
                );

        if (error) {

            console.error(error);

            return;
        }

        element.textContent =
            `${data?.length || 0} / 3`;

    } catch (error) {

        console.error(error);
    }
}


/* =========================================================
   WYLOGOWANIE
   ========================================================= */

function initLogout() {

    const buttons =
        document.querySelectorAll(
            "#logout-settings, #logout-account"
        );

    if (!buttons.length) {
        return;
    }

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                button.disabled = true;

                button.textContent =
                    "Wylogowywanie...";

                try {

                    const {
                        error
                    } =
                        await supabaseClient
                            .auth
                            .signOut();

                    if (error) {
                        throw error;
                    }

                    window.location.href =
                        "index.html";

                } catch (error) {

                    console.error(error);

                    button.disabled =
                        false;

                    button.textContent =
                        "Wyloguj się";
                }
            }
        );

    });
}


/* =========================================================
   USUNIĘCIE KONTA
   ========================================================= */

function initDeleteAccount() {

    const button =
        document.getElementById(
            "delete-account"
        );

    const message =
        document.getElementById(
            "account-message"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            const first =
                confirm(
                    "Czy na pewno chcesz usunąć konto?"
                );

            if (!first) {
                return;
            }

            const second =
                confirm(
                    "To działanie jest trwałe. Kontynuować?"
                );

            if (!second) {
                return;
            }

            button.disabled = true;

            button.textContent =
                "Usuwanie...";

            try {

                const {
                    error
                } =
                    await supabaseClient
                        .functions
                        .invoke(
                            "delete-account"
                        );

                if (error) {
                    throw error;
                }

                await supabaseClient
                    .auth
                    .signOut();

                window.location.href =
                    "index.html";

            } catch (error) {

                console.error(error);

                showMessage(
                    message,
                    "Usuwanie konta nie jest jeszcze skonfigurowane na serwerze.",
                    "error"
                );

                button.disabled =
                    false;

                button.textContent =
                    "Usuń konto";
            }
        }
    );
}


/* =========================================================
   SEARCH
   ========================================================= */

function initSearch() {

    const input =
        document.getElementById(
            "site-search"
        );

    const results =
        document.getElementById(
            "search-results"
        );

    if (!input || !results) {
        return;
    }

    const pages = [

        [
            "Minecraft",
            "minecraft.html",
            "minecraft mc"
        ],

        [
            "Skrypty",
            "mc-skrypty.html",
            "skrypty skript"
        ],

        [
            "Mapy",
            "mc-mapy.html",
            "mapy schematy"
        ],

        [
            "Configi",
            "mc-configi.html",
            "config configi"
        ],

        [
            "Tekstury",
            "mc-txt.html",
            "tekstury resource pack"
        ],

        [
            "Skiny",
            "mc-skiny.html",
            "skiny"
        ],

        [
            "Undertale",
            "undertale.html",
            "undertale"
        ],

        [
            "Save",
            "ut-save.html",
            "save undertale"
        ],

        [
            "Postacie",
            "ut-postacie.html",
            "postacie"
        ],

        [
            "Przedmioty",
            "ut-przedmioty.html",
            "przedmioty"
        ],

        [
            "Dane",
            "ut-dane.html",
            "dane"
        ],

        [
            "Mody",
            "ut-mody.html",
            "mody"
        ],

        [
            "Custom",
            "custom.html",
            "custom zamówienie"
        ],

        [
            "Discord",
            "discord.html",
            "discord"
        ],

        [
            "Regulamin",
            "regulamin.html",
            "regulamin"
        ],

        [
            "Konto",
            "konto.html",
            "konto profil"
        ],

        [
            "Ustawienia",
            "ustawienia.html",
            "ustawienia"
        ],

        [
            "Statystyki",
            "statystyki.html",
            "statystyki"
        ],

        [
            "Historia",
            "historia.html",
            "historia zakupy"
        ],

        [
            "Płatności",
            "platnosci.html",
            "płatności"
        ]
    ];


    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();

            results.innerHTML = "";

            if (!query) {

                results.classList.remove(
                    "active"
                );

                return;
            }

            const found =
                pages
                    .filter(
                        page =>
                            `${page[0]} ${page[2]}`
                                .toLowerCase()
                                .includes(
                                    query
                                )
                    )
                    .slice(0, 7);

            if (!found.length) {

                results.innerHTML = `
                    <div class="search-empty">
                        Nie znaleziono wyników.
                    </div>
                `;

            } else {

                found.forEach(
                    page => {

                        const link =
                            document.createElement(
                                "a"
                            );

                        link.href =
                            page[1];

                        link.className =
                            "search-result";

                        link.innerHTML = `
                            <strong>
                                ${escapeHtml(
                                    page[0]
                                )}
                            </strong>

                            <span>
                                Otwórz stronę
                            </span>
                        `;

                        results.appendChild(
                            link
                        );
                    }
                );
            }

            results.classList.add(
                "active"
            );
        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                event.target !== input &&
                !results.contains(
                    event.target
                )
            ) {

                results.classList.remove(
                    "active"
                );
            }
        }
    );
}


/* =========================================================
   SPADAJĄCE GWIAZDY
   ========================================================= */

function initStars() {

    const canvas =
        document.getElementById(
            "stars"
        );

    if (!canvas) {
        return;
    }

    const ctx =
        canvas.getContext("2d");

    if (!ctx) {
        return;
    }

    let width = 0;
    let height = 0;
    let stars = [];


    function resize() {

        width =
            window.innerWidth;

        height =
            window.innerHeight;

        const ratio =
            window.devicePixelRatio || 1;

        canvas.width =
            width * ratio;

        canvas.height =
            height * ratio;

        canvas.style.width =
            `${width}px`;

        canvas.style.height =
            `${height}px`;

        ctx.setTransform(
            ratio,
            0,
            0,
            ratio,
            0,
            0
        );

        stars = [];

        const amount =
            Math.min(
                180,
                Math.max(
                    70,
                    Math.floor(
                        width / 8
                    )
                )
            );

        for (
            let i = 0;
            i < amount;
            i++
        ) {

            stars.push({

                x:
                    Math.random() *
                    width,

                y:
                    Math.random() *
                    height,

                size:
                    Math.random() *
                    1.7 +
                    0.4,

                speed:
                    Math.random() *
                    0.8 +
                    0.2,

                opacity:
                    Math.random() *
                    0.7 +
                    0.2
            });
        }
    }


    function animate() {

        ctx.clearRect(
            0,
            0,
            width,
            height
        );

        stars.forEach(
            star => {

                star.y +=
                    star.speed;

                if (
                    star.y >
                    height + 5
                ) {

                    star.y = -5;

                    star.x =
                        Math.random() *
                        width;
                }

                ctx.globalAlpha =
                    star.opacity;

                ctx.beginPath();

                ctx.arc(
                    star.x,
                    star.y,
                    star.size,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }
        );

        ctx.globalAlpha = 1;

        requestAnimationFrame(
            animate
        );
    }


    window.addEventListener(
        "resize",
        resize
    );

    resize();

    animate();
}


/* =========================================================
   COOKIE
   ========================================================= */

function initCookies() {

    const banner =
        document.getElementById(
            "cookie-banner"
        );

    if (!banner) {
        return;
    }

    const accepted =
        localStorage.getItem(
            "shadowtale_cookies"
        );

    if (accepted) {

        banner.style.display =
            "none";
    }


    const acceptButton =
        document.getElementById(
            "cookie-accept"
        );

    const rejectButton =
        document.getElementById(
            "cookie-reject"
        );

    if (acceptButton) {

        acceptButton.addEventListener(
            "click",
            () => {

                localStorage.setItem(
                    "shadowtale_cookies",
                    "accepted"
                );

                banner.style.display =
                    "none";
            }
        );
    }


    if (rejectButton) {

        rejectButton.addEventListener(
            "click",
            () => {

                localStorage.setItem(
                    "shadowtale_cookies",
                    "rejected"
                );

                banner.style.display =
                    "none";
            }
        );
    }
}


/* =========================================================
   KOMUNIKAT
   ========================================================= */

function showMessage(
    element,
    text,
    type = "info"
) {

    if (!element) {
        return;
    }

    element.textContent =
        text;

    element.className =
        `settings-message ${type}`;
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        initStars();

        initSearch();

        initCookies();

        await updateAccountButton();

        await initProfilePage();

        await initUsernameSettings();

        await initAvatarSettings();

        await initEmailSettings();

        await initPasswordSettings();

        await loadPaymentCount();

        initLogout();

        initDeleteAccount();
    }
);


/* =========================================================
   SESJA
   ========================================================= */

if (supabaseClient) {

    supabaseClient.auth.onAuthStateChange(
        () => {

            setTimeout(
                async () => {

                    await updateAccountButton();

                    await initProfilePage();

                },
                100
            );
        }
    );
}
