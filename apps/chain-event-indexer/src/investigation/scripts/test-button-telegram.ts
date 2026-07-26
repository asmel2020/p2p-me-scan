import { sendTelegramAlertWithButton } from "../../arbitrage-bot/telegram";

async function main() {
  console.log("Enviando mensaje con Botón Interactivo a Telegram...");

  const msgHtml =
    `🟢 <b>¡OPORTUNIDAD ABIERTA DE PRUEBA!</b> 🟢\n\n` +
    `📦 <b>Bloque:</b> 49121000\n` +
    `🎯 <b>Acción:</b> Comprar en Contrato ➡️ Vender en Binance P2P\n\n` +
    `⚡ <b>Margen Neto:</b> +2.50%\n` +
    `💵 <b>Ganancia Proyectada ($250 USDC):</b> +$6.25 USDC\n\n` +
    `👇 <i>Presiona el botón de abajo para probar la simulación de ejecución:</i>`;

  const ok = await sendTelegramAlertWithButton(
    msgHtml,
    "⚡ EJECUTAR COMPRA ($250 USDC)",
    "exec_trade_LADO1_49121000"
  );

  if (ok) {
    console.log("✅ Mensaje con botón enviado a Telegram con éxito!");
  } else {
    console.log("❌ Error enviando mensaje a Telegram.");
  }
}

main().catch(console.error);
