import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { asc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

type GrowthStep = {
  blockNumber: number;
  timestamp: string;
  marginPct: number;
  elapsedSeconds: number;
};

type GapEpisode = {
  episodeId: number;
  route: "LADO_1" | "LADO_2";
  startBlock: number;
  endBlock: number;
  startTime: string;
  endTime: string;
  durationBlocks: number;
  durationSeconds: number;
  initialMarginPct: number;
  peakMarginPct: number;
  grewDuringEpisode: boolean;
  growthSteps: GrowthStep[];
  peakProfitUsdc: number;
};

async function main() {
  console.log("=================================================================");
  console.log("📊 ANÁLISIS DETALLADO: MOMENTOS EXACTOS DONDE CRECIÓ CADA BRECHA");
  console.log("=================================================================\n");

  const opps = await db
    .select()
    .from(schema.arbitrageOpportunities)
    .orderBy(asc(schema.arbitrageOpportunities.blockNumber))
    .limit(1000);

  if (opps.length === 0) {
    console.log("ℹ️ No hay oportunidades registradas en D1.");
    return;
  }

  const episodes: GapEpisode[] = [];
  let currentEpisode: Partial<GapEpisode> | null = null;

  for (const o of opps) {
    const bn = o.blockNumber;
    const ts = o.blockTimestampIso || o.createdAt;
    const margin = o.marginPct;
    const route = o.route as "LADO_1" | "LADO_2";

    if (
      currentEpisode &&
      currentEpisode.route === route &&
      bn <= currentEpisode.endBlock! + 2
    ) {
      currentEpisode.endBlock = bn;
      currentEpisode.endTime = ts;
      if (margin > currentEpisode.peakMarginPct!) {
        const elapsedSecs = (bn - currentEpisode.startBlock!) * 2;
        currentEpisode.peakMarginPct = margin;
        currentEpisode.grewDuringEpisode = true;
        currentEpisode.peakProfitUsdc = o.profitUsdc;
        currentEpisode.growthSteps!.push({
          blockNumber: bn,
          timestamp: ts,
          marginPct: margin,
          elapsedSeconds: elapsedSecs,
        });
      }
    } else {
      if (currentEpisode) {
        const durationBlocks = currentEpisode.endBlock! - currentEpisode.startBlock! + 1;
        episodes.push({
          ...currentEpisode,
          episodeId: episodes.length + 1,
          durationBlocks,
          durationSeconds: durationBlocks * 2,
        } as GapEpisode);
      }

      currentEpisode = {
        episodeId: episodes.length + 1,
        route,
        startBlock: bn,
        endBlock: bn,
        startTime: ts,
        endTime: ts,
        initialMarginPct: margin,
        peakMarginPct: margin,
        grewDuringEpisode: false,
        growthSteps: [],
        peakProfitUsdc: o.profitUsdc,
      };
    }
  }

  if (currentEpisode) {
    const durationBlocks = currentEpisode.endBlock! - currentEpisode.startBlock! + 1;
    episodes.push({
      ...currentEpisode,
      episodeId: episodes.length + 1,
      durationBlocks,
      durationSeconds: durationBlocks * 2,
    } as GapEpisode);
  }

  episodes.forEach((e) => {
    console.log(`=================================================================`);
    console.log(`🔹 EPISODIO #${e.episodeId} [${e.route}]`);
    console.log(`   ├─ Inicio: Bloque ${e.startBlock} (${e.startTime}) | Margen Inicial: +${e.initialMarginPct.toFixed(2)}%`);
    console.log(`   ├─ Fin: Bloque ${e.endBlock} (${e.endTime})`);
    console.log(`   ├─ Duración Total: ${e.durationSeconds} seg (~${(e.durationSeconds / 60).toFixed(1)} min | ${e.durationBlocks} bloques)`);
    
    if (e.grewDuringEpisode) {
      console.log(`   🔥 COMPORTAMIENTO DE CRECIMIENTO DETALLADO:`);
      e.growthSteps.forEach((step, idx) => {
        const minElapsed = (step.elapsedSeconds / 60).toFixed(1);
        console.log(
          `      └─ Incremento #${idx + 1}: Bloque ${step.blockNumber} (${step.timestamp})\n` +
          `         ├─ Nuevo Margen: +${step.marginPct.toFixed(2)}%\n` +
          `         └─ Ocurrió ${step.elapsedSeconds} seg (~${minElapsed} min) después del inicio del episodio.`
        );
      });
    } else {
      console.log(`   └─ El margen se mantuvo constante en +${e.initialMarginPct.toFixed(2)}% sin variaciones hacia arriba.`);
    }
    console.log(`=================================================================\n`);
  });
}

main().catch(console.error);
