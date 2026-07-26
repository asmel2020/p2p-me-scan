import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { createClient, RPC_URLS } from "../shared/rpc-config";
import { gte, lte, and, eq } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);
const publicClient = createClient(RPC_URLS[0]);

async function main() {
  console.log("=== ANÁLISIS DE ARBITRAJE DE DOS LADOS (BUY & SELL) — 23, 24 Y 25 DE JULIO ===\n");

  // 1. Obtener todas las órdenes de COMPRA (BUY) y VENTA (SELL) en los 3 días
  const orders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.blockTimestamp, "2026-07-23T00:00:00.000Z"),
        lte(schema.orders.blockTimestamp, "2026-07-25T23:59:59.999Z")
      )
    );

  const buyOrders = orders.filter((o) => o.orderType === "BUY" && o.status === "completed");
  const sellOrders = orders.filter((o) => o.orderType === "SELL" && o.status === "completed");

  console.log(`📊 Total órdenes en los 3 días: ${orders.length}`);
  console.log(`🟢 Órdenes de COMPRA (BUY) completadas: ${buyOrders.length}`);
  console.log(`🔴 Órdenes de VENTA (SELL) completadas: ${sellOrders.length}\n`);

  // 2. Analizar las Órdenes de VENTA (SELL): ¿De dónde viene el USDC que venden al contrato?
  console.log("========================================================");
  console.log("🔍 ANÁLISIS DEL LADO 2: VENTAS DE USDC EN EL CONTRATO (SELL)");
  console.log("========================================================\n");

  const sellUserMap = new Map<string, { totalUsdc: number; count: number; sampleOrder: any }>();

  for (const s of sellOrders) {
    if (!s.user || s.user === "-") continue;
    const existing = sellUserMap.get(s.user) ?? { totalUsdc: 0, count: 0, sampleOrder: s };
    existing.totalUsdc += s.usdc;
    existing.count++;
    sellUserMap.set(s.user, existing);
  }

  const topSellers = [...sellUserMap.values()].sort((a, b) => b.totalUsdc - a.totalUsdc);

  console.log(`🏆 Top Vendedores de USDC en el Contrato (23-25 Julio):\n`);
  topSellers.slice(0, 10).forEach((st, idx) => {
    const rate = st.sampleOrder.usdc > 0 ? (st.sampleOrder.fiat / st.sampleOrder.usdc).toFixed(2) : "0";
    console.log(
      ` ${idx + 1}. Seller: ${st.sampleOrder.user}`
    );
    console.log(
      `    Total Vendido: $${st.totalUsdc.toFixed(2)} USDC en ${st.count} órdenes | Tasa Muestra: ${rate} VES/USDC`
    );
  });

  // 3. Verificar si los vendedores traen USDC desde fuera (Binance / CEX / Hot Wallets)
  console.log("\n========================================================");
  console.log("🕵️‍♂️ ORIGEN DEL USDC DE LOS TOP VENDEDORES (Rastreo On-Chain):");
  console.log("========================================================\n");

  const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  for (const st of topSellers.slice(0, 5)) {
    const sellerAddr = st.sampleOrder.user;
    try {
      // Buscar transferencias entrantes de USDC a esta dirección cerca del bloque de su orden
      const block = BigInt(st.sampleOrder.createdBlock);
      const fromBlock = block - 5000n > 0n ? block - 5000n : 0n;

      const logs = await publicClient.getLogs({
        address: USDC_ADDRESS_BASE,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: false, name: "value", type: "uint256" },
          ],
        },
        args: {
          to: sellerAddr as any,
        },
        fromBlock,
        toBlock: block,
      });

      console.log(`👤 Vendedor ${sellerAddr}:`);
      console.log(`   - Órdenes de venta en contrato: ${st.count} | Volumen: $${st.totalUsdc.toFixed(2)} USDC`);
      console.log(`   - Transferencias entrantes de USDC previas encontradas: ${logs.length}`);

      const senders = new Set<string>();
      for (const l of logs) {
        senders.add((l as any).args.from);
      }

      for (const sender of senders) {
        console.log(`     👉 Recibió USDC de origen: ${sender}`);
      }
      console.log("");
    } catch (err: any) {
      console.log(`👤 Vendedor ${sellerAddr}: Error consultando logs (${err?.message ?? err})\n`);
    }
  }
}

main().catch(console.error);
