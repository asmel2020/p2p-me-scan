import { type Address, type Log } from "viem";
import { createClient, RPC_URLS } from "./rpc-config";

/* -------------------------------------------------------------------------- */
/*  Constantes de configuración                                               */
/* -------------------------------------------------------------------------- */

const RPC_URL = RPC_URLS[0];
const DIAMOND_ADDRESS = "0x4cad6eC90e65baBec9335cAd728DDC610c316368";

/* -------------------------------------------------------------------------- */
/*  Selectores y nombres de eventos                                           */
/* -------------------------------------------------------------------------- */

const EVENT_NAMES: Record<string, string> = {
  "0x779f1f1fb7c2574e36be741fe09fea13f48014d4624035b113e26a44c562422a":
    "OrderPlaced",
  "0x724b4a738d6b8b5387a77a3a50fb8d7814d1b89bd5b21089dee6cfcf9ccc9577":
    "OrderAccepted",
  "0xe1e5486451892c32135675e25b18ce7578d49bc187a91cbfe35f610b08754a6c":
    "BuyOrderPaid",
  "0x507539023a7b6a713438d0f44eab4f97bcf8905b183b1108148409a8e8c1ed8c":
    "OrderCompleted",
  "0x24e0e750e9b0658d9179ad1662912205ec2f1b2dc00bcbda15d801da1bb5a35a":
    "CancelledOrders",
};

/* -------------------------------------------------------------------------- */
/*  ABI de los eventos                                                        */
/* -------------------------------------------------------------------------- */

const ORDER_COMPONENTS = [
  { name: "amount", type: "uint256" },
  { name: "fiatAmount", type: "uint256" },
  { name: "placedTimestamp", type: "uint256" },
  { name: "completedTimestamp", type: "uint256" },
  { name: "userCompletedTimestamp", type: "uint256" },
  { name: "acceptedMerchant", type: "address" },
  { name: "user", type: "address" },
  { name: "recipientAddr", type: "address" },
  { name: "pubkey", type: "string" },
  { name: "encUpi", type: "string" },
  { name: "userCompleted", type: "bool" },
  { name: "status", type: "uint8" },
  { name: "orderType", type: "uint8" },
  {
    name: "disputeInfo",
    type: "tuple",
    components: [
      { name: "raisedBy", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "redactTransId", type: "uint256" },
      { name: "accountNumber", type: "uint256" },
    ],
  },
  { name: "id", type: "uint256" },
  { name: "userPubKey", type: "string" },
  { name: "encMerchantUpi", type: "string" },
  { name: "acceptedAccountNo", type: "uint256" },
  { name: "assignedAccountNos", type: "uint256[]" },
  { name: "currency", type: "bytes32" },
  { name: "preferredPaymentChannelConfigId", type: "uint256" },
  { name: "circleId", type: "uint256" },
];

const ORDER_EVENT_ABI = [
  {
    type: "event",
    name: "OrderPlaced",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "merchant", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "orderType", type: "uint8" },
      { indexed: false, name: "placedTimestamp", type: "uint256" },
      {
        indexed: false,
        name: "_order",
        type: "tuple",
        components: ORDER_COMPONENTS,
      },
    ],
  },
  {
    type: "event",
    name: "OrderAccepted",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "merchant", type: "address" },
      { indexed: false, name: "pubKey", type: "string" },
      {
        indexed: false,
        name: "_order",
        type: "tuple",
        components: ORDER_COMPONENTS,
      },
    ],
  },
  {
    type: "event",
    name: "BuyOrderPaid",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "user", type: "address" },
      {
        indexed: false,
        name: "_order",
        type: "tuple",
        components: ORDER_COMPONENTS,
      },
    ],
  },
  {
    type: "event",
    name: "OrderCompleted",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "completedTimestamp", type: "uint256" },
      {
        indexed: false,
        name: "_order",
        type: "tuple",
        components: ORDER_COMPONENTS,
      },
    ],
  },
  {
    type: "event",
    name: "CancelledOrders",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      {
        indexed: false,
        name: "_order",
        type: "tuple",
        components: ORDER_COMPONENTS,
      },
    ],
  },
] as const;

const ORDER_TYPE_NAMES = ["BUY", "SELL", "RENT"] as const;

/* -------------------------------------------------------------------------- */
/*  Funciones auxiliares                                                      */
/* -------------------------------------------------------------------------- */

function decodeCurrency(hex: string): string {
  try {
    const cleaned = hex.slice(2);
    let result = "";
    for (let i = 0; i < cleaned.length; i += 2) {
      const byte = parseInt(cleaned.slice(i, i + 2), 16);
      if (byte === 0) break;
      result += String.fromCharCode(byte);
    }
    return result;
  } catch {
    return "?";
  }
}

/* -------------------------------------------------------------------------- */
/*  Tipos exportados                                                          */
/* -------------------------------------------------------------------------- */

export type ChainEvent = {
  orderId: number;
  eventName: string;
  user: string;
  merchant: string;
  recipientAddr: string;
  acceptedMerchant: string;
  usdc: number;
  fiat: number;
  orderType: string;
  currency: string;
  blockNumber: number;
  blockTimestamp: string;
  blockTimestampUnix: number;
  txHash: string;
  logIndex: number | null;
};

export type FetchEventsResult = {
  events: ChainEvent[];
  blockRange: { from: number; to: number; current: number };
  total: number;
};

/* -------------------------------------------------------------------------- */
/*  Cliente viem                                                              */
/* -------------------------------------------------------------------------- */

const publicClient = createClient(RPC_URL);

/* -------------------------------------------------------------------------- */
/*  Funciones públicas                                                        */
/* -------------------------------------------------------------------------- */

function decodeLog(log: Log): ChainEvent | null {
  if (!log.topics[0] || !(log.topics[0] in EVENT_NAMES)) return null;

  const eventName = EVENT_NAMES[log.topics[0]] ?? "Unknown";

  const orderId = log.topics[1] ? Number(BigInt(log.topics[1])) : 0;
  let user = "-";
  let merchant = "-";
  if (log.topics[2]) {
    user = `0x${log.topics[2].slice(26)}`;
  }
  if (log.topics[3]) {
    merchant = `0x${log.topics[3].slice(26)}`;
  }
  if (eventName === "CancelledOrders" && log.topics[2]) {
    user = `0x${log.topics[2].slice(26)}`;
    merchant = "-";
  }

  let usdc = 0;
  let fiat = 0;
  let orderType = "?";
  let currency = "?";
  let recipientAddr = "-";
  let acceptedMerchant = "-";

  try {
    const args = (log as any).args;
    if (args._order) {
      const order = args._order;
      usdc = Number(order.amount) / 1e6;
      fiat = Number(order.fiatAmount) / 1e6;
      orderType =
        ORDER_TYPE_NAMES[Number(order.orderType)] ?? "type" + order.orderType;
      currency = decodeCurrency(order.currency);
      recipientAddr = order.recipientAddr ?? "-";
      acceptedMerchant = order.acceptedMerchant ?? "-";
    } else if (args.amount !== undefined) {
      usdc = Number(args.amount) / 1e6;
      orderType =
        ORDER_TYPE_NAMES[Number(args.orderType)] ?? "type" + args.orderType;
    }
  } catch {
    // valores por defecto
  }

  return {
    orderId,
    eventName,
    blockTimestamp: "",
    blockTimestampUnix: 0,
    user,
    merchant,
    recipientAddr,
    acceptedMerchant,
    usdc: Number(usdc.toFixed(2)),
    fiat: Number(fiat.toFixed(2)),
    orderType,
    currency,
    blockNumber: Number(log.blockNumber),
    txHash: log.transactionHash ?? "",
    logIndex: log.logIndex,
  };
}

/**
 * Obtiene eventos de un bloque específico. Ideal para usar con el block poller.
 */
export async function fetchBlockEvents(
  blockNumber: bigint,
): Promise<ChainEvent[]> {
  const [logs, block] = await Promise.all([
    publicClient.getLogs({
      address: DIAMOND_ADDRESS as Address,
      events: ORDER_EVENT_ABI,
      fromBlock: blockNumber,
      toBlock: blockNumber,
    }),
    publicClient.getBlock({ blockNumber }),
  ]);

  const ts = Number(block.timestamp);

  return logs
    .map((log: any) => {
      const e = decodeLog(log);
      if (!e) return null;
      e.blockTimestampUnix = ts;
      e.blockTimestamp = new Date(ts * 1000).toISOString();
      return e;
    })
    .filter((e: any): e is ChainEvent => e !== null);
}

export {
  ORDER_EVENT_ABI,
  EVENT_NAMES,
  DIAMOND_ADDRESS,
  RPC_URL,
  publicClient,
  decodeLog,
};
