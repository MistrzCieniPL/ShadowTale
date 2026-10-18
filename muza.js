
(() => {
    "use strict";

    if (window.__shadowTaleMuzaLoaded) return;
    window.__shadowTaleMuzaLoaded = true;

    const CONFIG = window.CONFIG || window.config || {};
    const API = String(
        CONFIG.musicApi ||
        CONFIG.productFilesApi ||
        CONFIG.apiBaseUrl ||
        CONFIG.backendUrl ||
        "http://127.0.0.1:5500"
    ).replace(/\/+$/, "").replace(/\/api\/music$/i, "").replace(/\/api$/i, "");

    const CATALOG_URL = "muzyka.html";

    let tracks = [];
    let trackIndex = 0;
    let versionIndex = 0;
    let currentTab = "music";
    let repeatMode = "all";
    let panelOpen = false;
    let syncingVideo = false;
    let requestNumber = 0;

    let audio;
    let video;
    let panel;
    let content;
    let nowPlaying;
    let status;
    let launcher;
    let seek;
    let timeLabel;
    let playButton;
    let repeatButton;
    let tabs = [];

    const $ = (tag, attrs = {}, children = []) => {
        const node = document.createElement(tag);

        for (const [key, value] of Object.entries(attrs)) {
            if (key === "text") node.textContent = value;
            else if (key === "class") node.className = value;
            else if (key.startsWith("on") && typeof value === "function") {
                node.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (value !== undefined && value !== null) {
                node.setAttribute(key, String(value));
            }
        }

        children.forEach(child => {
            if (child) node.append(child);
        });

        return node;
    };

    function url(src) {
        if (!src) return "";

        const value = String(src).trim();

        if (/^(https?:|blob:|data:)/i.test(value)) return value;

        return `${API}/${value.replace(/^\/+/, "")}`;
    }

    function currentTrack() {
        return tracks[trackIndex] || null;
    }

    function currentVersion() {
        const versions = currentTrack()?.versions || [];
        return versions[versionIndex] || versions[0] || null;
    }

    function currentSrc() {
        return url(currentVersion()?.src || currentVersion()?.url);
    }

    function currentTimeLabel(seconds) {
        if (!Number.isFinite(seconds)) return "0:00";

        const value = Math.max(0, Math.floor(seconds));

        return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
    }

    function setStatus(message) {
        if (status) status.textContent = message;
    }

    function updateTrackInfo() {
        const track = currentTrack();

        nowPlaying.textContent = track
            ? `♫ ${track.title || track.name || "Utwór"}`
            : "Nie wybrano muzyki";

        updatePlaybackButton();
        updateRepeatButton();
    }

    function updatePlaybackButton() {
        if (!playButton) return;

        playButton.textContent =
            audio && !audio.paused && !audio.ended
                ? "Ⅱ Pauza"
                : "▶ Start";
    }

    function updateRepeatButton() {
        if (!repeatButton) return;

        repeatButton.textContent = repeatMode === "one"
            ? "🔂 Powtarzaj utwór"
            : "🔁 Odtwarzaj po kolei";
    }

    // Zatrzymuje aktualne audio i wyciszony element video.
    // Unieważnia również oczekujące próby odtworzenia.
    function stopAllMedia(clearSources = false) {
        requestNumber++;

        if (audio) {
            audio.pause();

            if (clearSources) {
                audio.removeAttribute("src");
                audio.querySelectorAll("source").forEach(source => source.remove());
                audio.load();
            } else {
                try {
                    audio.currentTime = 0;
                } catch (_) {}
            }
        }

        if (video) {
            video.pause();
            video.muted = true;

            if (clearSources) {
                video.removeAttribute("src");
                video.querySelectorAll("source").forEach(source => source.remove());
                delete video.dataset.src;
                video.load();
            } else {
                try {
                    video.currentTime = 0;
                } catch (_) {}
            }
        }

        updatePlaybackButton();
    }

    function syncVideo() {
        if (!video || !audio || !currentSrc()) return;

        const src = currentSrc();

        if (video.dataset.src !== src) {
            video.pause();
            video.muted = true;
            video.src = src;
            video.dataset.src = src;
            video.load();
        }

        video.playbackRate = audio.playbackRate;
        video.muted = true;

        if (
            Number.isFinite(audio.currentTime) &&
            Number.isFinite(video.currentTime) &&
            Math.abs(video.currentTime - audio.currentTime) > 0.4
        ) {
            syncingVideo = true;

            try {
                video.currentTime = audio.currentTime;
            } catch (_) {}

            syncingVideo = false;
        }

        if (!audio.paused && !audio.ended && video.paused) {
            video.play().catch(() => {});
        } else if ((audio.paused || audio.ended) && !video.paused) {
            video.pause();
        }
    }

    function updateVideoVisibility() {
        if (!video) return;

        const show = currentTab === "film" && Boolean(currentSrc());
        video.style.display = show ? "block" : "none";

        if (show) {
            syncVideo();
        } else {
            video.pause();
        }
    }

    async function selectTrack(index, selectedVersion = 0, autoplay = true) {
        if (!tracks.length) {
            setStatus("Brak muzyki w katalogu.");
            return;
        }

        trackIndex = (index + tracks.length) % tracks.length;
        versionIndex = selectedVersion;

        const src = currentSrc();

        stopAllMedia(true);

        if (!src) {
            updateTrackInfo();
            renderTab();
            setStatus("Ten utwór nie ma jeszcze pliku.");
            return;
        }

        audio.src = src;
        audio.load();

        updateTrackInfo();
        renderTab();

        if (autoplay) {
            const thisRequest = requestNumber;

            try {
                await audio.play();

                if (thisRequest !== requestNumber) {
                    audio.pause();
                    return;
                }

                setStatus("Odtwarzanie muzyki.");
            } catch (_) {
                setStatus("Kliknij Start, aby odtworzyć muzykę.");
            }
        } else {
            setStatus("Wybrano utwór.");
        }

        updatePlaybackButton();
        updateVideoVisibility();
    }

    async function togglePlayback() {
        if (!currentSrc()) {
            setStatus("Brak pliku dla wybranego utworu.");
            return;
        }

        if (!audio.paused && !audio.ended) {
            audio.pause();
            video.pause();
            setStatus("Pauza.");
            updatePlaybackButton();
            return;
        }

        // Video jest wyciszone, aby nie dublowało dźwięku audio.
        video.pause();
        video.muted = true;

        try {
            await audio.play();
            setStatus("Odtwarzanie muzyki.");
        } catch (_) {
            setStatus("Nie udało się odtworzyć pliku. Sprawdź ścieżkę i format.");
        }

        updatePlaybackButton();
        updateVideoVisibility();
    }

    function stopPlayback() {
        stopAllMedia(true);

        if (seek) seek.value = "0";
        if (timeLabel) timeLabel.textContent = "0:00 / 0:00";

        updatePlaybackButton();
        setStatus("Zatrzymano muzykę.");
    }

    async function nextTrack() {
        if (!tracks.length) return;

        if (trackIndex + 1 >= tracks.length && repeatMode !== "all") {
            stopPlayback();
            setStatus("Koniec listy odtwarzania.");
            return;
        }

        await selectTrack(trackIndex + 1, 0, true);
    }

    function toggleRepeat() {
        repeatMode = repeatMode === "all" ? "one" : "all";

        if (audio) audio.loop = repeatMode === "one";

        updateRepeatButton();

        setStatus(
            repeatMode === "one"
                ? "Utwór będzie odtwarzany w kółko."
                : "Utwory będą odtwarzane po kolei."
        );
    }

    function updateTime() {
        if (!audio || !seek || !timeLabel) return;

        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;

        seek.max = String(duration || 0);
        seek.value = String(audio.currentTime || 0);

        timeLabel.textContent =
            `${currentTimeLabel(audio.currentTime)} / ${currentTimeLabel(duration)}`;

        if (currentTab === "film" && !syncingVideo) syncVideo();
    }

    function renderMusic() {
        const track = currentTrack();
        const description = track?.description || "";

        content.append(
            $("div", {
                class: "st-muza-now",
                text: track
                    ? `Teraz: ${track.title || track.name || "Utwór"}`
                    : "Wybierz utwór z katalogu muzycznego."
            })
        );

        const controls = $("div", { class: "st-muza-controls" });

        playButton = $("button", {
            text: audio && !audio.paused ? "Ⅱ Pauza" : "▶ Start",
            onclick: togglePlayback
        });

        repeatButton = $("button", { onclick: toggleRepeat });

        controls.append(
            playButton,
            $("button", { text: "■ Stop", onclick: stopPlayback }),
            $("button", { text: "⏭ Następny", onclick: nextTrack }),
            repeatButton
        );

        content.append(controls);

        seek = $("input", {
            type: "range",
            min: "0",
            max: String(audio.duration || 0),
            step: "0.1",
            value: String(audio.currentTime || 0),
            "aria-label": "Pozycja utworu"
        });

        seek.addEventListener("input", () => {
            if (Number.isFinite(audio.duration)) {
                audio.currentTime = Number(seek.value);
            }

            if (currentTab === "film") syncVideo();

            updateTime();
        });

        timeLabel = $("div", {
            class: "st-muza-time",
            text: `${currentTimeLabel(audio.currentTime)} / ${currentTimeLabel(audio.duration)}`
        });

        content.append(seek, timeLabel);

        if (description) {
            content.append(
                $("p", { class: "st-muza-description", text: description })
            );
        }

        const list = $("div", { class: "st-muza-list" });

        tracks.forEach((trackItem, index) => {
            const button = $("button", {
                class: `st-muza-track${index === trackIndex ? " selected" : ""}`,
                text: `${index === trackIndex ? "♫ " : ""}${trackItem.title || trackItem.name || "Utwór"}`,
                onclick: () => selectTrack(index, 0, true)
            });

            list.append(button);
        });

        content.append(list);
        updateRepeatButton();
    }

    function renderFilm() {
        const track = currentTrack();

        if (!track || !currentSrc()) {
            content.append($("p", {
                text: "Wybierz utwór z plikiem w kategorii Muzyka, aby zobaczyć obraz."
            }));
            return;
        }

        content.append(
            $("p", {
                text: "Film jest zsynchronizowany z aktualnie odtwarzaną muzyką. Dźwięk filmu pozostaje wyciszony."
            }),
            video
        );

        updateVideoVisibility();
        syncVideo();
    }

    function renderText() {
        const track = currentTrack();
        const lyrics = String(track?.lyrics || track?.text || "").trim();

        if (!lyrics) {
            content.append($("p", {
                text: "Do tej piosenki nie ma jeszcze tekstu."
            }));
            return;
        }

        content.append(
            $("h3", { text: track.title || track.name || "Tekst utworu" }),
            $("pre", { class: "st-muza-lyrics", text: lyrics })
        );
    }

    function renderVolume() {
        const slider = $("input", {
            type: "range",
            min: "0",
            max: "1",
            step: "0.01",
            value: String(audio.volume),
            "aria-label": "Głośność piosenki"
        });

        const label = $("p", {
            text: `${Math.round(audio.volume * 100)}%`
        });

        slider.addEventListener("input", () => {
            audio.volume = Number(slider.value);
            label.textContent = `${Math.round(audio.volume * 100)}%`;
        });

        content.append(
            $("h3", { text: "Głośność piosenki" }),
            slider,
            label
        );
    }

    function renderTab() {
        if (!content) return;

        content.replaceChildren();

        tabs.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.tab === currentTab
            );
        });

        if (currentTab === "music") renderMusic();
        if (currentTab === "film") renderFilm();
        if (currentTab === "text") renderText();
        if (currentTab === "volume") renderVolume();

        updateVideoVisibility();
    }

    function switchTab(tab) {
        if (tab === "catalog") {
            window.location.href = CATALOG_URL;
            return;
        }

        currentTab = tab;
        renderTab();
    }

    async function loadTracks() {
        try {
            const response = await fetch(`${API}/api/music`, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Błąd pobierania katalogu muzycznego.");
            }

            const data = await response.json();

            const items = Array.isArray(data)
                ? data
                : (data.tracks || data.items || data.data?.tracks || []);

            tracks = items.filter(item =>
                item.type !== "film" &&
                item.type !== "video"
            );

            if (!tracks.length) {
                stopAllMedia(true);
                setStatus("Katalog muzyczny jest pusty.");
                renderTab();
                return;
            }

            const previousSlug = currentTrack()?.slug;
            const foundIndex = tracks.findIndex(
                item => item.slug === previousSlug
            );

            trackIndex = foundIndex >= 0 ? foundIndex : 0;
            versionIndex = 0;

            stopAllMedia(true);

            const src = currentSrc();

            if (src) {
                audio.src = src;
                audio.load();
            }

            updateTrackInfo();
            renderTab();
            setStatus("Biblioteka muzyki załadowana.");
        } catch (error) {
            console.error("[ShadowTale Muza]", error);
            setStatus(
                "Nie udało się pobrać muzyki. Sprawdź, czy backend jest uruchomiony."
            );
        }
    }

    function build() {
        const style = $("style", {
            text: `
                #st-muza-launcher {
                    position: fixed;
                    left: 20px;
                    bottom: 125px;
                    z-index: 999999;
                    width: 54px;
                    height: 54px;
                    border: 1px solid #b78aff;
                    border-radius: 50%;
                    background: #190e2b;
                    color: white;
                    font-size: 26px;
                    cursor: pointer;
                    box-shadow: 0 0 18px #8b45ff88;
                }
                #st-muza-panel {
                    display: none;
                    position: fixed;
                    left: 20px;
                    bottom: 190px;
                    z-index: 999998;
                    width: min(360px, calc(100vw - 28px));
                    max-height: 70vh;
                    overflow-y: auto;
                    padding: 14px;
                    border: 1px solid #7747b3;
                    border-radius: 15px;
                    background: #0c0914;
                    color: #f4ecff;
                    font: 14px/1.45 system-ui, sans-serif;
                    box-shadow: 0 0 26px #7135b855;
                }
                #st-muza-panel * { box-sizing: border-box; }
                #st-muza-panel button {
                    border: 1px solid #69418d;
                    border-radius: 8px;
                    background: #211431;
                    color: white;
                    padding: 8px 10px;
                    cursor: pointer;
                }
                #st-muza-panel button:hover,
                #st-muza-panel button.active,
                #st-muza-panel button.selected {
                    background: #613795;
                }
                #st-muza-panel .st-muza-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }
                #st-muza-panel .st-muza-header h2 {
                    margin: 0;
                    font-size: 18px;
                }
                #st-muza-panel .st-muza-tabs {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 4px;
                    margin: 12px 0;
                }
                #st-muza-panel .st-muza-tabs button {
                    padding: 7px 2px;
                    font-size: 11px;
                    overflow-wrap: anywhere;
                }
                #st-muza-panel .st-muza-now {
                    padding: 9px;
                    margin-top: 10px;
                    border-radius: 8px;
                    background: #1b1326;
                    overflow-wrap: anywhere;
                }
                #st-muza-panel .st-muza-controls {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin: 10px 0;
                }
                #st-muza-panel input[type=range] {
                    display: block;
                    width: 100%;
                    margin: 12px 0;
                    accent-color: #ac76ff;
                }
                #st-muza-panel .st-muza-time {
                    display: flex;
                    justify-content: flex-end;
                    color: #cdb9e8;
                    font-size: 12px;
                }
                #st-muza-panel .st-muza-list {
                    display: grid;
                    gap: 5px;
                    margin-top: 12px;
                }
                #st-muza-panel .st-muza-track {
                    width: 100%;
                    text-align: left;
                }
                #st-muza-panel .st-muza-description {
                    color: #c8b7dc;
                }
                #st-muza-panel .st-muza-lyrics {
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    font: inherit;
                }
                #st-muza-panel video {
                    width: 100%;
                    max-height: 280px;
                    margin-top: 8px;
                    border-radius: 9px;
                    background: black;
                }
                #st-muza-panel #st-muza-status {
                    color: #cdb9e8;
                    font-size: 12px;
                    margin-bottom: 0;
                }
                @media (max-width: 480px) {
                    #st-muza-launcher {
                        left: 14px;
                        bottom: 110px;
                    }
                    #st-muza-panel {
                        left: 10px;
                        bottom: 174px;
                        width: calc(100vw - 20px);
                    }
                }
            `
        });

        document.head.append(style);

        audio = $("audio", { preload: "metadata" });
        audio.volume = 0.7;
        audio.loop = false;
        audio.style.display = "none";

        video = $("video", {
            controls: "",
            playsinline: "",
            preload: "metadata"
        });

        video.muted = true;
        video.defaultMuted = true;
        video.volume = 0;
        video.style.display = "none";

        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("durationchange", updateTime);

        audio.addEventListener("play", () => {
            updatePlaybackButton();
            syncVideo();
        });

        audio.addEventListener("pause", () => {
            updatePlaybackButton();
            video.pause();
        });

        audio.addEventListener("ended", () => {
            if (repeatMode === "one") return;
            nextTrack();
        });

        audio.addEventListener("error", () => {
            if (audio.currentSrc) {
                setStatus("Nie można odtworzyć pliku audio. Sprawdź, czy plik istnieje.");
            }
        });

        video.addEventListener("loadedmetadata", syncVideo);

        video.addEventListener("seeked", () => {
            if (
                currentTab === "film" &&
                Math.abs(video.currentTime - audio.currentTime) > 0.5
            ) {
                syncVideo();
            }
        });

        nowPlaying = $("div", {
            class: "st-muza-now",
            text: "Ładowanie muzyki..."
        });

        status = $("p", {
            id: "st-muza-status",
            text: "Gotowy."
        });

        const header = $("div", { class: "st-muza-header" }, [
            $("h2", { text: "♫ ShadowTale" }),
            $("button", {
                text: "✕",
                "aria-label": "Zamknij odtwarzacz",
                onclick: () => {
                    panelOpen = false;
                    panel.style.display = "none";
                }
            })
        ]);

        const tabBar = $("nav", { class: "st-muza-tabs" });

        const categories = [
            ["music", "Muzyka"],
            ["film", "Film"],
            ["text", "Tekst"],
            ["volume", "Głośność"],
            ["catalog", "Katalog"]
        ];

        tabs = categories.map(([tab, label]) => {
            const button = $("button", {
                text: label,
                "data-tab": tab,
                onclick: () => switchTab(tab)
            });

            tabBar.append(button);
            return button;
        });

        content = $("div");

        panel = $("section", {
            id: "st-muza-panel",
            "aria-label": "Odtwarzacz ShadowTale"
        }, [header, nowPlaying, tabBar, content, status]);

        launcher = $("button", {
            id: "st-muza-launcher",
            text: "♫",
            title: "Otwórz odtwarzacz muzyki",
            onclick: () => {
                panelOpen = !panelOpen;
                panel.style.display = panelOpen ? "block" : "none";

                if (panelOpen) loadTracks();
            }
        });

        document.body.append(audio, video, panel, launcher);
        renderTab();
    }

    function init() {
        build();
        loadTracks();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
