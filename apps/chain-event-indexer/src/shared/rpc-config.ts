import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.resolve(__dirname, "../../data");
export const LOG_FILE = path.resolve(DATA_DIR, "rpc-errors.log");

export type RpcEntry = {
  url: string;
  concurrency: number;
  maxInflight: number;
};

export const RPC_CONFIG: RpcEntry[] = [
  {
    url: "https://rpc.ankr.com/base/e487627c09ac093cbf96da8b4661adbda413391c1824c0c09a8bb1ad314bdd06",
    concurrency: 25,
    maxInflight: 20,
  },
  {
    url: "https://rpc.ankr.com/base/285e771bfe6acaa6bb6e61aff95927f087f0a7b06d4b5c8be826e44914d49ec4",
    concurrency: 25,
    maxInflight: 20,
  },
  {
    url: "https://rpc.ankr.com/base/277bb99f6262d8fc43f35b8c9e78858bcbbea4184dbf49cdc1a960429a76128d",
    concurrency: 25,
    maxInflight: 20,
  },
  {
    url: "https://rpc.ankr.com/base/9676e91ab178d118be498a3fa0f25ea5499e26bbfa8126ec2b1119d0238b4e02",
    concurrency: 25,
    maxInflight: 20,
  },
  {
    url: "https://rpc.ankr.com/base/deab07dfc3434f2426f69c71c0744ea5717e1b03d15abac7703786ded6cfea3d",
    concurrency: 25,
    maxInflight: 20,
  },
  {
    url: "https://rpc.ankr.com/base/414a4342b81a5240292ff22a7155d3f55aa1d35a3602b7dbfbf208596729504e",
    concurrency: 25,
    maxInflight: 20,
  },
  {
    url: "https://rpc.ankr.com/base/9212be52cea6161058a9b24ed8ee5ead295a80645fa64493958502cef67258a0",
    concurrency: 25,
    maxInflight: 20,
  },
  {
    url: "https://rpc.ankr.com/base/4d45a7170fc76ca5615185afb3ea6a638b69e95cb06961f92f72618b5c6ed080",
    concurrency: 25,
    maxInflight: 20,
  },
  { url: "https://mainnet.base.org", concurrency: 5, maxInflight: 3 },
  {
    url: "https://base-mainnet.public.blastapi.io",
    concurrency: 5,
    maxInflight: 3,
  },
  { url: "https://base.gateway.tenderly.co", concurrency: 20, maxInflight: 5 },
  {
    url: "https://gateway.tenderly.co/public/base",
    concurrency: 20,
    maxInflight: 5,
  },
  {
    url: "https://base-mainnet.gateway.tatum.io",
    concurrency: 20,
    maxInflight: 5,
  },
  { url: "https://base.lava.build", concurrency: 20, maxInflight: 5 },
  { url: "https://base.rpc.sentio.xyz", concurrency: 20, maxInflight: 5 },
  {
    url: "https://rpc.swiftnodes.io/rpc/base?key=sn_TbxUrYlRX3OprIw2jVgoaE01ev7owf3q",
    concurrency: 2,
    maxInflight: 1,
  },
];

export const RPC_URLS = RPC_CONFIG.map((c) => c.url);

export function createClient(url: string): any {
  return createPublicClient({
    chain: base,
    transport: http(url, { timeout: 30000 }),
  });
}

export class Semaphore {
  private max: number;
  private queue: (() => void)[] = [];
  private count = 0;

  constructor(max: number) {
    this.max = max;
  }

  async acquire(): Promise<void> {
    if (this.count < this.max) {
      this.count++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.count--;
  }
}

export function logRpcError(
  rpcUrl: string,
  context: string,
  err: unknown,
  phase = "general",
  writeFile = false,
) {
  const msg =
    (err as any)?.message ??
    (err as any)?.shortMessage ??
    (err as any)?.cause ??
    String(err);
  const line = `[${new Date().toISOString()}] [${phase}] RPC: ${rpcUrl} | ${context} | Error: ${msg}`;

  if (writeFile) {
    try {
      fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {}
  } else {
    console.error(line);
  }
}
