import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { createClient, RPC_URLS } from "../../shared/rpc-config";
import { type Address, parseAbiItem, formatEther } from "viem";
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

async function main() {
  console.log("=================================================================");
  console.log("💰 SALDOS EN TIEMPO REAL (USDC Y ETH) DE LAS TOP BILLETERAS");
  console.log("=================================================================\n");

  const fromDate = "2026-07-19T00:00:00.000Z";
  const toDate = "2026-07-26T23:59:59.999Z";

  const orders = await db
    .select()
    .from(schema.orders)
    .where(and(gte(schema.orders.blockTimestamp, fromDate), lte(schema.orders.blockTimestamp, toDate)));

  const completedOrders = orders.filter((o) => o.status === "completed" && o.user && o.user !== "-");

  const walletMap = new Map<string, { address: string; buyUsdc: number; sellUsdc: number; count: number }>();

  for (const o of completedOrders) {
    const user = o.user.toLowerCase();
    const stats = walletMap.get(user) ?? { address: user, buyUsdc: 0, sellUsdc: 0, count: 0 };
    stats.count++;
    if (o.orderType === "BUY") stats.buyUsdc += o.usdc;
    if (o.orderType === "SELL") stats.sellUsdc += o.usdc;
    walletMap.set(user, stats);
  }

  const topWallets = [...walletMap.values()]
    .sort((a, b) => (b.buyUsdc + b.sellUsdc) - (a.buyUsdc + a.sellUsdc))
    .slice(0, 15);

  console.log(`📋 Consultando saldos on-chain para las Top ${topWallets.length} billeteras de la semana...\n`);

  type WalletBalanceResult = {
    address: string;
    totalVol: number;
    buyUsdc: number;
    sellUsdc: number;
    usdcBalance: number;
    ethBalance: number;
    status: string;
  };

  const results: WalletBalanceResult[] = [];

  for (const w of topWallets) {
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

      const usdcBalance = Number(rawUsdc) / 1e6;
      const ethBalance = parseFloat(formatEther(rawEth));
      const totalVol = w.buyUsdc + w.sellUsdc;

      let status = "💤 Drenada / Inactiva";
      if (usdcBalance >= 1000) status = "🔥 LISTA Y CARGADA (> $1,000 USDC)";
      else if (usdcBalance >= 250) status = "⚡ Lista para 1 Operación ($250 USDC)";
      else if (ethBalance > 0.005) status = "⛽ Lista para Venta Lado 2 (Tiene Gas ETH)";

      results.push({
        address: w.address,
        totalVol,
        buyUsdc: w.buyUsdc,
        sellUsdc: w.sellUsdc,
        usdcBalance,
        ethBalance,
        status,
      });
    } catch (err) {
      console.error(`Error consultando saldo de ${w.address}:`, err);
    }
  }

  // Mostrar resultados
  console.log("================================================================================-------------------------");
  console.log("🏆 SALDOS EN VIVO (EN TIEMPO REAL):");
  console.log("---------------------------------------------------------------------------------------------------------");

  results.forEach((r, idx) => {
    console.log(
      ` #${(idx + 1).toString().padStart(2, " ")} | Wallet: ${r.address}\n` +
      `     └─ Saldo USDC en Vivo: $${r.usdcBalance.toFixed(2)} USDC | Gas ETH: ${r.ethBalance.toFixed(4)} ETH\n` +
      `     └─ Volumen Semanal: $${r.totalVol.toFixed(2)} USDC (Compras: $${r.buyUsdc.toFixed(2)} | Ventas: $${r.sellUsdc.toFixed(2)})\n` +
      `     └─ Estado de Preparación: ${r.status}\n`
    );
  });

  const readyWallets = results.filter((r) => r.usdcBalance >= 250);
  console.log("=================================================================");
  console.log(`💡 RESUMEN DE PREPARACIÓN DE BILLETERAS:`);
  console.log(` 🚀 Billeteras con saldo para operar en este momento (≥ $250 USDC): ${readyWallets.length}`);
  console.log(` 💵 Saldo USDC total retenido actualmente en las Top Wallets: $${results.reduce((a, b) => a + b.usdcBalance, 0).toFixed(2)} USDC`);
  console.log("=================================================================");
}

main().catch(console.error);
