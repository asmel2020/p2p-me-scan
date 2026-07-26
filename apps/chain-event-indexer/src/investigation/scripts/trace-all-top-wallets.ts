import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { createClient, RPC_URLS } from "../../shared/rpc-config";
import { type Address, parseAbiItem } from "viem";
import { gte, lte, and } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);
const publicClient = createClient(RPC_URLS[0]);

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const BINANCE_HOT_WALLET_2 = "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055".toLowerCase();

const TRANSFER_EVENT_ABI = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

async function main() {
  console.log("=================================================================");
  console.log("🔍 RASTREO PROFUNDO DE RUTAS ON-CHAIN Y HORARIOS (SEMANA COMPLETA)");
  console.log("=================================================================\n");

  const fromDate = "2026-07-19T00:00:00.000Z";
  const toDate = "2026-07-26T23:59:59.999Z";

  const orders = await db
    .select()
    .from(schema.orders)
    .where(and(gte(schema.orders.blockTimestamp, fromDate), lte(schema.orders.blockTimestamp, toDate)));

  const completedOrders = orders.filter((o) => o.status === "completed" && o.user && o.user !== "-");

  // Agrupar por billetera
  const walletMap = new Map<string, { address: string; buyUsdc: number; sellUsdc: number; count: number; hours: number[]; timestamps: string[] }>();

  for (const o of completedOrders) {
    const user = o.user.toLowerCase();
    const stats = walletMap.get(user) ?? {
      address: user,
      buyUsdc: 0,
      sellUsdc: 0,
      count: 0,
      hours: [],
      timestamps: [],
    };

    stats.count++;
    if (o.orderType === "BUY") stats.buyUsdc += o.usdc;
    if (o.orderType === "SELL") stats.sellUsdc += o.usdc;

    if (o.blockTimestamp) {
      stats.timestamps.push(o.blockTimestamp);
      const dt = new Date(o.blockTimestamp);
      stats.hours.push(dt.getUTCHours());
    }

    walletMap.set(user, stats);
  }

  const topWallets = [...walletMap.values()]
    .sort((a, b) => (b.buyUsdc + b.sellUsdc) - (a.buyUsdc + a.sellUsdc))
    .slice(0, 15);

  console.log(`📋 Analizando las Top ${topWallets.length} Billeteras de la semana...\n`);

  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock - 100000n;

  for (const w of topWallets) {
    const userAddr = w.address as Address;
    const totalVol = w.buyUsdc + w.sellUsdc;

    // Calcular distribución de horas pico
    const hourCounts = new Array(24).fill(0);
    w.hours.forEach((h) => hourCounts[h]++);
    const peakHours = hourCounts
      .map((c, h) => ({ hour: h, count: c }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((x) => `${x.hour.toString().padStart(2, "0")}:00 UTC (${x.count} ops)`)
      .join(", ");

    console.log(`---------------------------------------------------------------------------------------------------------`);
    console.log(`👤 Billetera: ${w.address}`);
    console.log(`   └─ Vol Total: $${totalVol.toFixed(2)} USDC (Compras: $${w.buyUsdc.toFixed(2)} | Ventas: $${w.sellUsdc.toFixed(2)})`);
    console.log(`   └─ Horarios Pico: ${peakHours || "N/A"}`);

    // Rastreo de transferencias salientes de USDC (Lado 1)
    if (w.buyUsdc > 0) {
      try {
        const logsOut = await publicClient.getLogs({
          address: USDC_ADDRESS_BASE,
          event: TRANSFER_EVENT_ABI,
          args: { from: userAddr },
          fromBlock,
          toBlock: currentBlock,
        });

        const destMap = new Map<string, number>();
        for (const l of logsOut) {
          const to = (l.args.to as string).toLowerCase();
          const val = Number(l.args.value) / 1e6;
          destMap.set(to, (destMap.get(to) ?? 0) + val);
        }

        console.log(`   🟢 LADO 1 (Compras en Contrato -> Salida de USDC):`);
        for (const [dest, val] of destMap.entries()) {
          const isBinance = dest === BINANCE_HOT_WALLET_2 ? " [BINANCE HOT WALLET 2 🏢]" : "";
          console.log(`      └─ Envió $${val.toFixed(2)} USDC a: ${dest}${isBinance}`);

          // Si envió a billetera intermedia, rastrear 2do salto
          if (dest !== BINANCE_HOT_WALLET_2) {
            try {
              const logsHop = await publicClient.getLogs({
                address: USDC_ADDRESS_BASE,
                event: TRANSFER_EVENT_ABI,
                args: { from: dest as Address },
                fromBlock,
                toBlock: currentBlock,
              });
              for (const h of logsHop) {
                const hopTo = (h.args.to as string).toLowerCase();
                const hopVal = Number(h.args.value) / 1e6;
                const isHopBinance = hopTo === BINANCE_HOT_WALLET_2 ? " [BINANCE HOT WALLET 2 🏢]" : "";
                console.log(`         └─ ↳ 2do Salto: $${hopVal.toFixed(2)} USDC a: ${hopTo}${isHopBinance}`);
              }
            } catch (err) {}
          }
        }
      } catch (err) {}
    }

    // Rastreo de transferencias entrantes de USDC (Lado 2)
    if (w.sellUsdc > 0) {
      try {
        const logsIn = await publicClient.getLogs({
          address: USDC_ADDRESS_BASE,
          event: TRANSFER_EVENT_ABI,
          args: { to: userAddr },
          fromBlock,
          toBlock: currentBlock,
        });

        const srcMap = new Map<string, number>();
        for (const l of logsIn) {
          const from = (l.args.from as string).toLowerCase();
          const val = Number(l.args.value) / 1e6;
          srcMap.set(from, (srcMap.get(from) ?? 0) + val);
        }

        console.log(`   🔴 LADO 2 (Ventas en Contrato <- Origen de USDC):`);
        for (const [src, val] of srcMap.entries()) {
          const isBinance = src === BINANCE_HOT_WALLET_2 ? " [RETIRADO DE BINANCE HOT WALLET 2 🏢]" : "";
          console.log(`      └─ Recibió $${val.toFixed(2)} USDC de: ${src}${isBinance}`);
        }
      } catch (err) {}
    }
  }

  console.log(`\n=================================================================`);
  console.log(`✅ Rastreo completado.`);
}

main().catch(console.error);
