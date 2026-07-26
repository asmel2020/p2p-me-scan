import { createClient, RPC_URLS } from "../shared/rpc-config";
import { type Address } from "viem";

const publicClient = createClient(RPC_URLS[0]);
const targetAddr = "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055" as Address;

async function main() {
  const code = await publicClient.getBytecode({ address: targetAddr });
  const isContract = code && code !== "0x";
  console.log(`Billetera final: ${targetAddr}`);
  console.log(`Es Contrato Inteligente: ${isContract ? "SÍ (Router / Bridge / Vault)" : "NO (EOA / Dirección Personal o Depósito CEX)"}`);
}

main().catch(console.error);
