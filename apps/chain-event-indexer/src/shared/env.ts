import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), "../../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN } =
  process.env;

export function getCloudflareEnv(): {
  accountId: string;
  databaseId: string;
  apiToken: string;
} {
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

export { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN };
