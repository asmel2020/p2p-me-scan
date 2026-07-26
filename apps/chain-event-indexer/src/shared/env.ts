import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
  path.resolve(__dirname, "../../../../.env"),
  path.resolve(__dirname, "../../../.env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), ".env"),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
  }
}

export function getCloudflareEnv(): {
  accountId: string;
  databaseId: string;
  apiToken: string;
} {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN } = process.env;
  if (
    !CLOUDFLARE_ACCOUNT_ID ||
    !CLOUDFLARE_DATABASE_ID ||
    !CLOUDFLARE_API_TOKEN
  ) {
    console.error(
      "Faltan variables de entorno: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN",
    );
    process.exit(1);
  }
  return {
    accountId: CLOUDFLARE_ACCOUNT_ID,
    databaseId: CLOUDFLARE_DATABASE_ID,
    apiToken: CLOUDFLARE_API_TOKEN,
  };
}
