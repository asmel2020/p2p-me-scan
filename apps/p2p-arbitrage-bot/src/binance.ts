/**
 * Módulo de consulta de precios en vivo a Binance P2P API.
 * Aplica los filtros exactos de método de pago (PagoMovil)
 * y descarta estrictamente anuncios promocionales (privilegeType).
 */

export async function fetchBinanceP2PPrice(tradeType: "BUY" | "SELL" = "SELL"): Promise<number | null> {
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
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    if (data.success && Array.isArray(data.data)) {
      // Filtrar anuncios promocionales o patrocinados (privilegeType / Anuncio Promocionado)
      const validAds = data.data.filter((item: any) => {
        const adv = item.adv;
        const advertiser = item.advertiser;
        if (!adv || !adv.price) return false;
        if (adv.isPromoted || advertiser?.isPromoted) return false;
        if (adv.classify === "promoted") return false;

        // Filtro estricto para Anuncio Promocionado / privilegeType
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
        return parseFloat(validAds[0].adv.price);
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}
