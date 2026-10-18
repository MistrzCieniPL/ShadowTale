
(() => {
    "use strict";

    const STYLE_ID = "shadowtale-chat-style";
    const REFRESH_INTERVAL = 5000;
    const MAX_MESSAGE_LENGTH = 1000;

    let client = null;
    let currentUser = null;
    let isOpen = false;
    let isLoading = false;
    let refreshTimer = null;
    let messages = [];
    let lastMessageId = null;

    const state = {
        view: "global",
        contextUser: null,
        contextMessage: null
    };

    const $ = (selector, root = document) => root.querySelector(selector);

    function getClient() {
        return (
            window.db ||
            window.supabaseClient ||
            window.authClient ||
            window.supabase ||
            null
        );
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function nickname(user) {
        return (
            user?.user_metadata?.username ||
            user?.user_metadata?.nickname ||
            user?.user_metadata?.display_name ||
            user?.email?.split("@")[0] ||
            "Użytkownik"
        );
    }

    function avatarUrl(user) {
        return (
            user?.user_metadata?.avatar_url ||
            user?.user_metadata?.picture ||
            user?.user_metadata?.avatar ||
            ""
        );
    }

    function avatarHTML(url, name) {
        const safeName = escapeHTML(name || "U");
        const safeUrl = String(url || "");

        if (/^https?:\/\//i.test(safeUrl)) {
            return `<img class="st-chat-avatar" src="${escapeHTML(safeUrl)}" alt="${safeName}" loading="lazy" referrerpolicy="no-referrer">`;
        }

        return `<div class="st-chat-avatar st-chat-avatar-fallback">${safeName.charAt(0).toUpperCase()}</div>`;
    }

    function formatTime(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "";

        return date.toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function notify(message) {
        let box = $("#st-chat-notice");

        if (!box) {
            box = document.createElement("div");
            box.id = "st-chat-notice";
            document.body.appendChild(box);
        }

        box.textContent = message;
        box.classList.add("visible");

        clearTimeout(notify.timer);
        notify.timer = setTimeout(() => {
            box.classList.remove("visible");
        }, 4000);
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `
            #st-chat-launcher {
                position: fixed;
                left: 20px;
                bottom: 20px;
                z-index: 99990;
                width: 56px;
                height: 56px;
                border: 1px solid #9b5cff;
                border-radius: 50%;
                background: #171020;
                color: white;
                font-size: 25px;
                cursor: pointer;
                box-shadow: 0 0 20px #9b5cff55;
                transition: transform .2s, background .2s;
            }

            #st-chat-launcher:hover {
                transform: scale(1.07);
                background: #29183d;
            }

            #st-chat-panel {
                position: fixed;
                left: 20px;
                bottom: 88px;
                z-index: 99991;
                display: none;
                flex-direction: column;
                width: min(390px, calc(100vw - 30px));
                height: min(560px, calc(100dvh - 120px));
                min-height: 300px;
                overflow: hidden;
                border: 1px solid #7040a8;
                border-radius: 16px;
                background: #0d0b12;
                color: #f4efff;
                box-shadow: 0 12px 50px #0009;
                font-family: Arial, sans-serif;
            }

            #st-chat-panel.st-open {
                display: flex;
            }

            .st-chat-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px;
                background: #191222;
                border-bottom: 1px solid #39264e;
            }

            .st-chat-title {
                flex: 1;
                min-width: 0;
                font-size: 15px;
                font-weight: 700;
            }

            .st-chat-header button,
            .st-chat-action {
                border: 1px solid #49315e;
                border-radius: 8px;
                padding: 7px 9px;
                color: #eee4ff;
                background: #24182f;
                cursor: pointer;
                font-size: 12px;
            }

            .st-chat-header button:hover,
            .st-chat-action:hover {
                background: #493064;
            }

            #st-chat-status {
                padding: 6px 12px;
                color: #b8a7cc;
                font-size: 11px;
                border-bottom: 1px solid #251b30;
            }

            #st-chat-messages {
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .st-chat-message {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 7px;
                border-radius: 10px;
            }

            .st-chat-message:hover {
                background: #ffffff08;
            }

            .st-chat-avatar {
                flex-shrink: 0;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                object-fit: cover;
                background: #39234d;
                color: white;
            }

            .st-chat-avatar-fallback {
                display: flex;
                justify-content: center;
                align-items: center;
                font-weight: bold;
            }

            .st-chat-message-main {
                min-width: 0;
                flex: 1;
            }

            .st-chat-message-meta {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 7px;
                margin-bottom: 4px;
            }

            .st-chat-username {
                color: #c9a5ff;
                font-size: 12px;
                font-weight: bold;
                cursor: context-menu;
            }

            .st-chat-time {
                color: #81768e;
                font-size: 10px;
            }

            .st-chat-message-content {
                overflow-wrap: anywhere;
                white-space: pre-wrap;
                font-size: 13px;
                line-height: 1.45;
            }

            .st-chat-empty {
                padding: 24px 10px;
                color: #a99ab9;
                text-align: center;
                font-size: 13px;
            }

            #st-chat-form {
                display: flex;
                gap: 7px;
                padding: 10px;
                border-top: 1px solid #39264e;
                background: #15101c;
            }

            #st-chat-input {
                flex: 1;
                min-width: 0;
                resize: none;
                max-height: 100px;
                padding: 10px;
                border: 1px solid #49315e;
                border-radius: 10px;
                outline: none;
                color: white;
                background: #0d0b12;
                font-family: inherit;
                font-size: 13px;
            }

            #st-chat-input:focus {
                border-color: #9b5cff;
            }

            #st-chat-send {
                border: none;
                border-radius: 10px;
                padding: 0 13px;
                color: white;
                background: #7d42bd;
                cursor: pointer;
                font-weight: bold;
            }

            #st-chat-send:disabled {
                opacity: .5;
                cursor: wait;
            }

            #st-chat-context {
                position: fixed;
                z-index: 100005;
                display: none;
                min-width: 180px;
                padding: 5px;
                border: 1px solid #7040a8;
                border-radius: 10px;
                background: #171020;
                box-shadow: 0 8px 30px #0009;
            }

            #st-chat-context button {
                display: block;
                width: 100%;
                padding: 9px;
                border: none;
                border-radius: 6px;
                background: transparent;
                color: white;
                text-align: left;
                cursor: pointer;
                font-size: 12px;
            }

            #st-chat-context button:hover {
                background: #39264e;
            }

            #st-chat-modal {
                position: fixed;
                inset: 0;
                z-index: 100010;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: #000a;
            }

            #st-chat-modal.st-visible {
                display: flex;
            }

            .st-chat-modal-card {
                width: min(340px, 100%);
                max-height: 80dvh;
                overflow-y: auto;
                padding: 18px;
                border: 1px solid #7040a8;
                border-radius: 14px;
                color: white;
                background: #15101c;
            }

            .st-chat-modal-card h3 {
                margin-top: 0;
            }

            .st-chat-modal-card p {
                overflow-wrap: anywhere;
                color: #c6b8d7;
                font-size: 13px;
            }

            .st-chat-modal-card input,
            .st-chat-modal-card textarea,
            .st-chat-modal-card select {
                box-sizing: border-box;
                width: 100%;
                margin: 6px 0 12px;
                padding: 10px;
                border: 1px solid #49315e;
                border-radius: 8px;
                color: white;
                background: #0d0b12;
            }

            .st-chat-modal-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: flex-end;
            }

            #st-chat-notice {
                position: fixed;
                left: 50%;
                bottom: 18px;
                z-index: 100020;
                max-width: calc(100vw - 32px);
                padding: 11px 15px;
                border: 1px solid #7040a8;
                border-radius: 10px;
                color: white;
                background: #1b1225;
                box-shadow: 0 5px 24px #0008;
                font: 13px Arial, sans-serif;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, 10px);
                transition: .2s;
            }

            #st-chat-notice.visible {
                opacity: 1;
                transform: translate(-50%, 0);
            }

            body.st-chat-open #music-player,
            body.st-chat-open .music-player,
            body.st-chat-open #music-controls,
            body.st-chat-open .music-controls,
            body.st-chat-open #music-widget,
            body.st-chat-open .music-widget,
            body.st-chat-open .music-toggle,
            body.st-chat-open [data-music-player],
            body.st-chat-open #shadowtale-music,
            body.st-chat-open .shadowtale-music {
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }

            @media (max-width: 480px) {
                #st-chat-launcher {
                    left: 12px;
                    bottom: 12px;
                }

                #st-chat-panel {
                    left: 8px;
                    bottom: 78px;
                    width: calc(100vw - 16px);
                    height: min(600px, calc(100dvh - 100px));
                }
            }
        `;

        document.head.appendChild(style);
    }

    function createUI() {
        if ($("#st-chat-panel")) return;

        const launcher = document.createElement("button");
        launcher.id = "st-chat-launcher";
        launcher.type = "button";
        launcher.title = "Otwórz ShadowChat";
        launcher.setAttribute("aria-label", "Otwórz ShadowChat");
        launcher.textContent = "☁";

        const panel = document.createElement("section");
        panel.id = "st-chat-panel";
        panel.setAttribute("aria-label", "ShadowChat");

        panel.innerHTML = `
            <div class="st-chat-header">
                <div class="st-chat-title">☁ ShadowChat</div>
                <button type="button" id="st-chat-private">Prywatne</button>
                <button type="button" id="st-chat-close" aria-label="Zamknij">×</button>
            </div>
            <div id="st-chat-status">Łączenie...</div>
            <div id="st-chat-messages">
                <div class="st-chat-empty">Ładowanie wiadomości...</div>
            </div>
            <form id="st-chat-form">
                <textarea id="st-chat-input" maxlength="${MAX_MESSAGE_LENGTH}"
                    rows="1" placeholder="Napisz wiadomość..." aria-label="Wiadomość"></textarea>
                <button id="st-chat-send" type="submit">Wyślij</button>
            </form>
        `;

        const context = document.createElement("div");
        context.id = "st-chat-context";
        context.innerHTML = `
            <button type="button" data-action="profile">Zobacz profil</button>
            <button type="button" data-action="private">Napisz prywatnie</button>
            <button type="button" data-action="report-user">Zgłoś użytkownika</button>
            <button type="button" data-action="report-message">Zgłoś wiadomość</button>
        `;

        const modal = document.createElement("div");
        modal.id = "st-chat-modal";
        modal.innerHTML = `
            <div class="st-chat-modal-card">
                <div id="st-chat-modal-content"></div>
                <div class="st-chat-modal-buttons" id="st-chat-modal-buttons"></div>
            </div>
        `;

        document.body.append(launcher, panel, context, modal);

        launcher.addEventListener("click", toggleChat);
        $("#st-chat-close").addEventListener("click", closeChat);
        $("#st-chat-private").addEventListener("click", openPrivatePage);
        $("#st-chat-form").addEventListener("submit", sendMessage);

        $("#st-chat-input").addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                $("#st-chat-form").requestSubmit();
            }
        });

        $("#st-chat-messages").addEventListener("contextmenu", event => {
            const messageElement = event.target.closest("[data-message-id]");

            if (!messageElement) return;

            event.preventDefault();

            const message = messages.find(item =>
                String(item.id) === String(messageElement.dataset.messageId)
            );

            if (!message) return;

            state.contextMessage = message;
            state.contextUser = {
                id: message.user_id,
                username: message.username || "Użytkownik",
                avatar_url: message.avatar_url || ""
            };

            showContextMenu(event.clientX, event.clientY);
        });

        context.addEventListener("click", handleContextAction);

        document.addEventListener("click", event => {
            if (!event.target.closest("#st-chat-context")) {
                hideContextMenu();
            }

            if (event.target === modal) {
                closeModal();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                hideContextMenu();
                closeModal();
            }
        });
    }

    function setStatus(text) {
        const status = $("#st-chat-status");
        if (status) status.textContent = text;
    }

    function toggleChat() {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    function openChat() {
        isOpen = true;
        $("#st-chat-panel")?.classList.add("st-open");
        document.body.classList.add("st-chat-open");

        loadMessages();

        clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            if (isOpen && state.view === "global") loadMessages(true);
        }, REFRESH_INTERVAL);
    }

    function closeChat() {
        isOpen = false;
        $("#st-chat-panel")?.classList.remove("st-open");
        document.body.classList.remove("st-chat-open");
        hideContextMenu();
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    function openPrivatePage() {
        const url = new URL("pv.html", window.location.href);

        if (currentUser?.id) {
            url.searchParams.set("from", currentUser.id);
        }

        window.location.href = url.href;
    }

    function openPrivateConversation(user) {
        if (!user?.id) {
            notify("Nie udało się ustalić użytkownika.");
            return;
        }

        if (currentUser?.id && user.id === currentUser.id) {
            notify("Nie możesz rozpocząć rozmowy z samym sobą.");
            return;
        }

        const url = new URL("pv.html", window.location.href);
        url.searchParams.set("user_id", user.id);
        url.searchParams.set("username", user.username || "Użytkownik");

        window.location.href = url.href;
    }

    async function initialize() {
        injectStyles();
        createUI();

        client = getClient();

        if (!client || typeof client.auth?.getUser !== "function") {
            setStatus("Supabase nie jest dostępny.");
            renderEmpty("Nie udało się połączyć z Supabase. Sprawdź config.js.");
            return;
        }

        try {
            const { data, error } = await client.auth.getUser();

            if (error) throw error;

            currentUser = data?.user || null;

            if (!currentUser) {
                setStatus("Zaloguj się, aby korzystać z czatu.");
                renderEmpty("Zaloguj się na konto ShadowTale, aby wysyłać wiadomości.");
                $("#st-chat-input").disabled = true;
                $("#st-chat-send").disabled = true;
                return;
            }

            $("#st-chat-input").disabled = false;
            $("#st-chat-send").disabled = false;
            setStatus(`Połączono jako ${nickname(currentUser)}`);

            if (isOpen) loadMessages();
        } catch (error) {
            console.error("[ShadowChat] Błąd logowania:", error);
            setStatus("Błąd sprawdzania konta.");
            renderEmpty("Nie udało się sprawdzić konta. Odśwież stronę.");
        }
    }

    function renderEmpty(text) {
        const container = $("#st-chat-messages");
        if (!container) return;

        container.innerHTML = `<div class="st-chat-empty">${escapeHTML(text)}</div>`;
    }

    async function loadMessages(silent = false) {
        if (!client || !currentUser || isLoading || state.view !== "global") return;

        isLoading = true;

        try {
            /*
             * Używamy select("*"), ponieważ schemat tabeli może mieć
             * kolumnę "message", "content" albo obie.
             */
            const { data, error } = await client
                .from("chat_messages")
                .select("*")
                .order("created_at", { ascending: true })
                .limit(100);

            if (error) throw error;

            messages = Array.isArray(data) ? data : [];

            if (!silent || messages.length) {
                renderMessages();
            }

            setStatus(`Połączono jako ${nickname(currentUser)} • ${messages.length} wiadomości`);
        } catch (error) {
            console.error("[ShadowChat] Błąd ładowania:", error);

            if (!silent) {
                renderEmpty(
                    "Nie udało się załadować wiadomości. Sprawdź tabelę chat_messages i uprawnienia RLS."
                );
            }

            setStatus("Błąd ładowania wiadomości.");
        } finally {
            isLoading = false;
        }
    }

    function renderMessages() {
        const container = $("#st-chat-messages");
        if (!container) return;

        const shouldScroll =
            container.scrollHeight - container.scrollTop - container.clientHeight < 80;

        if (!messages.length) {
            renderEmpty("Nie ma jeszcze wiadomości. Napisz pierwszą!");
            return;
        }

        container.innerHTML = messages.map(message => {
            const id = message.id;
            const userId = message.user_id || "";
            const name = message.username || "Użytkownik";
            const avatar = message.avatar_url || message.avatar || "";
            const content = message.content ?? message.message ?? "";
            const mine = currentUser && userId === currentUser.id;

            return `
                <article class="st-chat-message"
                    data-message-id="${escapeHTML(id)}"
                    data-user-id="${escapeHTML(userId)}">
                    ${avatarHTML(avatar, name)}
                    <div class="st-chat-message-main">
                        <div class="st-chat-message-meta">
                            <span class="st-chat-username"
                                data-action="profile"
                                data-user-id="${escapeHTML(userId)}"
                                data-username="${escapeHTML(name)}"
                                data-avatar="${escapeHTML(avatar)}">${escapeHTML(name)}${mine ? " (Ty)" : ""}</span>
                            <span class="st-chat-time">${escapeHTML(formatTime(message.created_at))}</span>
                        </div>
                        <div class="st-chat-message-content">${escapeHTML(content)}</div>
                    </div>
                </article>
            `;
        }).join("");

        container.querySelectorAll(".st-chat-username").forEach(element => {
            element.addEventListener("click", () => {
                state.contextUser = {
                    id: element.dataset.userId,
                    username: element.dataset.username,
                    avatar_url: element.dataset.avatar
                };
                showProfile(state.contextUser);
            });

            element.addEventListener("contextmenu", event => {
                event.preventDefault();

                state.contextUser = {
                    id: element.dataset.userId,
                    username: element.dataset.username,
                    avatar_url: element.dataset.avatar
                };

                const messageElement = element.closest("[data-message-id]");
                state.contextMessage = messages.find(message =>
                    String(message.id) === String(messageElement?.dataset.messageId)
                ) || null;

                showContextMenu(event.clientX, event.clientY);
            });
        });

        if (shouldScroll) {
            container.scrollTop = container.scrollHeight;
        }
    }

    async function sendMessage(event) {
        event.preventDefault();

        if (!client || !currentUser) {
            notify("Zaloguj się, aby wysłać wiadomość.");
            return;
        }

        const input = $("#st-chat-input");
        const sendButton = $("#st-chat-send");
        const content = input.value.trim();

        if (!content) return;

        if (content.length > MAX_MESSAGE_LENGTH) {
            notify(`Wiadomość może mieć maksymalnie ${MAX_MESSAGE_LENGTH} znaków.`);
            return;
        }

        sendButton.disabled = true;

        try {
            /*
             * WAŻNE: wysyłamy zarówno "message", jak i "content".
             * Twoja tabela wymagała niepustej kolumny "message".
             */
            const payload = {
                user_id: currentUser.id,
                username: nickname(currentUser),
                message: content,
                content
            };

            const avatar = avatarUrl(currentUser);

            if (avatar) {
                payload.avatar_url = avatar;
            }

            const { error } = await client
                .from("chat_messages")
                .insert(payload);

            if (error) throw error;

            input.value = "";
            await loadMessages();
        } catch (error) {
            console.error("[ShadowChat] Błąd wysyłania:", error);

            const message = error?.message || "Nieznany błąd";
            notify(`Błąd wysyłania: ${message}`);
        } finally {
            sendButton.disabled = false;
            input.focus();
        }
    }

    function showContextMenu(x, y) {
        const menu = $("#st-chat-context");
        if (!menu) return;

        menu.style.display = "block";

        const width = menu.offsetWidth || 190;
        const height = menu.offsetHeight || 180;

        menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
    }

    function hideContextMenu() {
        const menu = $("#st-chat-context");
        if (menu) menu.style.display = "none";
    }

    function handleContextAction(event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const action = button.dataset.action;
        const user = state.contextUser;
        const message = state.contextMessage;

        hideContextMenu();

        if (!user) return;

        if (action === "profile") {
            showProfile(user);
        } else if (action === "private") {
            openPrivateConversation(user);
        } else if (action === "report-user") {
            showReportForm({ type: "user", user, message: null });
        } else if (action === "report-message") {
            if (!message) {
                notify("Nie udało się znaleźć wiadomości do zgłoszenia.");
                return;
            }

            showReportForm({ type: "message", user, message });
        }
    }

    function openModal(content, buttons = []) {
        $("#st-chat-modal-content").innerHTML = content;

        const buttonContainer = $("#st-chat-modal-buttons");
        buttonContainer.innerHTML = "";

        buttons.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "st-chat-action";
            button.textContent = item.label;
            button.addEventListener("click", item.onClick);
            buttonContainer.appendChild(button);
        });

        $("#st-chat-modal").classList.add("st-visible");
    }

    function closeModal() {
        $("#st-chat-modal")?.classList.remove("st-visible");
    }

    async function showProfile(user) {
        if (!user?.id) {
            notify("Nie znaleziono profilu tego użytkownika.");
            return;
        }

        openModal(
            `<h3>Profil użytkownika</h3><p>Ładowanie profilu...</p>`,
            [{ label: "Zamknij", onClick: closeModal }]
        );

        let profile = null;

        try {
            const { data, error } = await client
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            if (error) throw error;
            profile = data;
        } catch (error) {
            /*
             * Profil może nie być dostępny przez RLS.
             * W takim wypadku pokazujemy wyłącznie dane z czatu.
             */
            console.warn("[ShadowChat] Nie udało się pobrać profilu:", error);
        }

        const name =
            profile?.username ||
            profile?.nickname ||
            profile?.display_name ||
            user.username ||
            "Użytkownik";

        const avatar =
            profile?.avatar_url ||
            profile?.avatar ||
            user.avatar_url ||
            "";

        const userMessages = messages.filter(message => message.user_id === user.id);
        const count = profile?.message_count ?? userMessages.length;

        const createdAt = profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString("pl-PL")
            : null;

        const content = `
            <div style="text-align:center">
                ${avatarHTML(avatar, name)}
                <h3>${escapeHTML(name)}</h3>
            </div>
            <p>Wiadomości w załadowanej historii czatu: ${escapeHTML(count)}</p>
            ${createdAt ? `<p>Data utworzenia profilu: ${escapeHTML(createdAt)}</p>` : ""}
        `;

        openModal(content, [
            {
                label: "Napisz prywatnie",
                onClick: () => openPrivateConversation({
                    id: user.id,
                    username: name,
                    avatar_url: avatar
                })
            },
            { label: "Zamknij", onClick: closeModal }
        ]);
    }

    function showReportForm({ type, user, message }) {
        if (!currentUser) {
            notify("Zaloguj się, aby wysłać zgłoszenie.");
            return;
        }

        if (user?.id === currentUser.id) {
            notify("Nie możesz zgłosić samego siebie.");
            return;
        }

        const isMessage = type === "message";

        const content = `
            <h3>${isMessage ? "Zgłoś wiadomość" : "Zgłoś użytkownika"}</h3>
            <p>Użytkownik: <strong>${escapeHTML(user?.username || "Użytkownik")}</strong></p>
            ${isMessage ? `<p>Wiadomość: ${escapeHTML(message?.content ?? message?.message ?? "")}</p>` : ""}
            <label for="st-chat-report-reason">Powód zgłoszenia</label>
            <select id="st-chat-report-reason">
                <option value="spam">Spam</option>
                <option value="harassment">Obrażanie lub nękanie</option>
                <option value="inappropriate">Nieodpowiednie treści</option>
                <option value="other">Inny powód</option>
            </select>
            <label for="st-chat-report-details">Dodatkowe informacje (opcjonalnie)</label>
            <textarea id="st-chat-report-details" rows="3" maxlength="500"
                placeholder="Opisz problem..."></textarea>
        `;

        openModal(content, [
            { label: "Anuluj", onClick: closeModal },
            {
                label: "Wyślij zgłoszenie",
                onClick: async () => {
                    const reason = $("#st-chat-report-reason")?.value;
                    const details = $("#st-chat-report-details")?.value.trim() || "";

                    await submitReport({
                        type,
                        user,
                        message,
                        reason,
                        details
                    });
                }
            }
        ]);
    }

    async function submitReport({ type, user, message, reason, details }) {
        try {
            const payload = {
                reporter_id: currentUser.id,
                reported_user_id: user?.id || null,
                reason: details ? `${reason}: ${details}` : reason,
                status: "pending"
            };

            if (type === "message" && message?.id != null) {
                payload.message_id = message.id;
            }

            const { error } = await client
                .from("reports")
                .insert(payload);

            if (error) throw error;

            closeModal();
            notify("Zgłoszenie zostało wysłane.");
        } catch (error) {
            console.error("[ShadowChat] Błąd zgłoszenia:", error);
            notify(`Nie udało się wysłać zgłoszenia: ${error?.message || "sprawdź tabelę reports i RLS"}`);
        }
    }

    function start() {
        injectStyles();
        createUI();
        initialize();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
