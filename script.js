// ============================================================
//                     SHADOWTALE
//              SYSTEM KONT + GWIAZDY
// ============================================================


// ============================================================
//                 SUPABASE — KONFIGURACJA
// ============================================================

const SUPABASE_URL = "https://vbxyshxmnsfnlwuihzse.supabase.com";
const SUPABASE_KEY = "sb_publishable_HlY8a9dT5hk9P_vC5TMshA_G96IRkyQ";

let supabaseClient = null;

if (
    typeof window.supabase !== "undefined" &&
    SUPABASE_URL !== "https://vbxyshxmnsfnlwuihzse.supabase.com" &&
    SUPABASE_KEY !== "sb_publishable_HlY8a9dT5hk9P_vC5TMshA_G96IRkyQ"
) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
}


// ============================================================
//                     GWIAZDY
// ============================================================

const canvas = document.getElementById("stars");

if (canvas) {

    const ctx = canvas.getContext("2d");

    let stars = [];

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    window.addEventListener("resize", resizeCanvas);

    resizeCanvas();

    for (let i = 0; i < 180; i++) {

        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.4 + 0.1
        });

    }

    document.addEventListener("mousemove", (event) => {

        mouseX = event.clientX;
        mouseY = event.clientY;

    });

    document.addEventListener(
        "touchmove",
        (event) => {

            if (event.touches.length > 0) {

                mouseX = event.touches[0].clientX;
                mouseY = event.touches[0].clientY;

            }

        },
        { passive: true }
    );

    function animate() {

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        for (const star of stars) {

            const distanceX = mouseX - star.x;
            const distanceY = mouseY - star.y;

            star.x += distanceX * 0.00015;
            star.y += distanceY * 0.00015;

            star.y += star.speed;

            if (star.y > canvas.height) {

                star.y = 0;
                star.x = Math.random() * canvas.width;

            }

            ctx.beginPath();

            ctx.arc(
                star.x,
                star.y,
                star.size,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = "white";

            ctx.fill();

        }

        requestAnimationFrame(animate);

    }

    animate();
}


// ============================================================
//                  WIADOMOŚCI AUTH
// ============================================================

function showAuthMessage(message, success = false) {

    const element =
        document.getElementById("auth-message");

    if (!element) return;

    element.textContent = message;

    element.classList.toggle(
        "success",
        success
    );
}


// ============================================================
//             AKTUALIZACJA PRZYCISKU KONTA
// ============================================================

async function updateAccountButton() {

    const accountLinks =
        document.querySelectorAll(
            "[data-account-link]"
        );

    if (!accountLinks.length) return;

    let user = null;

    if (supabaseClient) {

        const {
            data
        } =
            await supabaseClient.auth.getUser();

        user = data?.user || null;

    }

    accountLinks.forEach((link) => {

        if (user) {

            link.textContent = "👤 Konto";

            link.href = "konto.html";

        } else {

            link.textContent = "🔐 Zaloguj się";

            link.href = "login.html";

        }

    });

}


// ============================================================
//                     REJESTRACJA
// ============================================================

const registerForm =
    document.getElementById(
        "register-form"
    );

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!supabaseClient) {

                showAuthMessage(
                    "Błąd połączenia z Supabase."
                );

                return;

            }

            const username =
                document
                    .getElementById(
                        "register-username"
                    )
                    .value
                    .trim();

            const email =
                document
                    .getElementById(
                        "register-email"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "register-password"
                    )
                    .value;

            const passwordConfirm =
                document
                    .getElementById(
                        "register-password-confirm"
                    )
                    .value;


            if (
                username.length < 3 ||
                username.length > 20
            ) {

                showAuthMessage(
                    "Nazwa użytkownika musi mieć od 3 do 20 znaków."
                );

                return;

            }


            if (password.length < 8) {

                showAuthMessage(
                    "Hasło musi mieć minimum 8 znaków."
                );

                return;

            }


            if (password !== passwordConfirm) {

                showAuthMessage(
                    "Hasła nie są takie same."
                );

                return;

            }


            showAuthMessage(
                "Tworzenie konta...",
                true
            );


            const {
                data,
                error
            } =
                await supabaseClient.auth.signUp({

                    email: email,

                    password: password,

                    options: {

                        data: {

                            username: username

                        }

                    }

                });


            if (error) {

                showAuthMessage(
                    error.message
                );

                return;

            }


            // ------------------------------------------------
            // PROFIL
            // ------------------------------------------------

            if (
                data.user &&
                data.session
            ) {

                const {
                    error: profileError
                } =
                    await supabaseClient
                        .from("profiles")
                        .insert({

                            id: data.user.id,

                            username: username

                        });


                if (
                    profileError &&
                    profileError.code !== "23505"
                ) {

                    console.error(
                        profileError
                    );

                    showAuthMessage(
                        "Konto utworzone, ale wystąpił problem z profilem."
                    );

                    return;

                }


                showAuthMessage(
                    "Konto utworzone! Przechodzenie do konta...",
                    true
                );


                setTimeout(() => {

                    window.location.href =
                        "konto.html";

                }, 1000);


            } else {

                showAuthMessage(
                    "Konto utworzone! Sprawdź e-mail i potwierdź adres.",
                    true
                );

            }

        }
    );

}


// ============================================================
//                       LOGOWANIE
// ============================================================

const loginForm =
    document.getElementById(
        "login-form"
    );

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!supabaseClient) {

                showAuthMessage(
                    "Błąd połączenia z Supabase."
                );

                return;

            }


            const email =
                document
                    .getElementById(
                        "login-email"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "login-password"
                    )
                    .value;


            showAuthMessage(
                "Logowanie...",
                true
            );


            const {
                data,
                error
            } =
                await supabaseClient.auth
                    .signInWithPassword({

                        email: email,

                        password: password

                    });


            if (error) {

                showAuthMessage(
                    "Nieprawidłowy e-mail lub hasło."
                );

                console.error(error);

                return;

            }


            if (!data.user) {

                showAuthMessage(
                    "Nie udało się zalogować."
                );

                return;

            }


            showAuthMessage(
                "Zalogowano!",
                true
            );


            const params =
                new URLSearchParams(
                    window.location.search
                );

            const redirect =
                params.get("redirect");


            setTimeout(() => {

                if (redirect) {

                    window.location.href =
                        redirect;

                } else {

                    window.location.href =
                        "konto.html";

                }

            }, 700);

        }
    );

}


// ============================================================
//                       KONTO
// ============================================================

async function loadAccount() {

    if (!supabaseClient) {

        window.location.href =
            "login.html";

        return;

    }


    const {
        data: {
            user
        },
        error
    } =
        await supabaseClient.auth.getUser();


    if (
        error ||
        !user
    ) {

        window.location.href =
            "login.html";

        return;

    }


    const usernameElement =
        document.getElementById(
            "account-username"
        );

    const emailElement =
        document.getElementById(
            "account-email"
        );


    if (emailElement) {

        emailElement.textContent =
            user.email || "";

    }


    let username =
        user.user_metadata?.username ||
        "Użytkownik";


    const {
        data: profile
    } =
        await supabaseClient
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle();


    if (
        profile &&
        profile.username
    ) {

        username =
            profile.username;

    }


    if (usernameElement) {

        usernameElement.textContent =
            username;

    }

}


// ============================================================
//                     WYLOGOWANIE
// ============================================================

const logoutButton =
    document.getElementById(
        "logout-button"
    );

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            if (supabaseClient) {

                await supabaseClient.auth.signOut();

            }

            window.location.href =
                "index.html";

        }
    );

}


// ============================================================
//               AUTOMATYCZNE KONTO
// ============================================================

if (
    document.getElementById(
        "account-username"
    )
) {

    loadAccount();

}


// ============================================================
//             OCHRONA PRZYCISKÓW „KUP”
// ============================================================

document.addEventListener(
    "click",
    async (event) => {

        const buyButton =
            event.target.closest(
                "[data-buy]"
            );

        if (!buyButton) return;

        event.preventDefault();


        if (!supabaseClient) {

            window.location.href =
                "login.html";

            return;

        }


        const {
            data: {
                user
            }
        } =
            await supabaseClient.auth
                .getUser();


        if (!user) {

            window.location.href =
                "login.html?redirect=" +
                encodeURIComponent(
                    window.location.href
                );

            return;

        }


        alert(
            "Jesteś zalogowany. System płatności dodamy później."
        );

    }
);


// ============================================================
//              START — SPRAWDZENIE KONTA
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateAccountButton();

    }
);


// Supabase może odświeżyć sesję chwilę po załadowaniu strony.
// Dlatego aktualizujemy przycisk również po zmianie stanu logowania.

if (supabaseClient) {

    supabaseClient.auth.onAuthStateChange(
        () => {

            updateAccountButton();

        }
    );

}
