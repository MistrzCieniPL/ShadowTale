const SHADOWTALE_STATS_KEY =
    "shadowtale_user_statistics_v1";

let shadowTaleSessionStartedAt = Date.now();

let shadowTaleWasHidden = false;

function shadowTaleGetStats() {

    try {

        const raw =
            localStorage.getItem(
                SHADOWTALE_STATS_KEY
            );

        if (!raw) {

            return {
                visits: 0,
                pageViews: 0,
                totalTime: 0,
                firstVisit: null,
                lastVisit: null,
                daily: {},
                pages: {}
            };

        }

        const parsed =
            JSON.parse(raw);

        return {

            visits:
                Number(parsed.visits) || 0,

            pageViews:
                Number(parsed.pageViews) || 0,

            totalTime:
                Number(parsed.totalTime) || 0,

            firstVisit:
                parsed.firstVisit || null,

            lastVisit:
                parsed.lastVisit || null,

            daily:
                parsed.daily || {},

            pages:
                parsed.pages || {}
        };

    } catch (error) {

        console.error(
            "ShadowTale statistics error:",
            error
        );

        return {
            visits: 0,
            pageViews: 0,
            totalTime: 0,
            firstVisit: null,
            lastVisit: null,
            daily: {},
            pages: {}
        };

    }

}



function shadowTaleSaveStats(stats) {

    try {

        localStorage.setItem(
            SHADOWTALE_STATS_KEY,
            JSON.stringify(stats)
        );

    } catch (error) {

        console.error(
            "ShadowTale statistics save error:",
            error
        );

    }

}


function shadowTaleDateKey(date) {

    return [
        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(2, "0"),

        String(
            date.getDate()
        ).padStart(2, "0")

    ].join("-");

}



function shadowTaleCurrentPage() {

    const path =
        window.location.pathname
            .split("/")
            .pop();

    return path || "index.html";

}

function shadowTaleRegisterVisit() {

    const stats =
        shadowTaleGetStats();

    const now =
        new Date();

    const iso =
        now.toISOString();

    const dateKey =
        shadowTaleDateKey(now);

    /*
     * Każde otwarcie strony = jedna sesja/wizyta.
     */

    stats.visits++;

    /*
     * Każde otwarcie strony = odsłona.
     */

    stats.pageViews++;

    /*
     * Pierwsza wizyta.
     */

    if (!stats.firstVisit) {

        stats.firstVisit =
            iso;

    }

    /*
     * Ostatnia aktywność.
     */

    stats.lastVisit =
        iso;

    /*
     * Statystyki dzienne.
     */

    if (!stats.daily[dateKey]) {

        stats.daily[dateKey] = {
            visits: 0,
            time: 0
        };

    }

    stats.daily[dateKey].visits++;

    /*
     * Statystyki konkretnych stron.
     */

    const page =
        shadowTaleCurrentPage();

    if (!stats.pages[page]) {

        stats.pages[page] = 0;

    }

    stats.pages[page]++;

    shadowTaleSaveStats(stats);

}


/* ============================================================
   ZAPIS CZASU SESJI
============================================================ */

function shadowTaleSaveSessionTime() {

    const elapsed =
        Math.floor(
            (
                Date.now() -
                shadowTaleSessionStartedAt
            ) / 1000
        );

    /*
     * Nie zapisujemy zerowego czasu.
     */

    if (elapsed <= 0) {
        return;
    }

    const stats =
        shadowTaleGetStats();

    /*
     * Łączny czas całego ShadowTale.
     */

    stats.totalTime +=
        elapsed;

    /*
     * Czas dzienny.
     */

    const now =
        new Date();

    const dateKey =
        shadowTaleDateKey(now);

    if (!stats.daily[dateKey]) {

        stats.daily[dateKey] = {
            visits: 0,
            time: 0
        };

    }

    stats.daily[dateKey].time +=
        elapsed;

    stats.lastVisit =
        now.toISOString();

    shadowTaleSaveStats(stats);

    /*
     * Resetujemy początek odcinka.
     *
     * Dzięki temu nie naliczamy
     * tego samego czasu drugi raz.
     */

    shadowTaleSessionStartedAt =
        Date.now();

}


/* ============================================================
   CO 10 SEKUND
============================================================ */

setInterval(
    () => {

        shadowTaleSaveSessionTime();

    },
    10000
);


/* ============================================================
   ZMIANA KARTY
============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {

        if (document.hidden) {

            shadowTaleSaveSessionTime();

            shadowTaleWasHidden =
                true;

        } else if (
            shadowTaleWasHidden
        ) {

            shadowTaleSessionStartedAt =
                Date.now();

            shadowTaleWasHidden =
                false;

        }

    }
);


/* ============================================================
   OPUSZCZENIE STRONY
============================================================ */

window.addEventListener(
    "pagehide",
    () => {

        shadowTaleSaveSessionTime();

    }
);


/*
 * beforeunload jako dodatkowe zabezpieczenie.
 */

window.addEventListener(
    "beforeunload",
    () => {

        shadowTaleSaveSessionTime();

    }
);


/* ============================================================
   START
============================================================ */

shadowTaleRegisterVisit();