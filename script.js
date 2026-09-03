/* =========================================================
   SHADOWTALE
   SYSTEM STRONY + SUPABASE AUTH
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL = "TUTAJ_WKLEJ_PROJECT_URL";

const SUPABASE_KEY = "TUTAJ_WKLEJ_PUBLISHABLE_KEY";


let supabaseClient = null;


if (
    typeof window.supabase !== "undefined" &&
    SUPABASE_URL !== "TUTAJ_WKLEJ_PROJECT_URL" &&
    SUPABASE_KEY !== "TUTAJ_WKLEJ_PUBLISHABLE_KEY"
) {

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

}


/* =========================================================
   GWIAZDY
   ========================================================= */

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


    window.addEventListener(
        "resize",
        resizeCanvas
    );


    resizeCanvas();


    for (let i = 0; i < 180; i++) {

        stars.push({

            x: Math.random() * canvas.width,

            y: Math.random() * canvas.height,

            size: Math.random() * 2 + 0.5,

            speed: Math.random() * 0.4 + 0.1

        });

    }


    document.addEventListener(
        "mousemove",
        (event) => {

            mouseX = event.clientX;

            mouseY = event.clientY;

        }
    );


    document.addEventListener(
        "touchmove",
        (event) => {

            if (event.touches.length > 0) {

                mouseX = event.touches[0].clientX;

                mouseY = event.touches[0].clientY;

            }

        },
        {
            passive: true
        }
    );


    function animate() {

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        for (const star of stars) {

            const distanceX =
                mouseX - star.x;

            const distanceY =
                mouseY - star.y;


            star.x +=
                distanceX * 0.00015;


            star.y +=
                distanceY * 0.00015;


            star.y += star.speed;


            if (star.y > canvas.height) {

                star.y = 0;

                star.x =
                    Math.random() *
                    canvas.width;

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


/* =========================================================
   POMOCNICZE
   ========================================================= */

function showMessage(
    element,
    message,
    success = false
) {

    if (!element) {
        return;
    }


    element.textContent = message;


    element.classList.toggle(
        "success",
        success
    );

}


/* =========================================================
   REJESTRACJA
   ========================================================= */

const registerForm =
    document.getElementById("register-form");


if (
    registerForm &&
    supabaseClient
) {

    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


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


            const message =
                document.getElementById(
                    "auth-message"
                );


            if (
                username.length < 3 ||
                username.length > 20
            ) {

                showMessage(
                    message,
                    "Nazwa użytkownika musi mieć 3–20 znaków."
                );

                return;

            }


            if (password !== passwordConfirm) {

                showMessage(
                    message,
                    "Hasła nie są takie same."
                );

                return;

            }


            if (password.length < 8) {

                showMessage(
                    message,
                    "Hasło musi mieć co najmniej 8 znaków."
                );

                return;

            }


            showMessage(
                message,
                "Tworzenie konta..."
            );


            const {
                data,
                error
            } = await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    data: {
                        username: username
                    }

                }

            });


            if (error) {

                showMessage(
                    message,
                    error.message
                );

                return;

            }


            if (!data.user) {

                showMessage(
                    message,
                    "Nie udało się utworzyć konta."
                );

                return;

            }


            if (!data.session) {

                showMessage(
                    message,
                    "Konto utworzone! Sprawdź e-mail i potwierdź adres.",
                    true
                );

                return;

            }


            const {
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .insert({

                    id: data.user.id,

                    username: username

                });


            if (profileError) {

                showMessage(
                    message,
                    "Konto utworzone, ale nie udało się utworzyć profilu: " +
                    profileError.message
                );

                return;

            }


            window.location.href =
                "konto.html";

        }
    );

}


/* =========================================================
   LOGOWANIE
   ========================================================= */

const loginForm =
    document.getElementById("login-form");


if (
    loginForm &&
    supabaseClient
) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


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


            const message =
                document.getElementById(
                    "auth-message"
                );


            showMessage(
                message,
                "Logowanie..."
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

                showMessage(
                    message,
                    "Nie udało się zalogować. Sprawdź e-mail i hasło."
                );

                return;

            }


            if (!data.session) {

                showMessage(
                    message,
                    "Nie udało się utworzyć sesji."
                );

                return;

            }


            window.location.href =
                "konto.html";

        }
    );

}


/* =========================================================
   KONTO
   ========================================================= */

const accountUsername =
    document.getElementById(
        "account-username"
    );


const accountEmail =
    document.getElementById(
        "account-email"
    );


if (
    accountUsername &&
    accountEmail &&
    supabaseClient
) {

    async function loadAccount() {

        const {
            data: {
                user
            },
            error
        } =
            await supabaseClient.auth
                .getUser();


        if (
            error ||
            !user
        ) {

            window.location.href =
                "login.html";

            return;

        }


        accountEmail.textContent =
            user.email || "";


        const {
            data: profile
        } =
            await supabaseClient
                .from("profiles")
                .select("username")
                .eq("id", user.id)
                .maybeSingle();


        if (profile) {

            accountUsername.textContent =
                profile.username;

        } else {

            accountUsername.textContent =
                user.user_metadata?.username ||
                "Użytkownik";

        }

    }


    loadAccount();

}


/* =========================================================
   WYLOGOWANIE
   ========================================================= */

const logoutButton =
    document.getElementById(
        "logout-button"
    );


if (
    logoutButton &&
    supabaseClient
) {

    logoutButton.addEventListener(
        "click",
        async () => {

            const {
                error
            } =
                await supabaseClient.auth
                    .signOut();


            if (error) {

                const message =
                    document.getElementById(
                        "account-message"
                    );


                showMessage(
                    message,
                    "Nie udało się wylogować."
                );

                return;

            }


            window.location.href =
                "index.html";

        }
    );

}


/* =========================================================
   ZABEZPIECZENIE KUPNA
   ========================================================= */

document.addEventListener(
    "click",
    async (event) => {

        const buyButton =
            event.target.closest(
                "[data-buy]"
            );


        if (!buyButton) {
            return;
        }


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


        /*
           Tutaj później podłączymy
           prawdziwy system zakupów.
        */


        alert(
            "Jesteś zalogowany. System płatności dodamy w następnym etapie."
        );

    }
);
