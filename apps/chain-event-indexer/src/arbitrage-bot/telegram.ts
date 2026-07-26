import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config";
import { getWalletsBalanceHtmlReport } from "./wallet-checker";
import { executeTrade } from "./executor/trade-executor";

/**
 * Envía un mensaje formateado en HTML al bot de Telegram.
 */
export async function sendTelegramAlert(messageHtml: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("⚠️ ALERTA: No se configuró TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en las variables de entorno (.env).");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageHtml,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = (await res.json()) as any;
    if (!data.ok) {
      console.error("Error respuesta Telegram API:", data.description ?? data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error enviando notificación a Telegram:", err);
    return false;
  }
}

/**
 * Envía un mensaje a Telegram con un Botón Interactivo Inline (Inline Keyboard).
 */
export async function sendTelegramAlertWithButton(
  messageHtml: string,
  buttonText: string,
  callbackData: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageHtml,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: buttonText,
                callback_data: callbackData,
              },
            ],
          ],
        },
      }),
    });

    const data = (await res.json()) as any;
    return Boolean(data.ok);
  } catch (err) {
    console.error("Error enviando mensaje con botón a Telegram:", err);
    return false;
  }
}

let lastUpdateId = 0;

/**
 * Escucha comandos (/saldos) y clics en botones interactivos de Telegram.
 */
export function startTelegramCommandListener() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  console.log("📲 Escuchador de comandos y botones de Telegram activado (Envía /saldos o presiona el botón en las alertas)");

  setInterval(async () => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=3`;
      const res = await fetch(url);
      const data = (await res.json()) as any;

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;

          // 1. Manejar Comandos de Texto (/saldos, /wallets)
          const text = update.message?.text?.trim()?.toLowerCase() ?? "";
          if (text === "/saldos" || text === "/wallets" || text === "/balances" || text === "/saldo") {
            console.log(`\n📲 Comando ${text} recibido de Telegram. Consultando saldos en vivo...`);
            const reportHtml = await getWalletsBalanceHtmlReport();
            await sendTelegramAlert(reportHtml);
          }

          // 2. Manejar Clics en Botones Inline (callback_query)
          if (update.callback_query) {
            const cb = update.callback_query;
            const cbId = cb.id;
            const cbData = cb.data ?? "";

            // Responder el popup de Telegram inmediatamente
            try {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cbId,
                  text: "⚡ Ejecutando simulación de orden...",
                  show_alert: false,
                }),
              });
            } catch (err) {}

            if (cbData.startsWith("exec_trade_")) {
              const parts = cbData.split("_"); // exec_trade_LADO1_49120970
              const route = parts[2] ?? "LADO_1";
              const bn = parts[3] ?? "49120970";

              // Invocar el ejecutor dedicado
              await executeTrade(route, bn);
            }
          }
        }
      }
    } catch (err) {
      // Ignorar timeouts intermitentes
    }
  }, 4000);
}
