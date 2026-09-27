(() => {
    "use strict";

    const MUSIC_FILE = "assets/music/shadowtale.mp3";
    const STORAGE_KEY = "shadowtale_music_position";
    const AUDIO_ID = "shadowtale-music";

    // Nie twórz drugiego odtwarzacza
    let audio = document.getElementById(AUDIO_ID);

    if (!audio) {
        audio = document.createElement("audio");

        audio.id = AUDIO_ID;
        audio.src = MUSIC_FILE;

        audio.loop = true;
        audio.preload = "auto";
        audio.autoplay = true;

        // Brak widocznych kontrolek
        audio.controls = false;

        // Nie pokazuj elementu na stronie
        audio.style.display = "none";

        document.body.appendChild(audio);
    }

    // -----------------------------------------
    // PRZYWRACANIE POZYCJI
    // -----------------------------------------

    let savedPosition = 0;

    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const number = Number(saved);

            if (Number.isFinite(number) && number >= 0) {
                savedPosition = number;
            }
        }
    } catch (error) {
        console.warn("ShadowTale Music: błąd sessionStorage.", error);
    }

    // Po załadowaniu informacji o pliku MP3
    audio.addEventListener("loadedmetadata", () => {
        if (
            savedPosition > 0 &&
            Number.isFinite(audio.duration) &&
            savedPosition < audio.duration
        ) {
            try {
                audio.currentTime = savedPosition;
            } catch (error) {
                console.warn(
                    "ShadowTale Music: nie można ustawić pozycji.",
                    error
                );
            }
        }
    }, { once: true });


    // -----------------------------------------
    // ZAPISYWANIE POZYCJI
    // -----------------------------------------

    function savePosition() {
        try {
            if (
                audio &&
                Number.isFinite(audio.currentTime)
            ) {
                sessionStorage.setItem(
                    STORAGE_KEY,
                    String(audio.currentTime)
                );
            }
        } catch (error) {
            console.warn(
                "ShadowTale Music: nie można zapisać pozycji.",
                error
            );
        }
    }

    audio.addEventListener("timeupdate", savePosition);

    // Zapisz również tuż przed opuszczeniem strony
    window.addEventListener("pagehide", savePosition);
    window.addEventListener("beforeunload", savePosition);


    // -----------------------------------------
    // URUCHAMIANIE MUZYKI
    // -----------------------------------------

    function startMusic() {
        if (!audio) return;

        if (!audio.paused) return;

        const promise = audio.play();

        if (promise && typeof promise.catch === "function") {
            promise.catch(() => {
                // Przeglądarka zablokowała autoplay.
                // Spróbujemy ponownie po interakcji użytkownika.
            });
        }
    }


    // Próba od razu
    startMusic();


    // -----------------------------------------
    // AUTOPLAY PO INTERAKCJI
    // -----------------------------------------

    function userInteraction() {
        startMusic();
    }

    document.addEventListener(
        "click",
        userInteraction,
        {
            once: true,
            passive: true
        }
    );

    document.addEventListener(
        "keydown",
        userInteraction,
        {
            once: true,
            passive: true
        }
    );

    document.addEventListener(
        "touchstart",
        userInteraction,
        {
            once: true,
            passive: true
        }
    );


    // -----------------------------------------
    // POWRÓT DO KARTY
    // -----------------------------------------

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            startMusic();
        }
    });


    // -----------------------------------------
    // DEBUG
    // -----------------------------------------

    window.ShadowTaleMusic = audio;

    console.log(
        "%cShadowTale Music",
        "color:#9b5cff;font-weight:bold;",
        "załadowano"
    );

})();