import { fetchBinanceP2PPrice } from "./binance";
import { BOT_CONFIG } from "./config";
import {
  sendTelegramAlert,
  sendTelegramAlertWithButton,
  startTelegramCommandListener,
} from "./telegram";
import { createClient, RPC_URLS, fetchContractPriceAtBlock } from "./contract";
import { initRemoteDB, type DB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { persistArbitrageOpportunity } from "../shared/db/opportunity-store";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const defaultDb = initRemoteDB(accountId, databaseId, apiToken);
const publicClient = createClient(RPC_URLS[0]);

type ActiveOpportunityState = {
  startBlock: number;
  startTime: number;
  startMarginPct: number;
  lastNotifiedMarginPct: number;
  route: "LADO_1" | "LADO_2";
};

let activeOppLado1: ActiveOpportunityState | null = null;
let activeOppLado2: ActiveOpportunityState | null = null;

// Incremento mínimo de margen (%) para enviar una actualización de expansión de ganancia
const MARGIN_EXPANSION_THRESHOLD_PCT = 0.5;

/**
 * Evalúa oportunidades de arbitraje en tiempo real.
 * Avisa cuando una oportunidad se ABRE, cuando el MARGEN AUMENTA y cuando se CIERRA.
 */
export async function checkArbitrageForBlock(
  blockNumber: bigint | number,
  contractBuyPrice: number,
  contractSellPrice: number,
  db: DB = defaultDb,
  blockTimestampIso?: string,
) {
  try {
    const [binanceSellPrice, binanceBuyPrice] = await Promise.all([
      fetchBinanceP2PPrice("SELL"),
      fetchBinanceP2PPrice("BUY"),
    ]);

    if (!binanceSellPrice || !binanceBuyPrice) return;

    const now = Date.now();
    const bn = Number(blockNumber);
    const tsIso = blockTimestampIso || new Date(now).toISOString();

    // ----------------------------------------------------------------------
    // LADO 1: Comprar en Contrato -> Vender en Binance P2P
    // ----------------------------------------------------------------------
    const spreadLado1 = binanceSellPrice - contractBuyPrice;
    const marginLado1Pct = (spreadLado1 / contractBuyPrice) * 100;
    const profitLado1Usdc =
      BOT_CONFIG.simulatedTradeUsdc * (marginLado1Pct / 100);

    if (marginLado1Pct >= BOT_CONFIG.minProfitMarginPct) {
      // Guardar registro de la oportunidad en D1
      await persistArbitrageOpportunity(db, {
        blockNumber: bn,
        route: "LADO_1",
        currency: "VES",
        contractBuyPrice,
        contractSellPrice,
        binanceBuyPrice,
        binanceSellPrice,
        spreadGross: spreadLado1,
        marginPct: marginLado1Pct,
        profitUsdc: profitLado1Usdc,
        blockTimestampIso: tsIso,
      }).catch(console.error);

      // CASO 1A: Oportunidad recién ABIERTA
      if (!activeOppLado1) {
        activeOppLado1 = {
          startBlock: bn,
          startTime: now,
          startMarginPct: marginLado1Pct,
          lastNotifiedMarginPct: marginLado1Pct,
          route: "LADO_1",
        };

        const msgHtml =
          `🟢 <b>¡OPORTUNIDAD ABIERTA (LADO 1)!</b> 🟢\n\n` +
          `📦 <b>Bloque de Inicio:</b> ${bn}\n` +
          `🎯 <b>Acción:</b> Comprar en Contrato ➡️ Vender en Binance P2P\n\n` +
          `🔹 <b>Tasa Compra Contrato:</b> ${contractBuyPrice.toFixed(2)} VES/USDC\n` +
          `🔹 <b>Tasa Venta Binance P2P:</b> ${binanceSellPrice.toFixed(2)} VES/USDC\n` +
          `📈 <b>Spread Bruto:</b> +${spreadLado1.toFixed(2)} VES/USDC\n` +
          `⚡ <b>Margen Neto Inicial:</b> +${marginLado1Pct.toFixed(2)}%\n\n` +
          `💵 <b>Ganancia Proyectada ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado1Usdc.toFixed(2)} USDC`;

        console.log(
          `\n🟢 ¡OPORTUNIDAD ABIERTA LADO 1! Bloque ${bn} | Margen: +${marginLado1Pct.toFixed(2)}%`,
        );
        await sendTelegramAlertWithButton(
          msgHtml,
          `⚡ EJECUTAR COMPRA (+${marginLado1Pct.toFixed(1)}%)`,
          `exec_trade_LADO1_${bn}`,
        );
      }
      // CASO 1B: Oportunidad ya abierta, pero EL MARGEN AUMENTÓ de forma significativa (+0.5% o más)
      else if (
        marginLado1Pct >=
        activeOppLado1.lastNotifiedMarginPct + MARGIN_EXPANSION_THRESHOLD_PCT
      ) {
        const prevMargin = activeOppLado1.lastNotifiedMarginPct;
        activeOppLado1.lastNotifiedMarginPct = marginLado1Pct;

        const msgHtml =
          `📈 <b>¡EL MARGEN AUMENTÓ EN LADO 1!</b> 📈\n\n` +
          `📦 <b>Bloque:</b> ${bn}\n` +
          `🔥 <b>Expansión de Margen:</b> +${prevMargin.toFixed(2)}% ➔ <b>+${marginLado1Pct.toFixed(2)}%</b>\n\n` +
          `🔹 <b>Tasa Compra Contrato:</b> ${contractBuyPrice.toFixed(2)} VES/USDC\n` +
          `🔹 <b>Tasa Venta Binance P2P:</b> ${binanceSellPrice.toFixed(2)} VES/USDC\n` +
          `📈 <b>Nuevo Spread:</b> +${spreadLado1.toFixed(2)} VES/USDC\n\n` +
          `💵 <b>NUEVA Ganancia ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado1Usdc.toFixed(2)} USDC`;

        console.log(
          `\n📈 ¡MARGEN AUMENTÓ LADO 1! Bloque ${bn} | ${prevMargin.toFixed(2)}% -> +${marginLado1Pct.toFixed(2)}%`,
        );
        await sendTelegramAlertWithButton(
          msgHtml,
          `⚡ EJECUTAR CON NUEVO MARGEN (+${marginLado1Pct.toFixed(1)}%)`,
          `exec_trade_LADO1_${bn}`,
        );
      }
    } else {
      // CASO 1C: Oportunidad CERRADA (Margen cayó por debajo del umbral)
      if (activeOppLado1) {
        const durationSec = Math.round((now - activeOppLado1.startTime) / 1000);
        const durationMin = (durationSec / 60).toFixed(1);
        const blocksCount = bn - activeOppLado1.startBlock;

        const msgHtml =
          `🛑 <b>¡OPORTUNIDAD CERRADA (LADO 1)!</b> 🛑\n\n` +
          `📦 <b>Bloque de Cierre:</b> ${bn} (Duración: ${blocksCount} bloques)\n` +
          `⏱️ <b>Tiempo Total Abierta:</b> ${durationSec} seg (~${durationMin} min)\n\n` +
          `📉 <b>Tasa Contrato Actual:</b> ${contractBuyPrice.toFixed(2)} VES/USDC\n` +
          `📉 <b>Tasa Binance Venta Actual:</b> ${binanceSellPrice.toFixed(2)} VES/USDC\n` +
          `📊 <b>Margen Actual:</b> ${marginLado1Pct.toFixed(2)}% (La brecha se ha cerrado)`;

        console.log(
          `\n🛑 ¡OPORTUNIDAD CERRADA LADO 1! Bloque ${bn} | Duración: ${durationSec}s (${blocksCount} bloques)`,
        );
        await sendTelegramAlert(msgHtml);

        activeOppLado1 = null;
      }
    }

    // ----------------------------------------------------------------------
    // LADO 2: Comprar en Binance P2P -> Vender en Contrato
    // ----------------------------------------------------------------------
    const spreadLado2 = contractSellPrice - binanceBuyPrice;
    const marginLado2Pct = (spreadLado2 / binanceBuyPrice) * 100;
    const profitLado2Usdc =
      BOT_CONFIG.simulatedTradeUsdc * (marginLado2Pct / 100);

    if (marginLado2Pct >= BOT_CONFIG.minProfitMarginPct) {
      // Guardar registro de la oportunidad en D1
      await persistArbitrageOpportunity(db, {
        blockNumber: bn,
        route: "LADO_2",
        currency: "VES",
        contractBuyPrice,
        contractSellPrice,
        binanceBuyPrice,
        binanceSellPrice,
        spreadGross: spreadLado2,
        marginPct: marginLado2Pct,
        profitUsdc: profitLado2Usdc,
        blockTimestampIso: tsIso,
      }).catch(console.error);

      // CASO 2A: Oportunidad recién ABIERTA
      if (!activeOppLado2) {
        activeOppLado2 = {
          startBlock: bn,
          startTime: now,
          startMarginPct: marginLado2Pct,
          lastNotifiedMarginPct: marginLado2Pct,
          route: "LADO_2",
        };

        const msgHtml =
          `🔴 <b>¡OPORTUNIDAD ABIERTA (LADO 2)!</b> 🔴\n\n` +
          `📦 <b>Bloque de Inicio:</b> ${bn}\n` +
          `🎯 <b>Acción:</b> Comprar en Binance P2P ➡️ Vender en Contrato\n\n` +
          `🔹 <b>Tasa Compra Binance P2P:</b> ${binanceBuyPrice.toFixed(2)} VES/USDC\n` +
          `🔹 <b>Tasa Venta Contrato:</b> ${contractSellPrice.toFixed(2)} VES/USDC\n` +
          `📈 <b>Spread Bruto:</b> +${spreadLado2.toFixed(2)} VES/USDC\n` +
          `⚡ <b>Margen Neto Inicial:</b> +${marginLado2Pct.toFixed(2)}%\n\n` +
          `💵 <b>Ganancia Proyectada ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado2Usdc.toFixed(2)} USDC`;

        console.log(
          `\n🔴 ¡OPORTUNIDAD ABIERTA LADO 2! Bloque ${bn} | Margen: +${marginLado2Pct.toFixed(2)}%`,
        );
        await sendTelegramAlertWithButton(
          msgHtml,
          `⚡ EJECUTAR COMPRA (+${marginLado2Pct.toFixed(1)}%)`,
          `exec_trade_LADO2_${bn}`,
        );
      }
      // CASO 2B: Oportunidad ya abierta, pero EL MARGEN AUMENTÓ de forma significativa (+0.5% o más)
      else if (
        marginLado2Pct >=
        activeOppLado2.lastNotifiedMarginPct + MARGIN_EXPANSION_THRESHOLD_PCT
      ) {
        const prevMargin = activeOppLado2.lastNotifiedMarginPct;
        activeOppLado2.lastNotifiedMarginPct = marginLado2Pct;

        const msgHtml =
          `📈 <b>¡EL MARGEN AUMENTÓ EN LADO 2!</b> 📈\n\n` +
          `📦 <b>Bloque:</b> ${bn}\n` +
          `🔥 <b>Expansión de Margen:</b> +${prevMargin.toFixed(2)}% ➔ <b>+${marginLado2Pct.toFixed(2)}%</b>\n\n` +
          `🔹 <b>Tasa Compra Binance P2P:</b> ${binanceBuyPrice.toFixed(2)} VES/USDC\n` +
          `🔹 <b>Tasa Venta Contrato:</b> ${contractSellPrice.toFixed(2)} VES/USDC\n` +
          `📈 <b>Nuevo Spread:</b> +${spreadLado2.toFixed(2)} VES/USDC\n\n` +
          `💵 <b>NUEVA Ganancia ($${BOT_CONFIG.simulatedTradeUsdc} USDC):</b> +$${profitLado2Usdc.toFixed(2)} USDC`;

        console.log(
          `\n📈 ¡MARGEN AUMENTÓ LADO 2! Bloque ${bn} | ${prevMargin.toFixed(2)}% -> +${marginLado2Pct.toFixed(2)}%`,
        );
        await sendTelegramAlertWithButton(
          msgHtml,
          `⚡ EJECUTAR CON NUEVO MARGEN (+${marginLado2Pct.toFixed(1)}%)`,
          `exec_trade_LADO2_${bn}`,
        );
      }
    } else {
      // CASO 2C: Oportunidad CERRADA (Margen cayó por debajo del umbral)
      if (activeOppLado2) {
        const durationSec = Math.round((now - activeOppLado2.startTime) / 1000);
        const durationMin = (durationSec / 60).toFixed(1);
        const blocksCount = bn - activeOppLado2.startBlock;

        const msgHtml =
          `🛑 <b>¡OPORTUNIDAD CERRADA (LADO 2)!</b> 🛑\n\n` +
          `📦 <b>Bloque de Cierre:</b> ${bn} (Duración: ${blocksCount} bloques)\n` +
          `⏱️ <b>Tiempo Total Abierta:</b> ${durationSec} seg (~${durationMin} min)\n\n` +
          `📉 <b>Tasa Binance Compra Actual:</b> ${binanceBuyPrice.toFixed(2)} VES/USDC\n` +
          `📉 <b>Tasa Contrato Venta Actual:</b> ${contractSellPrice.toFixed(2)} VES/USDC\n` +
          `📊 <b>Margen Actual:</b> ${marginLado2Pct.toFixed(2)}% (La brecha se ha cerrado)`;

        console.log(
          `\n🛑 ¡OPORTUNIDAD CERRADA LADO 2! Bloque ${bn} | Duración: ${durationSec}s (${blocksCount} bloques)`,
        );
        await sendTelegramAlert(msgHtml);

        activeOppLado2 = null;
      }
    }

    if (!BOT_CONFIG.silentConsoleLogs) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(
        `[${timestamp}] Bloque ${bn} | Contrato [Compra: ${contractBuyPrice.toFixed(2)} | Venta: ${contractSellPrice.toFixed(2)}] | Binance [Compra: ${binanceBuyPrice.toFixed(2)} | Venta: ${binanceSellPrice.toFixed(2)}] | Margen L1: ${marginLado1Pct.toFixed(2)}% | Margen L2: ${marginLado2Pct.toFixed(2)}%`,
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
  startTelegramCommandListener();

  console.log(
    "=================================================================",
  );
  console.log(
    "🚀 BOT DE ARBITRAJE P2P — MONITOREO CON EXPANSIÓN DE MARGEN Y TELEGRAM",
  );
  console.log("   - Red Blockchain: Base Mainnet");
  console.log("   - Par de Comercio: VES / USDC");
  console.log(
    "   - Monto Simulado por Operación: $" +
      BOT_CONFIG.simulatedTradeUsdc +
      " USDC",
  );
  console.log(
    "   - Umbral de Alerta Inicial: > " +
      BOT_CONFIG.minProfitMarginPct +
      "% de ganancia neta",
  );
  console.log(
    "   - Umbral de Re-Alerta por Expansión: +0.5% incremento adicional",
  );
  console.log(
    "   - Notificación Telegram: ACTIVADA 📲 (Apertura, Expansión, Cierre y Botones)",
  );
  console.log(
    "   - Persistencia D1: TABLA `arbitrage_opportunities` ACTIVADA 💾",
  );
  console.log(
    "   - Logs Continuos de Consola: " +
      (BOT_CONFIG.silentConsoleLogs
        ? "SILENCIADOS 🔇 (Solo alertas)"
        : "ACTIVADOS 🔊"),
  );
  console.log(
    "=================================================================\n",
  );

  let lastBlock = 0n;

  setInterval(async () => {
    try {
      const currentBlock = await publicClient.getBlockNumber();
      if (currentBlock <= lastBlock) return;
      lastBlock = currentBlock;

      const prices = await fetchContractPriceAtBlock(currentBlock).catch(
        () => null,
      );
      if (!prices) return;

      await checkArbitrageForBlock(
        currentBlock,
        prices.buyPrice,
        prices.sellPrice,
      );
    } catch (err: any) {
      console.error("Error en ciclo de monitoreo:", err?.message ?? err);
    }
  }, BOT_CONFIG.checkIntervalMs);
}
