import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const RPC_URLS = [
  "https://open-platform.nodereal.io/7ec788841b9f40b68f6388040bca2a68/base",
]; /* "https://mainnet.base.org,https://8453.rpc.thirdweb.com".split(
  ",",
); */

let rpcIndex = 0;

function createFallbackClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url),
  });
}

let publicClient = createFallbackClient(RPC_URLS[0]);

export type BlockHandler = (blockNumber: bigint) => void | Promise<void>;

export function startBlockPoller(
  intervalMs = 3000,
  startBlock?: bigint,
): {
  stop: () => void;
  onBlock: (handler: BlockHandler) => void;
} {
  let lastBlock = startBlock ?? 0n;
  let running = true;
  let consecutiveErrors = 0;
  const maxErrorsBeforeBackoff = 5;
  const handlers: BlockHandler[] = [];

  async function poll() {
    while (running) {
      try {
        const current = await publicClient.getBlockNumber();
        consecutiveErrors = 0;

        if (lastBlock === 0n) {
          lastBlock = current;
        } else if (current > lastBlock) {
          for (let b = lastBlock + 1n; b <= current; b++) {
            for (const h of handlers) {
              try {
                await h(b);
              } catch {
                // handler individual falló, no corta los demás
              }
            }
          }
          lastBlock = current;
        }
      } catch {
        consecutiveErrors++;

        if (RPC_URLS.length > 1) {
          rpcIndex = (rpcIndex + 1) % RPC_URLS.length;
          publicClient = createFallbackClient(RPC_URLS[rpcIndex]);
          console.warn(
            `RPC falló, cambiando a ${RPC_URLS[rpcIndex]} (intento ${consecutiveErrors})`,
          );
        }

        const backoff =
          consecutiveErrors > maxErrorsBeforeBackoff
            ? Math.min(30000, intervalMs * consecutiveErrors)
            : intervalMs;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  poll();

  return {
    stop: () => {
      running = false;
    },
    onBlock: (handler: BlockHandler) => {
      handlers.push(handler);
    },
  };
}
