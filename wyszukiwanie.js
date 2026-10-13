/* ============================================================
   ShadowTale — GLOBALNA WYSZUKIWARKA
   wyszukiwanie.js
============================================================ */

(() => {
    "use strict";

    /* ============================================================
       KONFIGURACJA
    ============================================================ */

    const SEARCH_LIMIT = 8;

    let products = [];
    let productsLoaded = false;
    let loadingPromise = null;


    /* ============================================================
       ELEMENTY
    ============================================================ */

    const getElements = () => ({
        form: document.getElementById("global-search-form"),
        input: document.getElementById("global-search"),
        results: document.getElementById("search-results"),
        button: document.getElementById("search-button")
    });


    /* ============================================================
       NORMALIZACJA TEKSTU
    ============================================================ */

    function normalizeSearchText(value) {
        return String(value ?? "")
            .toLocaleLowerCase("pl-PL")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ł/g, "l")
            .replace(/\s+/g, " ")
            .trim();
    }


    /* ============================================================
       ESCAPE HTML
    ============================================================ */

    function escapeHtml(value) {
        const div = document.createElement("div");

        div.textContent = String(value ?? "");

        return div.innerHTML;
    }


    /* ============================================================
       SUPABASE
    ============================================================ */

    function getSupabaseClient() {
        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {
            return window.supabaseClient;
        }

        if (
            window.authClient &&
            typeof window.authClient.from === "function"
        ) {
            return window.authClient;
        }

        if (
            window.supabase &&
            typeof window.supabase.createClient === "function"
        ) {
            const config = window.CONFIG;

            if (
                config &&
                config.supabaseUrl &&
                config.supabaseKey
            ) {
                if (!window.__shadowtaleSearchClient) {
                    window.__shadowtaleSearchClient =
                        window.supabase.createClient(
                            config.supabaseUrl,
                            config.supabaseKey
                        );
                }

                return window.__shadowtaleSearchClient;
            }
        }

        return null;
    }


    /* ============================================================
       POBIERANIE PRODUKTÓW
    ============================================================ */

    async function loadProducts() {
        if (productsLoaded) {
            return products;
        }

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise = (async () => {
            const client = getSupabaseClient();

            if (!client) {
                console.warn(
                    "ShadowTale: nie znaleziono klienta Supabase."
                );

                return [];
            }

            try {
                const { data, error } = await client
                    .from("products")
                    .select(`
                        id,
                        owner_id,
                        name,
                        slug,
                        description,
                        category,
                        world,
                        type,
                        product_type,
                        price,
                        is_free,
                        blocked,
                        downloads_enabled,
                        file_verified,
                        minecraft_version,
                        required_plugins,
                        created_at
                    `)
                    .eq("blocked", false)
                    .order("created_at", {
                        ascending: false
                    });

                if (error) {
                    console.error(
                        "ShadowTale: błąd pobierania produktów:",
                        error
                    );

                    return [];
                }

                products = Array.isArray(data)
                    ? data
                    : [];

                productsLoaded = true;

                return products;

            } catch (error) {
                console.error(
                    "ShadowTale: wyjątek podczas pobierania produktów:",
                    error
                );

                return [];

            } finally {
                loadingPromise = null;
            }
        })();

        return loadingPromise;
    }


    /* ============================================================
       URL KATEGORII
    ============================================================ */

    function getProductCategoryUrl(product) {
        const world = normalizeSearchText(
            product?.world
        );

        const category = normalizeSearchText(
            product?.category
        );

        const type = normalizeSearchText(
            product?.type
        );

        const productType = normalizeSearchText(
            product?.product_type
        );

        const combined =
            `${category} ${type} ${productType}`;


        /* --------------------------------------------------------
           UNDERTALE / OMEGATALE
        -------------------------------------------------------- */

        if (
            world.includes("undertale") ||
            world.includes("omega") ||
            combined.includes("undertale")
        ) {
            return "undertale.html";
        }


        /* --------------------------------------------------------
           SKRYPTY
        -------------------------------------------------------- */

        if (
            combined.includes("skrypt") ||
            combined.includes("skript") ||
            combined.includes("script")
        ) {
            return "mc-skrypty.html";
        }


        /* --------------------------------------------------------
           MAPY
        -------------------------------------------------------- */

        if (
            combined.includes("mapa") ||
            combined.includes("mapy") ||
            combined.includes("map ")
        ) {
            return "mc-mapy.html";
        }


        /* --------------------------------------------------------
           CONFIGI
        -------------------------------------------------------- */

        if (
            combined.includes("config") ||
            combined.includes("konfig")
        ) {
            return "mc-configi.html";
        }


        /* --------------------------------------------------------
           TXT / TEKSTURY
        -------------------------------------------------------- */

        if (
            combined.includes("txt") ||
            combined.includes("tekstur") ||
            combined.includes("resource pack") ||
            combined.includes("texture")
        ) {
            return "mc-txt.html";
        }


        /* --------------------------------------------------------
           SKINY
        -------------------------------------------------------- */

        if (
            combined.includes("skin") ||
            combined.includes("skiny")
        ) {
            return "mc-skiny.html";
        }


        /* --------------------------------------------------------
           DOMYŚLNA KATEGORIA MINECRAFT
        -------------------------------------------------------- */

        if (
            world.includes("minecraft") ||
            world.includes("mc") ||
            combined.length > 0
        ) {
            return "minecraft.html";
        }


        return "minecraft.html";
    }


    /* ============================================================
       URL KONKRETNEGO PRODUKTU / WYNIKU WYSZUKIWANIA
    ============================================================ */

    function getProductUrl(product) {
        const page =
            getProductCategoryUrl(product);

        const name =
            String(product?.name || "").trim();

        if (!name) {
            return page;
        }

        return (
            page +
            "?search=" +
            encodeURIComponent(name)
        );
    }


    /* ============================================================
       CENA
    ============================================================ */

    function formatPrice(product) {
        const isFree =
            product?.is_free === true ||
            Number(product?.price || 0) <= 0;

        if (isFree) {
            return "Darmowy";
        }

        const price =
            Number(product.price || 0);

        return (
            price
                .toFixed(2)
                .replace(".", ",") +
            " zł"
        );
    }


    /* ============================================================
       TEKST DO WYSZUKIWANIA
    ============================================================ */

    function getSearchableText(product) {
        return normalizeSearchText([
            product?.name,
            product?.slug,
            product?.description,
            product?.category,
            product?.world,
            product?.type,
            product?.product_type,
            product?.minecraft_version,
            product?.required_plugins
        ].join(" "));
    }


    /* ============================================================
       PUNKTACJA WYNIKU
    ============================================================ */

    function getSearchScore(product, query) {
        const normalizedQuery =
            normalizeSearchText(query);

        if (!normalizedQuery) {
            return 0;
        }

        const name =
            normalizeSearchText(
                product?.name
            );

        const slug =
            normalizeSearchText(
                product?.slug
            );

        const description =
            normalizeSearchText(
                product?.description
            );

        const category =
            normalizeSearchText(
                product?.category
            );

        const type =
            normalizeSearchText(
                product?.type
            );

        const productType =
            normalizeSearchText(
                product?.product_type
            );

        const words =
            normalizedQuery
                .split(/\s+/)
                .filter(Boolean);

        let score = 0;


        /* --------------------------------------------------------
           NAJWAŻNIEJSZE: DOKŁADNA NAZWA
        -------------------------------------------------------- */

        if (
            name === normalizedQuery
        ) {
            score += 100000;
        }


        /* --------------------------------------------------------
           NAZWA ZACZYNA SIĘ OD ZAPYTANIA
        -------------------------------------------------------- */

        if (
            name.startsWith(
                normalizedQuery
            )
        ) {
            score += 30000;
        }


        /* --------------------------------------------------------
           NAZWA ZAWIERA CAŁE ZAPYTANIE
        -------------------------------------------------------- */

        if (
            name.includes(
                normalizedQuery
            )
        ) {
            score += 15000;
        }


        /* --------------------------------------------------------
           SŁOWA ZAPYTANIA
        -------------------------------------------------------- */

        for (const word of words) {

            if (
                name === word
            ) {
                score += 12000;
            }

            if (
                name.startsWith(word)
            ) {
                score += 6000;
            }

            if (
                name.includes(word)
            ) {
                score += 4000;
            }

            if (
                slug.includes(word)
            ) {
                score += 1200;
            }

            if (
                category.includes(word)
            ) {
                score += 600;
            }

            if (
                type.includes(word)
            ) {
                score += 500;
            }

            if (
                productType.includes(word)
            ) {
                score += 500;
            }

            if (
                description.includes(word)
            ) {
                score += 100;
            }
        }


        /* --------------------------------------------------------
           DODATKOWY BONUS ZA PIERWSZE SŁOWO NAZWY
        -------------------------------------------------------- */

        const nameWords =
            name
                .split(/\s+/)
                .filter(Boolean);

        if (
            words.length &&
            nameWords.length
        ) {
            if (
                nameWords[0] === words[0]
            ) {
                score += 5000;
            }
        }


        return score;
    }


    /* ============================================================
       CZY PRODUKT PASUJE
    ============================================================ */

    function productMatches(
        product,
        query
    ) {
        const normalizedQuery =
            normalizeSearchText(query);

        if (!normalizedQuery) {
            return false;
        }

        const searchable =
            getSearchableText(product);

        const words =
            normalizedQuery
                .split(/\s+/)
                .filter(Boolean);

        return words.every(
            word =>
                searchable.includes(word)
        );
    }


    /* ============================================================
       WYSZUKIWANIE
    ============================================================ */

    function searchProducts(query) {
        const normalizedQuery =
            normalizeSearchText(query);

        if (!normalizedQuery) {
            return [];
        }

        return products
            .filter(product =>
                productMatches(
                    product,
                    normalizedQuery
                )
            )
            .map(product => ({
                product,
                score:
                    getSearchScore(
                        product,
                        normalizedQuery
                    )
            }))
            .sort((a, b) => {

                if (
                    b.score !== a.score
                ) {
                    return (
                        b.score -
                        a.score
                    );
                }

                const dateA =
                    new Date(
                        a.product?.created_at || 0
                    ).getTime();

                const dateB =
                    new Date(
                        b.product?.created_at || 0
                    ).getTime();

                return dateB - dateA;
            })
            .slice(
                0,
                SEARCH_LIMIT
            );
    }


    /* ============================================================
       RENDER WYNIKÓW
    ============================================================ */

    function renderResults(
        matches,
        query
    ) {
        const elements =
            getElements();

        const results =
            elements.results;

        if (!results) {
            return;
        }


        if (!query) {
            results.innerHTML = "";

            results.style.display =
                "none";

            return;
        }


        if (!matches.length) {

            results.innerHTML = `
                <div class="search-no-results">

                    <strong>
                        🔎 Nie znaleziono
                    </strong>

                    <p>
                        Nie znaleziono produktu pasującego
                        do „${escapeHtml(query)}”.
                    </p>

                    <a
                        href="custom.html"
                        class="search-custom-button"
                    >
                        🛠️ Zamów Custom
                    </a>

                </div>
            `;

            results.style.display =
                "block";

            return;
        }


        results.innerHTML =
            matches
                .map(({ product }) => {

                    const name =
                        escapeHtml(
                            product?.name ||
                            "Bez nazwy"
                        );

                    const category =
                        escapeHtml(
                            product?.category ||
                            product?.type ||
                            product?.world ||
                            "Produkt"
                        );

                    const version =
                        product?.minecraft_version
                            ? `
                                <span>
                                    ${escapeHtml(
                                        product.minecraft_version
                                    )}
                                </span>
                            `
                            : "";

                    const price =
                        escapeHtml(
                            formatPrice(product)
                        );

                    const url =
                        escapeHtml(
                            getProductUrl(
                                product
                            )
                        );


                    return `
                        <a
                            href="${url}"
                            class="search-result-item"
                        >

                            <span class="search-result-name">
                                ${name}
                            </span>

                            <span class="search-result-meta">

                                <span>
                                    ${category}
                                </span>

                                ${version}

                                <span class="search-result-price">
                                    ${price}
                                </span>

                            </span>

                        </a>
                    `;
                })
                .join("");


        results.style.display =
            "block";
    }


    /* ============================================================
       LOADING
    ============================================================ */

    function renderLoading() {
        const elements =
            getElements();

        if (!elements.results) {
            return;
        }

        elements.results.innerHTML = `
            <div class="search-loading">
                🔎 Szukam...
            </div>
        `;

        elements.results.style.display =
            "block";
    }


    /* ============================================================
       WYSZUKAJ I POKAŻ
    ============================================================ */

    async function performSearch(
        query
    ) {
        const normalized =
            normalizeSearchText(query);

        if (!normalized) {

            renderResults(
                [],
                ""
            );

            return [];

        }

        renderLoading();

        await loadProducts();

        const matches =
            searchProducts(
                normalized
            );

        renderResults(
            matches,
            query
        );

        return matches;
    }


    /* ============================================================
       PRZEJŚCIE DO NAJLEPSZEGO WYNIKU
    ============================================================ */

    async function openBestResult(
        query
    ) {
        const normalized =
            normalizeSearchText(query);

        if (!normalized) {
            return;
        }

        await loadProducts();


        /* --------------------------------------------------------
           NAJPIERW DOKŁADNA NAZWA
        -------------------------------------------------------- */

        const exact =
            products
                .filter(product =>
                    normalizeSearchText(
                        product?.name
                    ) === normalized
                )
                .sort((a, b) => {

                    const dateA =
                        new Date(
                            a?.created_at || 0
                        ).getTime();

                    const dateB =
                        new Date(
                            b?.created_at || 0
                        ).getTime();

                    return dateB - dateA;
                });


        if (exact.length) {

            window.location.href =
                getProductUrl(
                    exact[0]
                );

            return;
        }


        /* --------------------------------------------------------
           NAJLEPSZE DOPASOWANIE
        -------------------------------------------------------- */

        const matches =
            searchProducts(
                normalized
            );


        if (matches.length) {

            window.location.href =
                getProductUrl(
                    matches[0].product
                );

            return;
        }


        /* --------------------------------------------------------
           BRAK WYNIKU
        -------------------------------------------------------- */

        renderResults(
            [],
            query
        );
    }


    /* ============================================================
       EVENTY
    ============================================================ */

    function setupEvents() {
        const elements =
            getElements();

        const form =
            elements.form;

        const input =
            elements.input;

        const results =
            elements.results;


        if (!input) {
            return;
        }


        /* --------------------------------------------------------
           WPISYWANIE
        -------------------------------------------------------- */

        input.addEventListener(
            "input",
            () => {

                const value =
                    input.value.trim();

                if (!value) {

                    renderResults(
                        [],
                        ""
                    );

                    return;
                }

                performSearch(
                    value
                );
            }
        );


        /* --------------------------------------------------------
           ENTER
        -------------------------------------------------------- */

        form?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                const value =
                    input.value.trim();

                if (!value) {
                    return;
                }

                openBestResult(
                    value
                );
            }
        );


        /* --------------------------------------------------------
           FOCUS
        -------------------------------------------------------- */

        input.addEventListener(
            "focus",
            () => {

                const value =
                    input.value.trim();

                if (!value) {
                    return;
                }

                performSearch(
                    value
                );
            }
        );


        /* --------------------------------------------------------
           KLIK POZA WYSZUKIWARKĄ
        -------------------------------------------------------- */

        document.addEventListener(
            "click",
            event => {

                if (
                    !event.target.closest(
                        ".header-search"
                    )
                ) {

                    if (results) {
                        results.style.display =
                            "none";
                    }
                }
            }
        );


        /* --------------------------------------------------------
           ESC
        -------------------------------------------------------- */

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    input.value = "";

                    if (results) {
                        results.innerHTML =
                            "";

                        results.style.display =
                            "none";
                    }

                    input.blur();
                }
            }
        );
    }


    /* ============================================================
       START
    ============================================================ */

    function init() {
        setupEvents();

        loadProducts()
            .catch(error => {

                console.error(
                    "ShadowTale: nie udało się uruchomić wyszukiwarki.",
                    error
                );

            });
    }


    /* ============================================================
       CZEKAJ NA DOM
    ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();

    }

})();
