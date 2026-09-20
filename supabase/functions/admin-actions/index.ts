
import { withSupabase } from "npm:@supabase/server";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
        "POST, OPTIONS"
};

const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL")!;

const RESEND_API_KEY =
    Deno.env.get("RESEND_API_KEY");

const EMAIL_FROM =
    Deno.env.get("EMAIL_FROM") ||
    "ShadowTale <onboarding@resend.dev>";

const adminClient =
    createClient(
        SUPABASE_URL,
        Deno.env.get(
            "SUPABASE_SERVICE_ROLE_KEY"
        )!
    );


function response(
    body: unknown,
    status = 200
) {

    return new Response(
        JSON.stringify(body),
        {
            status,
            headers: {
                ...corsHeaders,
                "Content-Type":
                    "application/json"
            }
        }
    );
}


async function sendEmail(
    to: string,
    subject: string,
    html: string
) {

    if (!RESEND_API_KEY) {

        console.error(
            "Brak RESEND_API_KEY"
        );

        return {
            ok: false,
            skipped: true
        };
    }

    const result =
        await fetch(
            "https://api.resend.com/emails",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${RESEND_API_KEY}`
                },

                body: JSON.stringify({
                    from: EMAIL_FROM,
                    to: [to],
                    subject,
                    html
                })
            }
        );

    const data =
        await result.json();

    if (!result.ok) {

        console.error(
            "Resend error:",
            data
        );

        throw new Error(
            "Nie udało się wysłać wiadomości e-mail."
        );
    }

    return {
        ok: true,
        data
    };
}


function emailLayout(
    title: string,
    content: string
) {

    return `
        <!DOCTYPE html>

        <html lang="pl">

        <body style="
            margin:0;
            padding:0;
            background:#070711;
            color:#f4f0ff;
            font-family:Arial,sans-serif;
        ">

            <div style="
                max-width:650px;
                margin:40px auto;
                padding:30px;
                background:#10101c;
                border:1px solid #30204d;
                border-radius:18px;
            ">

                <h1 style="
                    margin-top:0;
                    color:#a56cff;
                ">
                    ShadowTale
                </h1>

                <h2>
                    ${title}
                </h2>

                <div style="
                    color:#d7d2e8;
                    line-height:1.7;
                ">
                    ${content}
                </div>

                <hr style="
                    border:0;
                    border-top:1px solid #30204d;
                    margin:25px 0;
                ">

                <p style="
                    color:#89839d;
                    font-size:13px;
                ">
                    To jest automatyczne powiadomienie
                    ShadowTale.
                </p>

            </div>

        </body>

        </html>
    `;
}


async function getCaller(
    supabase: any,
    userId: string
) {

    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select(
            "id, username, role, roles, is_verified"
        )
        .eq("id", userId)
        .maybeSingle();

    if (error || !data) {
        throw new Error(
            "Nie znaleziono profilu administratora."
        );
    }

    return data;
}


function rolesOf(profile: any) {

    return [
        profile?.role,
        ...(Array.isArray(profile?.roles)
            ? profile.roles
            : [])
    ]
        .filter(Boolean)
        .map(
            (role: string) =>
                role.trim().toLowerCase()
        );
}


function isOwner(profile: any) {

    return rolesOf(profile)
        .includes("owner");
}


function isAdmin(profile: any) {

    const roles =
        rolesOf(profile);

    return roles.some(
        role =>
            [
                "owner",
                "admin",
                "administrator"
            ].includes(role)
    );
}


function canHandleCategory(
    profile: any,
    category: string
) {

    const roles =
        rolesOf(profile);

    if (
        roles.includes("owner") ||
        roles.includes("admin") ||
        roles.includes("administrator")
    ) {
        return true;
    }

    const normalized =
        String(category || "")
            .trim()
            .toLowerCase();

    if (
        normalized === "skrypty" &&
        roles.includes(
            "programista skryptów"
        )
    ) {
        return true;
    }

    if (
        normalized === "configi" &&
        roles.includes(
            "programista configów"
        )
    ) {
        return true;
    }

    if (
        [
            "mapy",
            "schematy"
        ].includes(normalized) &&
        roles.includes(
            "programista-budowlaniec"
        )
    ) {
        return true;
    }

    if (
        [
            "tekstury",
            "grafiki"
        ].includes(normalized) &&
        roles.includes("grafik")
    ) {
        return true;
    }

    if (
        normalized === "undertale" &&
        roles.includes(
            "programista undertale"
        )
    ) {
        return true;
    }

    return false;
}


async function getTicket(
    ticketId: string
) {

    const {
        data,
        error
    } = await adminClient
        .from("tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();

    if (error || !data) {
        throw new Error(
            "Nie znaleziono ticketu."
        );
    }

    return data;
}


async function ticketPermission(
    profile: any,
    ticket: any
) {

    if (
        ticket.type === "help" ||
        ticket.type === "question"
    ) {
        return isAdmin(profile);
    }

    if (ticket.type === "order") {

        return (
            isAdmin(profile) ||
            canHandleCategory(
                profile,
                ticket.category
            )
        );
    }

    return false;
}


async function logTicketEvent(
    ticketId: string,
    actorId: string,
    action: string,
    details = ""
) {

    await adminClient
        .from("ticket_events")
        .insert({
            ticket_id: ticketId,
            actor_id: actorId,
            action,
            details
        });
}


async function emailTicketUser(
    ticket: any,
    title: string,
    content: string
) {

    if (!ticket.user_email) {
        return;
    }

    await sendEmail(
        ticket.user_email,
        `ShadowTale — ${title}`,
        emailLayout(
            title,
            content
        )
    );
}


async function acceptTicket(
    ticket: any,
    caller: any
) {

    const { error } =
        await adminClient
            .from("tickets")
            .update({
                status: "accepted",
                assigned_to: caller.id,
                assigned_username:
                    caller.username || "Administrator"
            })
            .eq("id", ticket.id);

    if (error) {
        throw error;
    }

    await logTicketEvent(
        ticket.id,
        caller.id,
        "Przyjęto ticket",
        `Ticket został przyjęty przez ${
            caller.username || "administratora"
        }.`
    );

    await emailTicketUser(
        ticket,
        "Ticket został przyjęty",
        `
            <p>
                Twój ticket
                <strong>${escapeHtml(
                    ticket.subject
                )}</strong>
                został przyjęty do obsługi.
            </p>

            <p>
                Administrator:
                <strong>${escapeHtml(
                    caller.username ||
                    "Administrator"
                )}</strong>
            </p>
        `
    );
}


async function rejectTicket(
    ticket: any,
    caller: any
) {

    const { error } =
        await adminClient
            .from("tickets")
            .update({
                status: "rejected",
                assigned_to: caller.id,
                assigned_username:
                    caller.username ||
                    "Administrator"
            })
            .eq("id", ticket.id);

    if (error) {
        throw error;
    }

    await logTicketEvent(
        ticket.id,
        caller.id,
        "Odrzucono ticket",
        "Ticket został odrzucony."
    );

    await emailTicketUser(
        ticket,
        "Ticket został odrzucony",
        `
            <p>
                Twój ticket
                <strong>${escapeHtml(
                    ticket.subject
                )}</strong>
                został odrzucony.
            </p>
        `
    );
}


async function closeTicket(
    ticket: any,
    caller: any
) {

    const { error } =
        await adminClient
            .from("tickets")
            .update({
                status: "closed",
                closed_at: new Date().toISOString(),
                closed_by: caller.id
            })
            .eq("id", ticket.id);

    if (error) {
        throw error;
    }

    await logTicketEvent(
        ticket.id,
        caller.id,
        "Zamknięto ticket",
        "Ticket został zamknięty."
    );

    await emailTicketUser(
        ticket,
        "Ticket został zamknięty",
        `
            <p>
                Ticket
                <strong>${escapeHtml(
                    ticket.subject
                )}</strong>
                został zamknięty.
            </p>

            <p>
                Jeśli problem nadal występuje,
                możesz utworzyć nowy ticket.
            </p>
        `
    );
}


async function reopenTicket(
    ticket: any,
    caller: any
) {

    const { error } =
        await adminClient
            .from("tickets")
            .update({
                status: "open",
                closed_at: null,
                closed_by: null
            })
            .eq("id", ticket.id);

    if (error) {
        throw error;
    }

    await logTicketEvent(
        ticket.id,
        caller.id,
        "Ponownie otwarto ticket",
        "Ticket został ponownie otwarty."
    );

    await emailTicketUser(
        ticket,
        "Ticket został ponownie otwarty",
        `
            <p>
                Ticket
                <strong>${escapeHtml(
                    ticket.subject
                )}</strong>
                został ponownie otwarty.
            </p>
        `
    );
}


async function replyTicket(
    ticket: any,
    caller: any,
    message: string
) {

    if (!message.trim()) {
        throw new Error(
            "Wiadomość nie może być pusta."
        );
    }

    const {
        error
    } = await adminClient
        .from("ticket_messages")
        .insert({
            ticket_id: ticket.id,
            sender_id: caller.id,
            message: message.trim()
        });

    if (error) {
        throw error;
    }

    await adminClient
        .from("tickets")
        .update({
            status:
                ticket.status === "open"
                    ? "in_progress"
                    : ticket.status,
            assigned_to: caller.id,
            assigned_username:
                caller.username ||
                "Administrator"
        })
        .eq("id", ticket.id);

    await logTicketEvent(
        ticket.id,
        caller.id,
        "Odpowiedziano",
        message.trim()
    );

    await emailTicketUser(
        ticket,
        "Nowa odpowiedź w Twoim tickecie",
        `
            <p>
                Otrzymałeś nową odpowiedź
                dotyczącą:
                <strong>${escapeHtml(
                    ticket.subject
                )}</strong>
            </p>

            <div style="
                padding:15px;
                border-radius:10px;
                background:#181827;
            ">
                ${escapeHtml(
                    message.trim()
                ).replaceAll("\n", "<br>")}
            </div>
        `
    );
}


function escapeHtml(
    value: unknown
) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


async function verifyUser(
    userId: string,
    caller: any
) {

    if (!isOwner(caller)) {
        throw new Error(
            "Tylko Owner może weryfikować konta."
        );
    }

    const {
        error
    } = await adminClient
        .from("profiles")
        .update({
            is_verified: true
        })
        .eq("id", userId);

    if (error) {
        throw error;
    }

    const {
        data: target
    } = await adminClient
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

    const {
        data: authData
    } = await adminClient.auth.admin
        .getUserById(userId);

    if (authData?.user?.email) {

        await sendEmail(
            authData.user.email,
            "ShadowTale — konto zweryfikowane",
            emailLayout(
                "Konto zostało zweryfikowane",
                `
                    <p>
                        Konto
                        <strong>${escapeHtml(
                            target?.username ||
                            authData.user.email
                        )}</strong>
                        zostało zweryfikowane przez administrację ShadowTale.
                    </p>
                `
            )
        );
    }
}


async function warnUser(
    userId: string,
    reason: string,
    caller: any
) {

    if (!isOwner(caller)) {
        throw new Error(
            "Tylko Owner może dodawać ostrzeżenia."
        );
    }

    await adminClient
        .from("warnings")
        .insert({
            user_id: userId,
            created_by: caller.id,
            reason,
            active: true
        });

    await adminClient
        .from("profiles")
        .update({
            warning_active: true,
            warning_reason: reason,
            warning_created_at:
                new Date().toISOString()
        })
        .eq("id", userId);

    const {
        data
    } = await adminClient.auth.admin
        .getUserById(userId);

    if (data?.user?.email) {

        await sendEmail(
            data.user.email,
            "ShadowTale — ostrzeżenie",
            emailLayout(
                "Otrzymałeś ostrzeżenie",
                `
                    <p>
                        Na Twoim koncie
                        ShadowTale zapisano ostrzeżenie.
                    </p>

                    <p>
                        <strong>Powód:</strong>
                    </p>

                    <p>
                        ${escapeHtml(reason)}
                    </p>
                `
            )
        );
    }
}


async function forceUsernameChange(
    userId: string,
    caller: any
) {

    if (!isOwner(caller)) {
        throw new Error(
            "Tylko Owner może wymusić zmianę nicku."
        );
    }

    const {
        error
    } = await adminClient
        .from("profiles")
        .update({
            force_username_change: true
        })
        .eq("id", userId);

    if (error) {
        throw error;
    }

    await notifyAccountAction(
        userId,
        "Wymagana zmiana nicku",
        `
            <p>
                Administracja ShadowTale wymaga
                zmiany nazwy użytkownika na Twoim koncie.
            </p>

            <p>
                Po zalogowaniu przejdź do ustawień konta.
            </p>
        `
    );
}


async function forceAvatarChange(
    userId: string,
    caller: any
) {

    if (!isOwner(caller)) {
        throw new Error(
            "Tylko Owner może wymusić zmianę avatara."
        );
    }

    const {
        error
    } = await adminClient
        .from("profiles")
        .update({
            force_avatar_change: true
        })
        .eq("id", userId);

    if (error) {
        throw error;
    }

    await notifyAccountAction(
        userId,
        "Wymagana zmiana avatara",
        `
            <p>
                Administracja ShadowTale wymaga
                zmiany avatara na Twoim koncie.
            </p>
        `
    );
}


async function notifyAccountAction(
    userId: string,
    title: string,
    content: string
) {

    const {
        data
    } = await adminClient.auth.admin
        .getUserById(userId);

    if (!data?.user?.email) {
        return;
    }

    await sendEmail(
        data.user.email,
        `ShadowTale — ${title}`,
        emailLayout(
            title,
            content
        )
    );
}


async function logoutAll(
    userId: string,
    caller: any
) {

    if (!isOwner(caller)) {
        throw new Error(
            "Tylko Owner może wylogować użytkownika ze wszystkich urządzeń."
        );
    }

    const {
        error
    } = await adminClient.auth.admin
        .signOut(
            userId,
            "global"
        );

    if (error) {
        throw error;
    }

    await notifyAccountAction(
        userId,
        "Wylogowanie ze wszystkich urządzeń",
        `
            <p>
                Twoje konto zostało wylogowane
                ze wszystkich aktywnych urządzeń.
            </p>

            <p>
                Jeśli to nie było zaplanowane,
                skontaktuj się z administracją ShadowTale.
            </p>
        `
    );
}


async function deleteUser(
    userId: string,
    caller: any
) {

    if (!isOwner(caller)) {
        throw new Error(
            "Tylko Owner może usuwać konta."
        );
    }

    if (userId === caller.id) {
        throw new Error(
            "Nie możesz usunąć własnego konta z tego panelu."
        );
    }

    const {
        data
    } = await adminClient.auth.admin
        .getUserById(userId);

    if (data?.user?.email) {

        await sendEmail(
            data.user.email,
            "ShadowTale — konto usunięte",
            emailLayout(
                "Konto zostało usunięte",
                `
                    <p>
                        Twoje konto ShadowTale
                        zostało usunięte przez administrację.
                    </p>
                `
            )
        );
    }

    const {
        error
    } = await adminClient.auth.admin
        .deleteUser(
            userId,
            true
        );

    if (error) {
        throw error;
    }
}


async function verifyProduct(
    productId: string,
    caller: any
) {

    if (!isOwner(caller)) {
        throw new Error(
            "Tylko Owner może weryfikować produkty."
        );
    }

    const {
        data: product,
        error: readError
    } = await adminClient
        .from("products")
        .select(
            "id, name, file_path, instructions, owner_id"
        )
        .eq("id", productId)
        .maybeSingle();

    if (readError || !product) {
        throw new Error(
            "Nie znaleziono produktu."
        );
    }

    if (!product.file_path) {
        throw new Error(
            "Produkt nie posiada pliku."
        );
    }

    if (!product.instructions?.trim()) {
        throw new Error(
            "Produkt nie posiada instrukcji."
        );
    }

    const {
        error
    } = await adminClient
        .from("products")
        .update({
            file_verified: true,
            verified_by: caller.id,
            verified_at:
                new Date().toISOString()
        })
        .eq("id", productId);

    if (error) {
        throw error;
    }

    await notifyAccountAction(
        product.owner_id,
        "Produkt został zweryfikowany",
        `
            <p>
                Produkt
                <strong>${escapeHtml(
                    product.name
                )}</strong>
                został zweryfikowany przez administrację.
            </p>
        `
    );
}


async function main(
    req: Request,
    ctx: any
) {

    if (req.method === "OPTIONS") {
        return new Response(
            "ok",
            {
                headers: corsHeaders
            }
        );
    }

    const userId =
        ctx.userClaims?.sub;

    if (!userId) {
        return response(
            {
                ok: false,
                error: "Brak autoryzacji."
            },
            401
        );
    }

    const caller =
        await getCaller(
            ctx.supabase,
            userId
        );

    if (!isAdmin(caller)) {
        return response(
            {
                ok: false,
                error:
                    "Brak uprawnień administratora."
            },
            403
        );
    }

    const body =
        await req.json();

    const action =
        body?.action;

    try {

        if (action === "accept_ticket") {

            const ticket =
                await getTicket(
                    body.ticket_id
                );

            if (!await ticketPermission(
                caller,
                ticket
            )) {
                throw new Error(
                    "Nie masz uprawnień do tego ticketu."
                );
            }

            await acceptTicket(
                ticket,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "reject_ticket") {

            const ticket =
                await getTicket(
                    body.ticket_id
                );

            if (!await ticketPermission(
                caller,
                ticket
            )) {
                throw new Error(
                    "Nie masz uprawnień do tego ticketu."
                );
            }

            await rejectTicket(
                ticket,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "close_ticket") {

            const ticket =
                await getTicket(
                    body.ticket_id
                );

            if (!await ticketPermission(
                caller,
                ticket
            )) {
                throw new Error(
                    "Nie masz uprawnień do tego ticketu."
                );
            }

            await closeTicket(
                ticket,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "reopen_ticket") {

            const ticket =
                await getTicket(
                    body.ticket_id
                );

            if (!await ticketPermission(
                caller,
                ticket
            )) {
                throw new Error(
                    "Nie masz uprawnień do tego ticketu."
                );
            }

            await reopenTicket(
                ticket,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "reply_ticket") {

            const ticket =
                await getTicket(
                    body.ticket_id
                );

            if (!await ticketPermission(
                caller,
                ticket
            )) {
                throw new Error(
                    "Nie masz uprawnień do tego ticketu."
                );
            }

            await replyTicket(
                ticket,
                caller,
                String(
                    body.message || ""
                )
            );

            return response({
                ok: true
            });
        }


        if (action === "verify_user") {

            await verifyUser(
                body.user_id,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "warn_user") {

            await warnUser(
                body.user_id,
                String(
                    body.reason || ""
                ),
                caller
            );

            return response({
                ok: true
            });
        }


        if (
            action ===
            "force_username_change"
        ) {

            await forceUsernameChange(
                body.user_id,
                caller
            );

            return response({
                ok: true
            });
        }


        if (
            action ===
            "force_avatar_change"
        ) {

            await forceAvatarChange(
                body.user_id,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "logout_all") {

            await logoutAll(
                body.user_id,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "delete_user") {

            await deleteUser(
                body.user_id,
                caller
            );

            return response({
                ok: true
            });
        }


        if (action === "verify_product") {

            await verifyProduct(
                body.product_id,
                caller
            );

            return response({
                ok: true
            });
        }


        return response(
            {
                ok: false,
                error:
                    "Nieznana akcja."
            },
            400
        );

    } catch (error) {

        console.error(error);

        return response(
            {
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Nieznany błąd."
            },
            400
        );
    }
}


export default withSupabase(
    {
        auth: "user"
    },
    main
);