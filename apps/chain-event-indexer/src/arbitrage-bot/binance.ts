/**
 * Módulo de consulta de precios en vivo a Binance P2P API.
 * Aplica los filtros exactos de método de pago (PagoMovil)
 * e incluye caché de 8 segundos para evitar rate-limiting de Binance.
 */

let cachedBuyPrice: number | null = null;
let lastBuyFetchTime = 0;

let cachedSellPrice: number | null = null;
let lastSellFetchTime = 0;

const CACHE_TTL_MS = 8000; // 8 segundos de caché

export async function fetchBinanceP2PPrice(tradeType: "BUY" | "SELL" = "SELL"): Promise<number | null> {
  const now = Date.now();

  if (tradeType === "BUY" && cachedBuyPrice && now - lastBuyFetchTime < CACHE_TTL_MS) {
    return cachedBuyPrice;
  }
  if (tradeType === "SELL" && cachedSellPrice && now - lastSellFetchTime < CACHE_TTL_MS) {
    return cachedSellPrice;
  }

  try {
    const payload = {
      fiat: "VES",
      page: 1,
      rows: 10,
      tradeType,
      asset: "USDT",
      countries: [],
      proMerchantAds: false,
      shieldMerchantAds: false,
      filterType: "all",
      periods: [],
      additionalKycVerifyFilter: 0,
      publisherType: null,
      payTypes: ["PagoMovil"],
      classifies: ["mass", "profession", "fiat_trade"],
      tradedWith: false,
      followed: false,
    };

    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Origin": "https://p2p.binance.com",
        "Referer": "https://p2p.binance.com/es/trade/all-payments/USDT?fiat=VES",
        "ClientType": "web",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    if (data.success && Array.isArray(data.data)) {
      const validAds = data.data.filter((item: any) => {
        const adv = item.adv;
        const advertiser = item.advertiser;
        if (!adv || !adv.price) return false;
        if (adv.isPromoted || advertiser?.isPromoted) return false;
        if (adv.classify === "promoted") return false;

        if (
          item.privilegeType ||
          item.privilegeDesc ||
          item.privilegeTypeAdTotalCount ||
          adv.privilegeType ||
          adv.privilegeDesc
        ) {
          return false;
        }

        return true;
      });

      if (validAds.length > 0) {
        const price = parseFloat(validAds[0].adv.price);
        if (tradeType === "BUY") {
          cachedBuyPrice = price;
          lastBuyFetchTime = now;
        } else {
          cachedSellPrice = price;
          lastSellFetchTime = now;
        }
        return price;
      }
    }

    return tradeType === "BUY" ? cachedBuyPrice : cachedSellPrice;
  } catch (err) {
    return tradeType === "BUY" ? cachedBuyPrice : cachedSellPrice;
  }
}
