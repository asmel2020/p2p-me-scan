import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config";

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
