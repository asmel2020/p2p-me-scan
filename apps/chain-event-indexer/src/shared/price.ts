import { type Address } from "viem";
import { publicClient, DIAMOND_ADDRESS } from "./events";

/* -------------------------------------------------------------------------- */
/*  Constantes                                                                */
/* -------------------------------------------------------------------------- */

export const VEN_CURRENCY_HEX =
  "0x56454e0000000000000000000000000000000000000000000000000000000000" as const;

const CURRENCIES: { name: string; hex: `0x${string}` }[] = [
  { name: "VEN", hex: VEN_CURRENCY_HEX },
];

/* -------------------------------------------------------------------------- */
/*  ABI getPriceConfig                                                        */
/* -------------------------------------------------------------------------- */

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
          {
            internalType: "uint256",
            name: "buyPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "sellPrice",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "buyPriceOffset",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "baseSpread",
            type: "uint256",
          },
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

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                     */
/* -------------------------------------------------------------------------- */

export interface PriceConfig {
  buyPrice: bigint;
  sellPrice: bigint;
  buyPriceOffset: bigint;
  baseSpread: bigint;
}

export interface BlockPriceResult {
  currency: string;
  currencyHex: string;
  buyPrice: number;
  sellPrice: number;
  buyPriceOffset: number;
  baseSpread: number;
}

/* -------------------------------------------------------------------------- */
/*  Funciones auxiliares                                                       */
/* -------------------------------------------------------------------------- */

const PRICE_DECIMALS = 6;
const PRICE_DIVISOR = 10 ** PRICE_DECIMALS;

/**
 * Convierte un bigint del contrato (6 decimales) a número fiat legible.
 * Ej: 38750000n → 38.75
 */
function formatFiatPrice(raw: bigint): number {
  return Number(raw) / PRICE_DIVISOR;
}

/* -------------------------------------------------------------------------- */
/*  Funciones públicas                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Consulta getPriceConfig del contrato Diamond en un bloque específico.
 * Usa estado archive para obtener el precio exacto de ese bloque.
 */
export async function fetchPriceAtBlock(
  blockNumber: bigint,
  currencyHex: `0x${string}` = VEN_CURRENCY_HEX,
): Promise<PriceConfig> {
  const result = await publicClient.readContract({
    address: DIAMOND_ADDRESS as Address,
    abi: GET_PRICE_CONFIG_ABI,
    functionName: "getPriceConfig",
    args: [currencyHex],
    blockNumber,
  });

  return {
    buyPrice: result.buyPrice,
    sellPrice: result.sellPrice,
    buyPriceOffset: result.buyPriceOffset,
    baseSpread: result.baseSpread,
  };
}

/**
 * Consulta precios para todas las monedas configuradas en un bloque específico.
 * Retorna un array de resultados, uno por moneda, con precios formateados como fiat.
 */
export async function fetchAllPricesAtBlock(
  blockNumber: bigint,
): Promise<BlockPriceResult[]> {
  const results: BlockPriceResult[] = [];

  for (const { name, hex } of CURRENCIES) {
    try {
      const config = await fetchPriceAtBlock(blockNumber, hex);
      results.push({
        currency: name,
        currencyHex: hex,
        buyPrice: formatFiatPrice(config.buyPrice),
        sellPrice: formatFiatPrice(config.sellPrice),
        buyPriceOffset: formatFiatPrice(config.buyPriceOffset),
        baseSpread: formatFiatPrice(config.baseSpread),
      });
    } catch (err) {
      console.error(
        `Error obteniendo precio ${name} en bloque ${blockNumber}:`,
        (err as any)?.message ?? err,
      );
    }
  }

  return results;
}

export { CURRENCIES };
