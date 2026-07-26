import { getCloudflareEnv } from "../../shared/env";
import { fetchBinanceP2PPrice } from "../../arbitrage-bot/binance";
import { createClient, RPC_URLS, fetchContractPriceAtBlock } from "../../arbitrage-bot/contract";

getCloudflareEnv();
const publicClient = createClient(RPC_URLS[0]);

async function main() {
  console.log("=================================================================");
  console.log("🔍 CONSULTA DE BRECHA EN TIEMPO REAL — AMBOS LADOS");
  console.log("=================================================================\n");

  const currentBlock = await publicClient.getBlockNumber();
  const contractPrices = await fetchContractPriceAtBlock(currentBlock);

  const [binanceSellPrice, binanceBuyPrice] = await Promise.all([
    fetchBinanceP2PPrice("SELL"),
    fetchBinanceP2PPrice("BUY"),
  ]);

  console.log(`📦 Bloque Actual: ${currentBlock}`);
  console.log(`🔹 Contrato Diamond  -> Compra: ${contractPrices.buyPrice.toFixed(2)} VES | Venta: ${contractPrices.sellPrice.toFixed(2)} VES`);
  console.log(`🔹 Binance P2P       -> Compra: ${binanceBuyPrice?.toFixed(2) ?? "N/A"} VES | Venta: ${binanceSellPrice?.toFixed(2) ?? "N/A"} VES\n`);

  if (binanceSellPrice && binanceBuyPrice) {
    // LADO 1: Comprar en Contrato -> Vender en Binance P2P
    const spreadLado1 = binanceSellPrice - contractPrices.buyPrice;
    const marginLado1Pct = (spreadLado1 / contractPrices.buyPrice) * 100;
    const profitLado1 = 250 * (marginLado1Pct / 100);

    // LADO 2: Vender en Contrato -> Recomprar en Binance P2P
    const spreadLado2 = contractPrices.sellPrice - binanceBuyPrice;
    const marginLado2Pct = (spreadLado2 / binanceBuyPrice) * 100;
    const profitLado2 = 250 * (marginLado2Pct / 100);

    console.log("-----------------------------------------------------------------");
    console.log("📊 RESULTADOS EN VIVO DE AMBOS LADOS:");
    console.log("-----------------------------------------------------------------");
    console.log(`🟢 LADO 1 (Comprar Contrato -> Vender en Binance P2P):`);
    console.log(`   └─ Spread: ${spreadLado1 > 0 ? "+" : ""}${spreadLado1.toFixed(2)} VES/USDC`);
    console.log(`   └─ Margen: ${marginLado1Pct > 0 ? "+" : ""}${marginLado1Pct.toFixed(2)}% (${profitLado1 > 0 ? "+" : ""}$${profitLado1.toFixed(2)} USDC para $250)`);
    console.log(`   └─ Estado: ${marginLado1Pct >= 1.0 ? "✅ OPORTUNIDAD ABIERTA" : "💤 Sin Oportunidad"}\n`);

    console.log(`🔴 LADO 2 (Vender USDC en Contrato -> Recomprar USDC en Binance P2P):`);
    console.log(`   └─ Spread: ${spreadLado2 > 0 ? "+" : ""}${spreadLado2.toFixed(2)} VES/USDC`);
    console.log(`   └─ Margen: ${marginLado2Pct > 0 ? "+" : ""}${marginLado2Pct.toFixed(2)}% (${profitLado2 > 0 ? "+" : ""}$${profitLado2.toFixed(2)} USDC para $250)`);
    console.log(`   └─ Estado: ${marginLado2Pct >= 1.0 ? "✅ OPORTUNIDAD ABIERTA" : "💤 Sin Oportunidad"}`);
    console.log("-----------------------------------------------------------------");
  }
}

main().catch(console.error);
