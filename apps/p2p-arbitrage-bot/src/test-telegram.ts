import { BOT_CONFIG } from "./config";
import { sendTelegramAlert } from "./telegram";

async function main() {
  const msg =
    `🚀 <b>BOT DE ARBITRAJE P2P CONECTADO EXITOSAMENTE</b> 🚀\n\n` +
    `✅ <b>Estado:</b> Monitoreando Base Mainnet y Binance P2P en tiempo real.\n` +
    `📲 <b>Notificaciones:</b> Activadas para este canal de Telegram.\n` +
    `🔇 <b>Modo Consola:</b> Silencioso (Solo recibirás alertas cuando haya ganancia > ${BOT_CONFIG.minProfitMarginPct}%).`;

  console.log("Enviando mensaje de prueba a Telegram...");
  const ok = await sendTelegramAlert(msg);
  if (ok) {
    console.log("✅ Mensaje enviado a Telegram con éxito!");
  } else {
    console.log("❌ Error enviando mensaje a Telegram.");
  }
}

main().catch(console.error);
