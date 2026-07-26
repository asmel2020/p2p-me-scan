import { createClient, RPC_URLS, fetchContractPriceAtBlock } from "./contract";
import { fetchBinanceP2PPrice } from "./binance";
import { BOT_CONFIG, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config";
import { sendTelegramAlert } from "./telegram";

const publicClient = createClient(RPC_URLS[0]);

let lastAlertTimeLado1 = 0;
let lastAlertTimeLado2 = 0;

export async function startArbitrageMonitor() {
  console.log("=================================================================");
  console.log("🚀 BOT DE ARBITRAJE P2P — MONITOREO Y NOTIFICACIONES TELEGRAM");
  console.log("   - Red Blockchain: Base Mainnet");
  console.log("   - Par de Comercio: VES / USDC");
  console.log("   - Monto Simulado por Operación: $" + BOT_CONFIG.simulatedTradeUsdc + " USDC");
  console.log("   - Umbral de Alerta: > " + BOT_CONFIG.minProfitMarginPct + "% de ganancia neta");
  console.log("   - Notificación Telegram: " + (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID ? "ACTIVADA 📲" : "CONFIGURACIÓN PENDIENTE ⚠️ (.env)"));
  console.log("   - Logs Continuos de Consola: " + (BOT_CONFIG.silentConsoleLogs ? "SILENCIADOS 🔇 (Solo alertas)" : "ACTIVADOS 🔊"));
  console.log("=================================================================\n");

  let lastBlock = 0n;

  setInterval(async () => {
    try {
      const currentBlock = await publicClient.getBlockNumber();
      if (currentBlock <= lastBlock) return;
      lastBlock = currentBlock;

      // Consultar precios en paralelo de la Blockchain y Binance P2P (Sell y Buy)
      const [contractPrices, binanceSellPrice, binanceBuyPrice] = await Promise.all([
        fetchContractPriceAtBlock(currentBlock).catch(() => null),
        fetchBinanceP2PPrice("SELL"),
        fetchBinanceP2PPrice("BUY"),
      ]);

      if (!contractPrices || !binanceSellPrice || !binanceBuyPrice) {
        return;
      }

      const now = Date.now();

      // ----------------------------------------------------------------------
      // LADO 1: Comprar en Contrato -> Vender en Binance
      // ----------------------------------------------------------------------
      const spreadLado1 = binanceSellPrice - contractPrices.buyPrice;
      const marginLado1Pct = (spreadLado1 / contractPrices.buyPrice) * 100;
      const profitLado1Usdc = BOT_CONFIG.simulatedTradeUsdc * (marginLado1Pct / 100);

      if (marginLado1Pct >= BOT_CONFIG.minProfitMarginPct) {
        if (now - lastAlertTimeLado1 >= BOT_CONFIG.alertCooldownMs) {
          lastAlertTimeLado1 = now;

          const msgHtml =
            `🚨 <b>¡OPORTUNIDAD DE ARBITRAJE DETECTADA (LADO 1)!</b> 🚨\n\n` +
            `📦 <b>Bloque:</b> ${currentBlock}\n` +
            `🟢 <b>Acción:</b> Comprar en Contrato ➡️ Vender en Binance P2P\n\n` +
            `🔹 <b>Tasa Compra Contrato:</b> ${contractPrices.buyPrice.toFixed(2)} VES/USDC\n` +
            `🔹 <b>Tasa Venta Binance P2P:</b> ${binanceSellPrice.toFixed(2)} VES/USDC\n` +
            `📈 <b>Spread Bruto:</b> +${spreadLado1.toFixed(2)} VES/USDC\n` +
            `⚡ <b>Margen Neto:</b> +${marginLado1Pct.toFixed(2)}%\n\n` +
            `💵 <b>Ganancia Proyectada ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado1Usdc.toFixed(2)} USDC`;

          console.log(`\n🚨 ¡ALERTA LADO 1! Enviando notificación a Telegram...`);
          console.log(`   Bloque ${currentBlock} | Margen: +${marginLado1Pct.toFixed(2)}% | Ganancia: +$${profitLado1Usdc.toFixed(2)} USDC`);

          await sendTelegramAlert(msgHtml);
        }
      }

      // ----------------------------------------------------------------------
      // LADO 2: Comprar en Binance -> Vender en Contrato
      // ----------------------------------------------------------------------
      const spreadLado2 = contractPrices.sellPrice - binanceBuyPrice;
      const marginLado2Pct = (spreadLado2 / binanceBuyPrice) * 100;
      const profitLado2Usdc = BOT_CONFIG.simulatedTradeUsdc * (marginLado2Pct / 100);

      if (marginLado2Pct >= BOT_CONFIG.minProfitMarginPct) {
        if (now - lastAlertTimeLado2 >= BOT_CONFIG.alertCooldownMs) {
          lastAlertTimeLado2 = now;

          const msgHtml =
            `🚨 <b>¡OPORTUNIDAD DE ARBITRAJE DETECTADA (LADO 2)!</b> 🚨\n\n` +
            `📦 <b>Bloque:</b> ${currentBlock}\n` +
            `🔴 <b>Acción:</b> Comprar en Binance P2P ➡️ Vender en Contrato\n\n` +
            `🔹 <b>Tasa Compra Binance P2P:</b> ${binanceBuyPrice.toFixed(2)} VES/USDC\n` +
            `🔹 <b>Tasa Venta Contrato:</b> ${contractPrices.sellPrice.toFixed(2)} VES/USDC\n` +
            `📈 <b>Spread Bruto:</b> +${spreadLado2.toFixed(2)} VES/USDC\n` +
            `⚡ <b>Margen Neto:</b> +${marginLado2Pct.toFixed(2)}%\n\n` +
            `💵 <b>Ganancia Proyectada ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado2Usdc.toFixed(2)} USDC`;

          console.log(`\n🚨 ¡ALERTA LADO 2! Enviando notificación a Telegram...`);
          console.log(`   Bloque ${currentBlock} | Margen: +${marginLado2Pct.toFixed(2)}% | Ganancia: +$${profitLado2Usdc.toFixed(2)} USDC`);

          await sendTelegramAlert(msgHtml);
        }
      }

      // Si los logs continuos están activados (silentConsoleLogs: false), los muestra
      if (!BOT_CONFIG.silentConsoleLogs) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(
          `[${timestamp}] Bloque ${currentBlock} | Contrato [C: ${contractPrices.buyPrice.toFixed(2)} | V: ${contractPrices.sellPrice.toFixed(2)}] | Binance [C: ${binanceBuyPrice.toFixed(2)} | V: ${binanceSellPrice.toFixed(2)}] | Margen L1: ${marginLado1Pct.toFixed(2)}% | Margen L2: ${marginLado2Pct.toFixed(2)}%`
        );
      }
    } catch (err: any) {
      console.error("Error en ciclo de monitoreo:", err?.message ?? err);
    }
  }, BOT_CONFIG.checkIntervalMs);
}
