import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config";
import { getWalletsBalanceHtmlReport } from "./wallet-checker";

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

let lastUpdateId = 0;

/**
 * Escucha comandos de Telegram como /saldos, /wallets o /balances.
 */
export function startTelegramCommandListener() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  console.log("📲 Escuchador de comandos de Telegram activado (Envía /saldos a tu bot)");

  setInterval(async () => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=3`;
      const res = await fetch(url);
      const data = (await res.json()) as any;

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          const text = update.message?.text?.trim()?.toLowerCase() ?? "";

          if (text === "/saldos" || text === "/wallets" || text === "/balances" || text === "/saldo") {
            console.log(`\n📲 Comando ${text} recibido de Telegram. Consultando saldos en vivo...`);
            const reportHtml = await getWalletsBalanceHtmlReport();
            await sendTelegramAlert(reportHtml);
          }
        }
      }
    } catch (err) {
      // Ignorar timeouts intermitentes
    }
  }, 4000);
}
