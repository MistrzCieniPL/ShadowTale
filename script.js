const SUPABASE_URL = "https://vbxyshxmnsfnlwuihzse.supabase.co";
const SUPABASE_KEY = "sb_publishable_XszGm5td2PP0Tso0ZEX0-g_dfVQEILw";

const supabaseClient = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

// ==========================================
// REJESTRACJA
// ==========================================

const registerForm = document.getElementById("register-form");

if (registerForm) {

registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username = document
        .getElementById("register-username")
        .value
        .trim();

    const email = document
        .getElementById("register-email")
        .value
        .trim();

    const password = document
        .getElementById("register-password")
        .value;

    const password2 = document
        .getElementById("register-password-repeat")
        .value;


    if (!username || !email || !password || !password2) {
        alert("Uzupełnij wszystkie pola.");
        return;
    }


    if (password !== password2) {
        alert("Hasła nie są takie same.");
        return;
    }


    if (password.length < 6) {
        alert("Hasło musi mieć minimum 6 znaków.");
        return;
    }


    const button = registerForm.querySelector(
        "button[type='submit']"
    );


    if (button) {
        button.disabled = true;
        button.textContent = "Tworzenie konta...";
    }


    const { data, error } =
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

        console.error("Błąd Supabase:", error);

        alert(
            "Nie udało się utworzyć konta:\n\n" +
            error.message
        );

        if (button) {
            button.disabled = false;
            button.textContent = "Utwórz konto";
        }

        return;
    }


    console.log("Konto utworzone:", data);


    if (data.session) {

        alert("Konto zostało utworzone!");

        window.location.href = "konto.html";

    } else {

        alert(
            "Konto zostało utworzone!\n\n" +
            "Sprawdź swoją skrzynkę e-mail i potwierdź adres."
        );

        window.location.href = "login.html";
    }

});

}

// ==========================================
// LOGOWANIE
// ==========================================

const loginForm = document.getElementById("login-form");

if (loginForm) {

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    const email = document
        .getElementById("login-email")
        .value
        .trim();

    const password = document
        .getElementById("login-password")
        .value;


    if (!email || !password) {

        alert("Wpisz e-mail i hasło.");

        return;
    }


    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });


    if (error) {

        console.error("Błąd logowania:", error);

        alert(
            "Nie udało się zalogować:\n\n" +
            error.message
        );

        return;
    }


    console.log("Zalogowano:", data.user);

    window.location.href = "konto.html";

});

}

// ==========================================
// KONTO
// ==========================================

async function loadAccount() {

const accountPage =
    document.getElementById("account-page");


if (!accountPage) {
    return;
}


const logoutButton =
    document.getElementById("logout-button");


try {

    // Sprawdzenie zalogowanego użytkownika
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();


    if (userError) {

        console.error(
            "Błąd sprawdzania sesji:",
            userError
        );

        window.location.href = "login.html";

        return;
    }


    // Brak sesji
    if (!user) {

        window.location.href = "login.html";

        return;
    }


    // Pokazujemy wylogowanie
    if (logoutButton) {
        logoutButton.style.display = "inline-block";
    }


    // Pobieramy profil
    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("username, role")
        .eq("id", user.id)
        .single();


    if (profileError) {

        console.error(
            "Błąd profilu:",
            profileError
        );

        alert(
            "Konto istnieje, ale nie udało się pobrać profilu.\n\n" +
            profileError.message
        );

        return;
    }


    // =====================================
    // NAZWA UŻYTKOWNIKA
    // =====================================

    const username =
        document.getElementById("account-username");

    if (username) {
        username.textContent =
            profile.username || "Użytkownik";
    }


    // =====================================
    // NAZWA W KARCIE
    // =====================================

    const usernameCard =
        document.getElementById(
            "account-username-card"
        );

    if (usernameCard) {
        usernameCard.textContent =
            profile.username || "Użytkownik";
    }


    // =====================================
    // E-MAIL
    // =====================================

    const email =
        document.getElementById("account-email");

    if (email) {
        email.textContent =
            user.email || "Brak adresu e-mail";
    }


    // =====================================
    // ROLA
    // =====================================

    const role =
        document.getElementById("account-role");

    if (role) {
        role.textContent =
            profile.role || "user";
    }


} catch (error) {

    console.error(
        "Nieoczekiwany błąd konta:",
        error
    );

    alert(
        "Wystąpił błąd podczas ładowania konta."
    );
}

}

// Uruchomienie strony konta
loadAccount();

// ==========================================
// WYLOGOWANIE
// ==========================================

const logoutButton =
document.querySelector("[data-logout]");

if (logoutButton) {

logoutButton.addEventListener("click", async () => {

    logoutButton.disabled = true;
    logoutButton.textContent = "Wylogowywanie...";


    const { error } =
        await supabaseClient.auth.signOut();


    if (error) {

        console.error(
            "Błąd wylogowania:",
            error
        );

        alert(
            "Nie udało się wylogować:\n\n" +
            error.message
        );

        logoutButton.disabled = false;
        logoutButton.textContent = "Wyloguj się";

        return;
    }


    window.location.href = "index.html";

});

}
