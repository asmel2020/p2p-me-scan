import { fetchPriceAtBlock, VEN_CURRENCY_HEX } from "../shared/price";
import { createClient, RPC_URLS } from "../shared/rpc-config";

const publicClient = createClient(RPC_URLS[0]);

/* -------------------------------------------------------------------------- */
/*  1. Listener del Precio de Binance P2P (Mercado Externo)                    */
/* -------------------------------------------------------------------------- */

interface BinanceP2POrder {
  adv: {
    price: string;
    surplusAmount: string;
    minSingleTransAmount: string;
    maxSingleTransAmount: string;
  };
}

async function fetchBinanceP2PPrice(tradeType: "BUY" | "SELL" = "SELL"): Promise<number | null> {
  try {
    const payload = {
      fiat: "VES",
      page: 1,
      rows: 10,
      tradeType,
      asset: "USDT",
      countries: [],
      proMerchantAds: false,
      shieldMerchantAds: false,
      filterType: "all",
      periods: [],
      additionalKycVerifyFilter: 0,
      publisherType: null,
      payTypes: ["PagoMovil"],
      classifies: ["mass", "profession", "fiat_trade"],
      tradedWith: false,
      followed: false,
    };

    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    if (data.success && Array.isArray(data.data)) {
      // Filtrar anuncios promocionales o patrocinados (privilegeType / Anuncio Promocionado)
      const validAds = data.data.filter((item: any) => {
        const adv = item.adv;
        const advertiser = item.advertiser;
        if (!adv || !adv.price) return false;
        if (adv.isPromoted || advertiser?.isPromoted) return false;
        if (adv.classify === "promoted") return false;

        // Filtro estricto para Anuncio Promocionado / privilegeType
        if (
          item.privilegeType ||
          item.privilegeDesc ||
          item.privilegeTypeAdTotalCount ||
          adv.privilegeType ||
          adv.privilegeDesc
        ) {
          return false;
        }

        return true;
      });

      if (validAds.length > 0) {
        return parseFloat(validAds[0].adv.price);
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  2. Monitor Principal de Arbitraje (Dry-Run / Simulación)                    */
/* -------------------------------------------------------------------------- */

const MIN_PROFIT_MARGIN_PCT = 1.0; // Alerta si hay más de 1.0% de margen neto
const SIMULATED_TRADE_USDC = 250;   // Tamaño simulado de orden ($250 USDC)

async function startDryRunMonitor() {
  console.log("=================================================================");
  console.log("🚀 BOT DE MONITOREO DE ARBITRAJE EN TIEMPO REAL (MODO SIMULACIÓN)");
  console.log("   - Red: Base Mainnet");
  console.log("   - Par: VES / USDC");
  console.log("   - Monto Simulado: $" + SIMULATED_TRADE_USDC + " USDC");
  console.log("   - Umbral Mínimo de Ganancia: > " + MIN_PROFIT_MARGIN_PCT + "%");
  console.log("   - Estado Transacciones: DESACTIVADAS 🔒 (Solo Monitoreo)");
  console.log("=================================================================\n");

  let lastBlock = 0n;

  setInterval(async () => {
    try {
      const currentBlock = await publicClient.getBlockNumber();

      if (currentBlock <= lastBlock) return;
      lastBlock = currentBlock;

      // Consultar precios en paralelo
      const [contractPrices, binanceSellPrice] = await Promise.all([
        fetchPriceAtBlock(currentBlock, VEN_CURRENCY_HEX).catch(() => null),
        fetchBinanceP2PPrice("SELL"),
      ]);

      if (!contractPrices || !binanceSellPrice) {
        console.log(`[Bloque ${currentBlock}] Esperando respuesta de oráculos...`);
        return;
      }

      // Precios del contrato con formato 6 decimales
      const contractBuyPrice = Number(contractPrices.buyPrice) / 1e6;
      const contractSellPrice = Number(contractPrices.sellPrice) / 1e6;

      // ----------------------------------------------------------------------
      // Cálculo de Oportunidad de Comprar en Contrato y Vender en Binance
      // ----------------------------------------------------------------------
      const spreadVES = binanceSellPrice - contractBuyPrice;
      const profitMarginPct = (spreadVES / contractBuyPrice) * 100;
      const projectedProfitUsdc = (SIMULATED_TRADE_USDC * (profitMarginPct / 100));

      const timestamp = new Date().toLocaleTimeString();

      if (profitMarginPct >= MIN_PROFIT_MARGIN_PCT) {
        console.log(
          `🚨 [${timestamp}] ¡OPORTUNIDAD DETECTADA EN BLOQUE ${currentBlock}! 🚨`
        );
        console.log(`   ├─ Tasa Contrato (Comprar): ${contractBuyPrice.toFixed(2)} VES/USDC`);
        console.log(`   ├─ Tasa Binance P2P (Vender): ${binanceSellPrice.toFixed(2)} VES/USDC`);
        console.log(`   ├─ Spread Bruto: +${spreadVES.toFixed(2)} VES por USDC`);
        console.log(`   ├─ Margen de Ganancia: +${profitMarginPct.toFixed(2)}%`);
        console.log(
          `   └─ 🟢 SIMULACIÓN: Comprar $${SIMULATED_TRADE_USDC} USDC en contrato -> Vender en Binance = GANANCIA PROYECTADA +$${projectedProfitUsdc.toFixed(2)} USDC\n`
        );
      } else {
        console.log(
          `[${timestamp}] Bloque ${currentBlock} | Contrato Buy: ${contractBuyPrice.toFixed(2)} VES | Binance Sell: ${binanceSellPrice.toFixed(2)} VES | Margen: ${profitMarginPct.toFixed(2)}% (Sin oportunidad)`
        );
      }
    } catch (err: any) {
      console.error("Error en ciclo de monitoreo:", err?.message ?? err);
    }
  }, 2000);
}

startDryRunMonitor();
