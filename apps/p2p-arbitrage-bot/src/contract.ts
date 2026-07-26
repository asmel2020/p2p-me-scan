import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { RPC_URLS, DIAMOND_ADDRESS, VEN_CURRENCY_HEX } from "./config";

export { RPC_URLS };

const GET_PRICE_CONFIG_ABI = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "_currency",
        type: "bytes32",
      },
    ],
    name: "getPriceConfig",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "buyPrice", type: "uint256" },
          { internalType: "uint256", name: "sellPrice", type: "uint256" },
          { internalType: "int256", name: "buyPriceOffset", type: "int256" },
          { internalType: "uint256", name: "baseSpread", type: "uint256" },
        ],
        internalType: "struct P2pConfigStorage.PriceConfig",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function createClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url, {
      timeout: 30000,
      fetchOptions: {
        headers: {
          Origin: "https://lp.p2p.me",
          Referer: "https://lp.p2p.me/",
        },
      },
    }),
  });
}

export interface ContractPrices {
  buyPrice: number;
  sellPrice: number;
}

/**
 * Consulta getPriceConfig del contrato Diamond en un bloque específico con RPC Fallback.
 */
export async function fetchContractPriceAtBlock(blockNumber: bigint): Promise<ContractPrices> {
  let lastError: unknown;

  for (let i = 0; i < RPC_URLS.length; i++) {
    try {
      const client = createClient(RPC_URLS[i]);
      const result = await client.readContract({
        address: DIAMOND_ADDRESS as Address,
        abi: GET_PRICE_CONFIG_ABI,
        functionName: "getPriceConfig",
        args: [VEN_CURRENCY_HEX],
        blockNumber,
      });

      return {
        buyPrice: Number(result.buyPrice) / 1e6,
        sellPrice: Number(result.sellPrice) / 1e6,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
