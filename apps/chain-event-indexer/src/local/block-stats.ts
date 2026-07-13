import { createClient, RPC_URLS } from "../shared/rpc-config";

const publicClient = createClient(RPC_URLS[0]);

const TARGET_DATE = new Date("2026-01-01T00:00:00Z");

async function getBlockByTimestamp(targetTs: number): Promise<bigint> {
  const currentBlock = await publicClient.getBlock({ blockTag: "latest" });
  let low = 0n;
  let high = currentBlock.number;

  while (low < high) {
    const mid = (low + high) / 2n;
    const block = await publicClient.getBlock({ blockNumber: mid });
    const blockTs = Number(block.timestamp);

    if (blockTs < targetTs) {
      low = mid + 1n;
    } else {
      high = mid;
    }
  }

  return low;
}

async function main() {
  const targetDate = new Date("2026-01-01T00:00:00Z");
  const targetTs = Math.floor(targetDate.getTime() / 1000);

  console.log(`Buscando bloque para: ${targetDate.toISOString()}`);
  const startBlock = await getBlockByTimestamp(targetTs);
  const startBlockData = await publicClient.getBlock({ blockNumber: startBlock });
  console.log(`Bloque de inicio: ${startBlock} (timestamp: ${startBlockData.timestamp})`);

  const currentBlockData = await publicClient.getBlock({ blockTag: "latest" });
  const currentBlock = currentBlockData.number;
  const currentDate = new Date(Number(currentBlockData.timestamp) * 1000);
  console.log(`Bloque actual: ${currentBlock} (${currentDate.toISOString()})`);

  const totalBlocks = currentBlock - startBlock;
  const avgBlockTime = Number(currentBlockData.timestamp - startBlockData.timestamp) / Number(totalBlocks);

  console.log(`\n--- Resumen ---`);
  console.log(`Bloque en 01/01/2026:       ${startBlock}`);
  console.log(`Bloque actual (hoy):       ${currentBlock}`);
  console.log(`Total bloques en el rango: ${totalBlocks}`);
  console.log(`Tiempo promedio por bloque: ${avgBlockTime.toFixed(2)} segundos`);
  console.log(`Rango de fechas:           01/01/2026 → ${new Date(Number(currentBlockData.timestamp) * 1000).toLocaleDateString("es-ES")}`);
}

main().catch(console.error);
