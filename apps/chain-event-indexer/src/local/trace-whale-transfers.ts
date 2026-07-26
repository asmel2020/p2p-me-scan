import { createClient, RPC_URLS } from "../shared/rpc-config";
import { type Address, parseAbiItem } from "viem";

const publicClient = createClient(RPC_URLS[0]);

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const targetUser = "0x58903b37754acb59b686e97d94409d68375ac2d2" as Address;

const TRANSFER_EVENT_ABI = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

async function main() {
  console.log(`=== RASTREANDO SALIDA DE FONDOS (USDC) DE LA WHALE ===`);
  console.log(`👤 Dirección objetivo: ${targetUser}\n`);

  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock - 50000n; // ~27 horas atrás en Base

  console.log(`Escaneando transferencias de USDC desde bloque ${fromBlock} hasta ${currentBlock}...`);

  // Buscar transferencias salientes de USDC desde esta dirección
  const logs = await publicClient.getLogs({
    address: USDC_ADDRESS_BASE,
    event: TRANSFER_EVENT_ABI,
    args: {
      from: targetUser,
    },
    fromBlock,
    toBlock: currentBlock,
  });

  console.log(`\n Total de transferencias salientes de USDC encontradas: ${logs.length}\n`);

  const destinationTotals = new Map<string, number>();

  for (const log of logs) {
    const to = log.args.to as string;
    const rawVal = log.args.value as bigint;
    const usdcVal = Number(rawVal) / 1e6;

    destinationTotals.set(to, (destinationTotals.get(to) ?? 0) + usdcVal);

    console.log(
      `💸 Transferencia saliente | Destino: ${to} | Monto: $${usdcVal.toFixed(2)} USDC | Tx: ${log.transactionHash}`
    );
  }

  console.log("\n========================================================");
  console.log("📊 RESUMEN DE DESTINATARIOS MÁS COMUNES:");
  for (const [dest, total] of destinationTotals.entries()) {
    console.log(`  👉 Envió a ${dest} → Total: $${total.toFixed(2)} USDC`);
  }
}

main().catch(console.error);
