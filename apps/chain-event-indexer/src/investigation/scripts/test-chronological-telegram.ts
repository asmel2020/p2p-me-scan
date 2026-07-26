import { sendTelegramAlertWithButton } from "../../arbitrage-bot/telegram";

async function main() {
  const msgHtml =
    `🔴 <b>¡OPORTUNIDAD ABIERTA (LADO 2)!</b> 🔴\n\n` +
    `📦 <b>Bloque de Inicio:</b> 49123850\n` +
    `🎯 <b>Ruta de Operación:</b>\n` +
    ` 1️⃣ <b>Vendes USDC en Contrato:</b> 839.46 VES/USDC\n` +
    ` 2️⃣ <b>Recompras USDC en Binance P2P:</b> 820.00 VES/USDC\n\n` +
    `📈 <b>Spread Bruto:</b> +19.46 VES/USDC\n` +
    `⚡ <b>Margen Neto Inicial:</b> +2.37%\n\n` +
    `💵 <b>Ganancia Proyectada ($250 USDC):</b> +$5.93 USDC`;

  await sendTelegramAlertWithButton(
    msgHtml,
    "⚡ EJECUTAR LADO 2 (+2.4%)",
    "exec_trade_LADO2_49123850"
  );
  console.log("✅ Mensaje con formato cronológico enviado a Telegram!");
}

main().catch(console.error);
