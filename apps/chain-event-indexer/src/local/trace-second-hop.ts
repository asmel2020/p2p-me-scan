import { createClient, RPC_URLS } from "../shared/rpc-config";
import { type Address, parseAbiItem } from "viem";

const publicClient = createClient(RPC_URLS[0]);

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const secondHopWallet = "0xC26375024AF88D9288Bea15791f136b9640de8de" as Address;

const TRANSFER_EVENT_ABI = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

async function main() {
  console.log(`=== RASTREANDO SEGUNDO SALTO (0xC263...e8de) ===\n`);

  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock - 100000n;

  const logs = await publicClient.getLogs({
    address: USDC_ADDRESS_BASE,
    event: TRANSFER_EVENT_ABI,
    args: {
      from: secondHopWallet,
    },
    fromBlock,
    toBlock: currentBlock,
  });

  console.log(`Total transferencias de USDC enviadas desde la billetera receptora: ${logs.length}\n`);

  for (const log of logs) {
    const to = log.args.to as string;
    const usdcVal = Number(log.args.value) / 1e6;
    console.log(`  👉 Envió $${usdcVal.toFixed(2)} USDC a: ${to} | Tx: ${log.transactionHash}`);
  }
}

main().catch(console.error);
