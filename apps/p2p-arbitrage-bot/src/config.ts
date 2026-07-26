import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

export const RPC_URLS = [
  "https://base-mainnet.g.alchemy.com/v2/pSMdFJAKA5ldsKRIaRpTMyWrCQVXpoXn",
  "https://rpc.ankr.com/base/4d45a7170fc76ca5615185afb3ea6a638b69e95cb06961f92f72618b5c6ed080",
  "https://rpc.ankr.com/base/285e771bfe6acaa6bb6e61aff95927f087f0a7b06d4b5c8be826e44914d49ec4",
  "https://rpc.ankr.com/base/277bb99f6262d8fc43f35b8c9e78858bcbbea4184dbf49cdc1a960429a76128d",
  "https://mainnet.base.org",
];

export const DIAMOND_ADDRESS =
  "0x4cad6eC90e65baBec9335cAd728DDC610c316368" as const;
export const VEN_CURRENCY_HEX =
  "0x56454e0000000000000000000000000000000000000000000000000000000000" as const;

export const BOT_CONFIG = {
  // Umbral mínimo de ganancia neta (%) para enviar notificación a Telegram
  minProfitMarginPct: process.env.MIN_PROFIT_MARGIN_PCT
    ? parseFloat(process.env.MIN_PROFIT_MARGIN_PCT)
    : 0.0,
  simulatedTradeUsdc: process.env.SIMULATED_TRADE_USDC
    ? parseFloat(process.env.SIMULATED_TRADE_USDC)
    : 250,
  checkIntervalMs: 2000, // Chequeo cada bloque en Base (~2 seg)
  alertCooldownMs: 30000, // Cooldown de 30 segundos entre alertas de Telegram
  silentConsoleLogs: true, // Silencia el log continuo
};
