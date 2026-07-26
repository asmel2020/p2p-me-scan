import { createClient, RPC_URLS } from "./contract";
import { type Address, parseAbiItem, formatEther } from "viem";
import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { gte, lte, and } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);
const publicClient = createClient(RPC_URLS[0]);

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

const BALANCE_OF_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Mapa de billeteras intermedias conocidas asociadas a los principales operadores
const KNOWN_INTERMEDIARIES: Record<string, { name: string; addr: string }> = {
  "0x58903b37754acb59b686e97d94409d68375ac2d2": { name: "Intermedia Whale Ráfagas", addr: "0xC26375024AF88D9288Bea15791f136b9640de8de" },
  "0x7dac56225d849e432761f0a36d526f0e9ca53a8f": { name: "Intermedia Operador 7dac", addr: "0x34aa64b2863ddf8de32f6139e7263a88a7a812f0" },
  "0xfe4eb1d091aa358c90a94d1db025c428cf1ab774": { name: "Intermedia Operador fe4e", addr: "0x4152664eeace169632290ef0b18a0ff54773e82e" },
  "0xe04bb2ebfb65d8a142626bcdd303ded6c86698e0": { name: "Intermedia Operador e04b", addr: "0xd6baef329d3a007006bef6eee13fc56ac30380d4" },
};

/**
 * Consulta los saldos de USDC y ETH en vivo del TOP 5 de billeteras y sus intermedias
 * y genera un reporte HTML detallado para Telegram.
 */
export async function getWalletsBalanceHtmlReport(): Promise<string> {
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const toDate = new Date().toISOString();

  // Obtener órdenes de los últimos 7 días desde D1
  const orders = await db
    .select()
    .from(schema.orders)
    .where(and(gte(schema.orders.blockTimestamp, fromDate), lte(schema.orders.blockTimestamp, toDate)));

  const completedOrders = orders.filter((o) => o.status === "completed" && o.user && o.user !== "-");

  const walletMap = new Map<string, { address: string; totalUsdc: number; count: number }>();
  for (const o of completedOrders) {
    const user = o.user.toLowerCase();
    const stats = walletMap.get(user) ?? { address: user, totalUsdc: 0, count: 0 };
    stats.totalUsdc += o.usdc;
    stats.count++;
    walletMap.set(user, stats);
  }

  // Top 5 billeteras por volumen
  const top5 = [...walletMap.values()].sort((a, b) => b.totalUsdc - a.totalUsdc).slice(0, 5);

  let lines: string[] = [];
  lines.push("🏆 <b>TOP 5 BILLETERAS Y SALDOS EN VIVO</b> 🏆\n");

  let totalUsdcMarket = 0;

  for (let idx = 0; idx < top5.length; idx++) {
    const w = top5[idx];
    const addr = w.address as Address;

    try {
      const [rawUsdc, rawEth] = await Promise.all([
        publicClient.readContract({
          address: USDC_ADDRESS_BASE,
          abi: BALANCE_OF_ABI,
          functionName: "balanceOf",
          args: [addr],
        }),
        publicClient.getBalance({ address: addr }),
      ]);

      const usdc = Number(rawUsdc) / 1e6;
      const eth = parseFloat(formatEther(rawEth));
      totalUsdcMarket += usdc;

      let statusTag = "💤 Drenada";
      if (usdc >= 1000) statusTag = "🔥 [CARGADA >$1k]";
      else if (usdc >= 250) statusTag = "⚡ [LISTA 1 OP]";

      lines.push(
        `<b>#${idx + 1} | Wallet:</b> <code>${w.address.slice(0, 6)}...${w.address.slice(-4)}</code> ${statusTag}\n` +
        `├─ <b>Volumen Semanal:</b> $${w.totalUsdc.toFixed(2)} USDC (${w.count} ops)\n` +
        `├─ <b>Saldo USDC en Vivo:</b> $${usdc.toFixed(2)} USDC\n` +
        `└─ <b>Gas ETH:</b> ${eth.toFixed(4)} ETH`
      );

      // Si tiene billetera intermedia conocida, consultar también su saldo en vivo
      const knownIntermediary = KNOWN_INTERMEDIARIES[w.address];
      if (knownIntermediary) {
        try {
          const rawInterUsdc = await publicClient.readContract({
            address: USDC_ADDRESS_BASE,
            abi: BALANCE_OF_ABI,
            functionName: "balanceOf",
            args: [knownIntermediary.addr as Address],
          });
          const interUsdc = Number(rawInterUsdc) / 1e6;
          totalUsdcMarket += interUsdc;
          lines.push(`   ↳ <i>Billetera Intermedia (${knownIntermediary.name}):</i> $${interUsdc.toFixed(2)} USDC`);
        } catch (err) {}
      }

      lines.push("");
    } catch (err) {
      lines.push(`<b>#${idx + 1} | Wallet:</b> Error consultando saldo.\n`);
    }
  }

  lines.push(`📊 <b>Total USDC Retenido en Top 5:</b> $${totalUsdcMarket.toFixed(2)} USDC`);
  lines.push(`💡 <i>Usa /saldos para actualizar este reporte en vivo.</i>`);

  return lines.join("\n");
}
