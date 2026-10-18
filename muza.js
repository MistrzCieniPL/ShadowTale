
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
    )
        .replace(/\/+$/, "")
        .replace(/\/api\/music$/i, "")
        .replace(/\/api$/i, "");

    const CATALOG_URL = "muzyka.html";

    let tracks = [];
    let trackIndex = 0;
    let versionIndex = 0;
    let currentTab = "music";
    let repeatMode = "all";
    let panelOpen = false;
    let loadingTracks = false;

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
            if (key === "text") {
                node.textContent = value;
            } else if (key === "class") {
                node.className = value;
            } else if (key.startsWith("on") && typeof value === "function") {
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

        if (/^(https?:|blob:|data:)/i.test(value)) {
            return value;
        }

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
        const version = currentVersion();

        if (!version) return "";

        let src = version.src || version.url || "";

        if (!src && version.filename) {
            src = "assets/music/" + version.filename;
        }

        return url(src);
    }

    function isMp4Track() {
        const version = currentVersion();
        const src = currentSrc();

        return /\.mp4(?:$|[?#])/i.test(src) ||
            /\.mp4$/i.test(String(version?.filename || ""));
    }

    // MP4 odtwarzamy przez video nawet wtedy, gdy zakładka Film jest zamknięta.
    // Dzięki temu dźwięk może działać w tle bez drugiego, niesynchronizowanego odtwarzacza.
    function activeMedia() {
        return isMp4Track() ? video : audio;
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

        const media = activeMedia();

        playButton.textContent = media && !media.paused
            ? "Ⅱ Pauza"
            : "▶ Start";
    }

    function updateRepeatButton() {
        if (!repeatButton) return;

        repeatButton.textContent = repeatMode === "one"
            ? "🔂 Powtarzaj utwór"
            : "🔁 Odtwarzaj po kolei";
    }

    function updateVideoVisibility() {
        if (!video) return;

        const showVideo =
            currentTab === "film" &&
            isMp4Track() &&
            Boolean(currentSrc());

        video.style.display = showVideo ? "block" : "none";

        if (showVideo) {
            video.controls = true;
        }
    }

    function updateTime() {
        if (!seek || !timeLabel) return;

        const media = activeMedia();

        if (!media) return;

        const duration = Number.isFinite(media.duration)
            ? media.duration
            : 0;

        seek.max = String(duration || 0);
        seek.value = String(media.currentTime || 0);

        timeLabel.textContent =
            `${currentTimeLabel(media.currentTime)} / ${currentTimeLabel(duration)}`;
    }

    function configureSource() {
        const src = currentSrc();

        audio.pause();
        video.pause();

        audio.removeAttribute("src");
        video.removeAttribute("src");

        audio.load();
        video.load();

        if (!src) {
            updateVideoVisibility();
            return;
        }

        if (isMp4Track()) {
            video.src = src;
            video.muted = false;
            video.controls = true;
            video.loop = repeatMode === "one";
            video.load();
        } else {
            audio.src = src;
            audio.loop = repeatMode === "one";
            audio.load();
        }

        updateVideoVisibility();
        updateTime();
    }

    async function selectTrack(index, selectedVersion = 0, autoplay = true) {
        if (!tracks.length) {
            setStatus("Brak muzyki w katalogu.");
            return;
        }

        trackIndex = (index + tracks.length) % tracks.length;

        const versions = currentTrack()?.versions || [];

        versionIndex = Math.min(
            Math.max(0, selectedVersion),
            Math.max(0, versions.length - 1)
        );

        if (!currentSrc()) {
            setStatus("Ten utwór nie ma jeszcze przypisanego pliku.");
            updateTrackInfo();
            renderTab();
            return;
        }

        configureSource();
        updateTrackInfo();
        renderTab();

        if (autoplay) {
            try {
                await activeMedia().play();
                setStatus("Odtwarzanie: " + (currentTrack()?.title || "utwór"));
            } catch (error) {
                console.warn("[ShadowTale Muza] Nie udało się uruchomić:", error);
                setStatus("Kliknij Start, aby odtworzyć utwór.");
            }
        } else {
            setStatus("Wybrano utwór.");
        }

        updatePlaybackButton();
        updateVideoVisibility();
        updateTime();
    }

    async function togglePlayback() {
        const src = currentSrc();

        if (!src) {
            setStatus("Wybierz utwór z plikiem w katalogu.");
            return;
        }

        const media = activeMedia();

        if (media.paused) {
            try {
                await media.play();
                setStatus("Odtwarzanie.");
            } catch (error) {
                console.warn("[ShadowTale Muza] Odtwarzanie:", error);
                setStatus("Nie udało się rozpocząć odtwarzania. Spróbuj ponownie.");
            }
        } else {
            media.pause();
            setStatus("Pauza.");
        }

        updatePlaybackButton();
        updateVideoVisibility();
        updateTime();
    }

    function stopPlayback() {
        const media = activeMedia();

        media.pause();

        try {
            media.currentTime = 0;
        } catch (_) {}

        if (seek) seek.value = "0";

        updatePlaybackButton();
        updateTime();
        setStatus("Zatrzymano odtwarzanie.");
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

        audio.loop = repeatMode === "one";
        video.loop = repeatMode === "one";

        updateRepeatButton();

        setStatus(
            repeatMode === "one"
                ? "Utwór będzie odtwarzany w kółko."
                : "Utwory będą odtwarzane po kolei."
        );
    }

    function renderMusic() {
        const track = currentTrack();
        const versions = track?.versions || [];

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
            text: "▶ Start",
            onclick: togglePlayback
        });

        repeatButton = $("button", {
            onclick: toggleRepeat
        });

        controls.append(
            playButton,
            $("button", { text: "■ Stop", onclick: stopPlayback }),
            $("button", { text: "⏭ Następny", onclick: nextTrack }),
            repeatButton
        );

        content.append(controls);

        if (versions.length > 1) {
            const versionSelect = $("select", {
                "aria-label": "Wybierz wersję językową"
            });

            versions.forEach((version, index) => {
                const option = $("option", {
                    value: String(index),
                    text: `${version.name || version.language || "Wersja"} (${version.language || "—"})`
                });

                if (index === versionIndex) option.selected = true;

                versionSelect.append(option);
            });

            versionSelect.addEventListener("change", () => {
                selectTrack(trackIndex, Number(versionSelect.value), false);
            });

            content.append(
                $("label", { text: "Wersja utworu" }),
                versionSelect
            );
        }

        seek = $("input", {
            type: "range",
            min: "0",
            max: "0",
            step: "0.1",
            value: "0",
            "aria-label": "Pozycja utworu"
        });

        seek.addEventListener("input", () => {
            const media = activeMedia();

            media.currentTime = Number(seek.value);
            updateTime();
        });

        timeLabel = $("div", {
            class: "st-muza-time",
            text: "0:00 / 0:00"
        });

        content.append(seek, timeLabel);

        if (track?.description) {
            content.append(
                $("p", {
                    class: "st-muza-description",
                    text: track.description
                })
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
        updatePlaybackButton();
        updateTime();
    }

    function renderFilm() {
        const track = currentTrack();

        if (!track || !currentSrc()) {
            content.append($("p", {
                text: "Wybierz utwór z przypisanym plikiem."
            }));
            return;
        }

        if (!isMp4Track()) {
            content.append($("p", {
                text: "Ten utwór nie ma wersji MP4. Dodaj wersję filmową w katalogu muzyki."
            }));
            return;
        }

        content.append(
            $("p", {
                text: "Film odtwarza się z dźwiękiem. Sterowanie jest wspólne z zakładką Muzyka."
            }),
            video
        );

        updateVideoVisibility();
    }

    function renderText() {
        const track = currentTrack();

        const lyrics = String(
            track?.lyrics || track?.text || ""
        ).trim();

        if (!lyrics) {
            content.append($("p", {
                text: "Do tej piosenki nie ma jeszcze tekstu."
            }));
            return;
        }

        content.append(
            $("h3", {
                text: track.title || track.name || "Tekst utworu"
            }),
            $("pre", {
                class: "st-muza-lyrics",
                text: lyrics
            })
        );
    }

    function renderVolume() {
        const media = activeMedia();

        const slider = $("input", {
            type: "range",
            min: "0",
            max: "1",
            step: "0.01",
            value: String(media.volume),
            "aria-label": "Głośność utworu"
        });

        const label = $("p", {
            text: `${Math.round(media.volume * 100)}%`
        });

        slider.addEventListener("input", () => {
            const volume = Number(slider.value);

            audio.volume = volume;
            video.volume = volume;

            label.textContent = `${Math.round(volume * 100)}%`;
        });

        content.append(
            $("h3", { text: "Głośność utworu" }),
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
        if (loadingTracks) return;

        loadingTracks = true;

        try {
            const response = await fetch(`${API}/api/music`, {
                headers: { Accept: "application/json" }
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
                audio.pause();
                video.pause();

                setStatus("Katalog muzyczny jest pusty.");
                renderTab();
                return;
            }

            const previousSlug = currentTrack()?.slug;

            const foundIndex = tracks.findIndex(
                item => item.slug === previousSlug
            );

            trackIndex = foundIndex >= 0 ? foundIndex : 0;

            const versions = currentTrack()?.versions || [];

            if (versionIndex >= versions.length) {
                versionIndex = 0;
            }

            configureSource();
            updateTrackInfo();
            renderTab();

            setStatus("Katalog muzyczny załadowany.");
        } catch (error) {
            console.error("[ShadowTale Muza]", error);
            setStatus(
                "Nie udało się pobrać muzyki. Sprawdź, czy backend działa."
            );
        } finally {
            loadingTracks = false;
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

                #st-muza-panel button,
                #st-muza-panel select {
                    border: 1px solid #69418d;
                    border-radius: 8px;
                    background: #211431;
                    color: white;
                    padding: 8px 10px;
                    cursor: pointer;
                    font: inherit;
                }

                #st-muza-panel select {
                    width: 100%;
                    margin: 6px 0;
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

        video.volume = 0.7;
        video.muted = false;
        video.style.display = "none";

        function handleMediaEvent(event) {
            if (event.currentTarget !== activeMedia()) return;

            updatePlaybackButton();
            updateTime();
            updateVideoVisibility();
        }

        [audio, video].forEach(media => {
            media.addEventListener("timeupdate", handleMediaEvent);
            media.addEventListener("durationchange", handleMediaEvent);
            media.addEventListener("loadedmetadata", handleMediaEvent);
            media.addEventListener("play", handleMediaEvent);
            media.addEventListener("pause", handleMediaEvent);

            media.addEventListener("ended", () => {
                if (media !== activeMedia()) return;
                if (repeatMode === "one") return;

                nextTrack();
            });

            media.addEventListener("error", () => {
                if (media !== activeMedia()) return;

                setStatus(
                    "Nie udało się odtworzyć pliku. Sprawdź jego nazwę i format."
                );
            });
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

                if (panelOpen) {
                    loadTracks();
                }
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
