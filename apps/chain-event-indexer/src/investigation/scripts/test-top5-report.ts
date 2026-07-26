import { getWalletsBalanceHtmlReport } from "../../arbitrage-bot/wallet-checker";

async function main() {
  const html = await getWalletsBalanceHtmlReport();
  console.log(html);
}

main().catch(console.error);
