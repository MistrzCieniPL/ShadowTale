const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json",
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}

Deno.serve(
  async (req: Request): Promise<Response> => {

    /* ==================================================
       CORS
    ================================================== */

    if (req.method === "OPTIONS") {
      return new Response(
        "ok",
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }


    /* ==================================================
       METHOD
    ================================================== */

    if (req.method !== "POST") {
      return jsonResponse(
        {
          error:
            "STAI obsługuje tylko żądania POST.",
        },
        405,
      );
    }


    try {

      /* ================================================
         OPENAI KEY
      ================================================ */

      const OPENAI_API_KEY =
        Deno.env.get(
          "OPENAI_API_KEY",
        );

      if (!OPENAI_API_KEY) {
        return jsonResponse(
          {
            error:
              "Brak OPENAI_API_KEY w Supabase Secrets.",
          },
          500,
        );
      }


      /* ================================================
         BODY
      ================================================ */

      let body: Record<
        string,
        unknown
      >;

      try {
        body =
          await req.json();
      } catch {
        return jsonResponse(
          {
            error:
              "Nieprawidłowe dane żądania.",
          },
          400,
        );
      }


      /* ================================================
         MESSAGE
      ================================================ */

      const message =
        String(
          body?.message ?? "",
        )
          .trim()
          .slice(0, 4000);

      if (!message) {
        return jsonResponse(
          {
            error:
              "Nie podano wiadomości.",
          },
          400,
        );
      }


      /* ================================================
         HISTORY
      ================================================ */

      const history =
        Array.isArray(
          body?.history,
        )
          ? body.history
              .slice(-10)
              .map(
                (item: unknown) => {
                  const data =
                    item as {
                      role?: unknown;
                      text?: unknown;
                    };

                  const role =
                    data.role ===
                    "assistant"
                      ? "STAI"
                      : "Użytkownik";

                  const text =
                    String(
                      data.text ?? "",
                    )
                      .trim()
                      .slice(0, 2000);

                  if (!text) {
                    return "";
                  }

                  return `${role}: ${text}`;
                },
              )
              .filter(Boolean)
          : [];


      /* ================================================
         TEKST DLA OPENAI
      ================================================ */

      const historyText =
        history.length > 0
          ? `\n\nHistoria rozmowy:\n${history.join(
              "\n",
            )}`
          : "";

      const finalInput =
        `Użytkownik napisał:
${message}
${historyText}`;


      /* ================================================
         OPENAI RESPONSES API
      ================================================ */

      const openAIResponse =
        await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${OPENAI_API_KEY}`,
            },

            body: JSON.stringify({
              model:
                "gpt-5-mini",

              instructions: `
Jesteś STAI — ShadowTale AI.

Pomagasz użytkownikom strony ShadowTale.pl.

ShadowTale to polska strona związana z:
- Minecraft
- Undertale
- skryptami
- mapami
- configami
- plikami TXT
- skinami
- lore
- save'ami
- poradnikami

Zasady:
- odpowiadaj po polsku,
- odpowiadaj krótko i konkretnie,
- pomagaj użytkownikowi korzystać z ShadowTale,
- możesz wyjaśniać funkcje strony,
- możesz pomagać w problemach technicznych,
- nie wymyślaj informacji, których nie znasz,
- jeśli czegoś nie wiesz, powiedz to wprost,
- nie ujawniaj kluczy API, haseł ani danych technicznych,
- nie udawaj administratora,
- nie twierdź, że wykonałeś operację, jeśli jej nie wykonałeś,
- nazywasz się STAI.
              `.trim(),

              /*
               * WAŻNE:
               * input jest zwykłym tekstem.
               * Nie używamy tutaj:
               * { type: "input_text" }
               */
              input:
                finalInput,
            }),
          },
        );


      /* ================================================
         OPENAI RESPONSE
      ================================================ */

      let openAIData: any = null;

      try {
        openAIData =
          await openAIResponse.json();
      } catch {
        openAIData = null;
      }


      /* ================================================
         OPENAI ERROR
      ================================================ */

      if (!openAIResponse.ok) {
        console.error(
          "OpenAI error:",
          openAIData,
        );

        return jsonResponse(
          {
            error:
              "OpenAI zwróciło błąd.",

            details:
              openAIData?.error?.message ||
              "Nieznany błąd OpenAI.",
          },
          500,
        );
      }


      /* ================================================
         ANSWER
      ================================================ */

      let answer = "";

      if (
        typeof openAIData?.output_text ===
        "string"
      ) {
        answer =
          openAIData.output_text.trim();
      }


      /*
       * Awaryjne pobranie tekstu,
       * gdyby output_text nie było dostępne.
       */
      if (!answer) {
        const output =
          Array.isArray(
            openAIData?.output,
          )
            ? openAIData.output
            : [];

        const parts: string[] = [];

        for (
          const item of output
        ) {
          if (
            !Array.isArray(
              item?.content,
            )
          ) {
            continue;
          }

          for (
            const content of
              item.content
          ) {
            if (
              typeof content?.text ===
              "string"
            ) {
              parts.push(
                content.text,
              );
            }
          }
        }

        answer =
          parts
            .join("\n")
            .trim();
      }


      /* ================================================
         BRAK ODPOWIEDZI
      ================================================ */

      if (!answer) {
        console.error(
          "OpenAI returned no text:",
          openAIData,
        );

        return jsonResponse(
          {
            error:
              "STAI nie otrzymał odpowiedzi tekstowej.",
          },
          500,
        );
      }


      /* ================================================
         SUCCESS
      ================================================ */

      return jsonResponse(
        {
          answer,
        },
        200,
      );

    } catch (error) {

      console.error(
        "STAI function error:",
        error,
      );

      return jsonResponse(
        {
          error:
            "Wystąpił błąd podczas działania STAI.",

          details:
            error instanceof Error
              ? error.message
              : "Nieznany błąd.",
        },
        500,
      );
    }
  },
);