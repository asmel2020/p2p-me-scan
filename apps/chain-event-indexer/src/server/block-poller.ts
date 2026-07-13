import { createClient, RPC_URLS, Semaphore } from "../shared/rpc-config";

const semaphores = new Map<string, Semaphore>();
for (const url of RPC_URLS) {
  semaphores.set(url, new Semaphore(1));
}

let rpcIndex = 0;
let currentUrl = RPC_URLS[0];
let currentClient = createClient(currentUrl);

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

  function switchRpc() {
    rpcIndex = (rpcIndex + 1) % RPC_URLS.length;
    currentUrl = RPC_URLS[rpcIndex];
    currentClient = createClient(currentUrl);
    const short = currentUrl.replace(/https?:\/\//, "").slice(0, 45);
    console.warn(`RPC falló, cambiando a ${short} (intento ${consecutiveErrors})`);
  }

  async function getBlockNumber(): Promise<bigint> {
    const sem = semaphores.get(currentUrl)!;
    await sem.acquire();
    try {
      return await currentClient.getBlockNumber();
    } finally {
      sem.release();
    }
  }

  async function poll() {
    while (running) {
      try {
        const current = await getBlockNumber();
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
        switchRpc();

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