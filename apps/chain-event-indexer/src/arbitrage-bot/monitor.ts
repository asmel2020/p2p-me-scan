import { fetchBinanceP2PPrice } from "./binance";
import { BOT_CONFIG, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config";
import { sendTelegramAlert } from "./telegram";
import { createClient, RPC_URLS, fetchContractPriceAtBlock } from "./contract";

const publicClient = createClient(RPC_URLS[0]);

let lastAlertTimeLado1 = 0;
let lastAlertTimeLado2 = 0;

/**
 * Evalúa oportunidades de arbitraje reutilizando los precios del contrato
 * que el indexer ya consultó en memoria (0 llamadas RPC extra).
 */
export async function checkArbitrageForBlock(
  blockNumber: bigint | number,
  contractBuyPrice: number,
  contractSellPrice: number
) {
  try {
    // Consultar Binance P2P (Sell y Buy) en paralelo
    const [binanceSellPrice, binanceBuyPrice] = await Promise.all([
      fetchBinanceP2PPrice("SELL"),
      fetchBinanceP2PPrice("BUY"),
    ]);

    if (!binanceSellPrice || !binanceBuyPrice) return;

    const now = Date.now();
    const bn = Number(blockNumber);

    // ----------------------------------------------------------------------
    // LADO 1: Comprar en Contrato -> Vender en Binance P2P
    // ----------------------------------------------------------------------
    const spreadLado1 = binanceSellPrice - contractBuyPrice;
    const marginLado1Pct = (spreadLado1 / contractBuyPrice) * 100;
    const profitLado1Usdc = BOT_CONFIG.simulatedTradeUsdc * (marginLado1Pct / 100);

    if (marginLado1Pct >= BOT_CONFIG.minProfitMarginPct) {
      if (now - lastAlertTimeLado1 >= BOT_CONFIG.alertCooldownMs) {
        lastAlertTimeLado1 = now;

        const msgHtml =
          `🚨 <b>¡OPORTUNIDAD DE ARBITRAJE DETECTADA (LADO 1)!</b> 🚨\n\n` +
          `📦 <b>Bloque:</b> ${bn}\n` +
          `🟢 <b>Acción:</b> Comprar en Contrato ➡️ Vender en Binance P2P\n\n` +
          `🔹 <b>Tasa Compra Contrato:</b> ${contractBuyPrice.toFixed(2)} VES/USDC\n` +
          `🔹 <b>Tasa Venta Binance P2P:</b> ${binanceSellPrice.toFixed(2)} VES/USDC\n` +
          `📈 <b>Spread Bruto:</b> +${spreadLado1.toFixed(2)} VES/USDC\n` +
          `⚡ <b>Margen Neto:</b> +${marginLado1Pct.toFixed(2)}%\n\n` +
          `💵 <b>Ganancia Proyectada ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado1Usdc.toFixed(2)} USDC`;

        console.log(`\n🚨 ¡ALERTA LADO 1! Enviando notificación a Telegram... (Bloque ${bn})`);
        await sendTelegramAlert(msgHtml);
      }
    }

    // ----------------------------------------------------------------------
    // LADO 2: Comprar en Binance P2P -> Vender en Contrato
    // ----------------------------------------------------------------------
    const spreadLado2 = contractSellPrice - binanceBuyPrice;
    const marginLado2Pct = (spreadLado2 / binanceBuyPrice) * 100;
    const profitLado2Usdc = BOT_CONFIG.simulatedTradeUsdc * (marginLado2Pct / 100);

    if (marginLado2Pct >= BOT_CONFIG.minProfitMarginPct) {
      if (now - lastAlertTimeLado2 >= BOT_CONFIG.alertCooldownMs) {
        lastAlertTimeLado2 = now;

        const msgHtml =
          `🚨 <b>¡OPORTUNIDAD DE ARBITRAJE DETECTADA (LADO 2)!</b> 🚨\n\n` +
          `📦 <b>Bloque:</b> ${bn}\n` +
          `🔴 <b>Acción:</b> Comprar en Binance P2P ➡️ Vender en Contrato\n\n` +
          `🔹 <b>Tasa Compra Binance P2P:</b> ${binanceBuyPrice.toFixed(2)} VES/USDC\n` +
          `🔹 <b>Tasa Venta Contrato:</b> ${contractSellPrice.toFixed(2)} VES/USDC\n` +
          `📈 <b>Spread Bruto:</b> +${spreadLado2.toFixed(2)} VES/USDC\n` +
          `⚡ <b>Margen Neto:</b> +${marginLado2Pct.toFixed(2)}%\n\n` +
          `💵 <b>Ganancia Proyectada ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado2Usdc.toFixed(2)} USDC`;

        console.log(`\n🚨 ¡ALERTA LADO 2! Enviando notificación a Telegram... (Bloque ${bn})`);
        await sendTelegramAlert(msgHtml);
      }
    }

    if (!BOT_CONFIG.silentConsoleLogs) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(
        `[${timestamp}] Bloque ${bn} | Contrato [Compra: ${contractBuyPrice.toFixed(2)} | Venta: ${contractSellPrice.toFixed(2)}] | Binance [Compra: ${binanceBuyPrice.toFixed(2)} | Venta: ${binanceSellPrice.toFixed(2)}] | Ganancia (Comprar-Contrato -> Vender-Binance: ${marginLado1Pct.toFixed(2)}%) | Ganancia (Comprar-Binance -> Vender-Contrato: ${marginLado2Pct.toFixed(2)}%)`
      );
    }
  } catch (err: any) {
    console.error("Error en evaluación de arbitraje:", err?.message ?? err);
  }
}

/**
 * Modo autónomo (standalone): Monitorea consultando la blockchain periódicamente.
 */
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

      const prices = await fetchContractPriceAtBlock(currentBlock).catch(() => null);
      if (!prices) return;

      await checkArbitrageForBlock(currentBlock, prices.buyPrice, prices.sellPrice);
    } catch (err: any) {
      console.error("Error en ciclo de monitoreo:", err?.message ?? err);
    }
  }, BOT_CONFIG.checkIntervalMs);
}
