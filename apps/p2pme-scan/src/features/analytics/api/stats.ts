import type { DailyTransfer } from '../types';

const CURRENCIES = ['VEN', 'INR', 'IDR', 'BRL', 'ARS', 'MEX', 'EUR', 'NGN', 'USD', 'COP', 'ECU'];

const currencyBase: Record<string, { usdc: number; fiat: number }> = {
  VEN: { usdc: 20000, fiat: 8000000 },
  INR: { usdc: 45000, fiat: 3750000 },
  IDR: { usdc: 15000, fiat: 240000000 },
  BRL: { usdc: 28000, fiat: 140000 },
  ARS: { usdc: 15000, fiat: 12000000 },
  MEX: { usdc: 22000, fiat: 440000 },
  EUR: { usdc: 42000, fiat: 39000 },
  NGN: { usdc: 10000, fiat: 14000000 },
  USD: { usdc: 50000, fiat: 50000 },
  COP: { usdc: 8000, fiat: 32000000 },
  ECU: { usdc: 12000, fiat: 12000 },
};

function generateMockDailyData(days: number): DailyTransfer[] {
  const data: DailyTransfer[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    for (const currency of CURRENCIES) {
      const base = currencyBase[currency] ?? { usdc: 30000, fiat: 30000 };
      const usdc = base.usdc + Math.random() * 20000;
      const fiatRatio = base.fiat / base.usdc;
      data.push({
        date: dateStr,
        currency,
        usdcVolume: Math.round(usdc),
        fiatVolume: Math.round(usdc * fiatRatio * (0.9 + Math.random() * 0.2)),
        completedCount: Math.floor(5 + Math.random() * 25),
      });
    }
  }
  return data;
}

const mockDailyTransfers = generateMockDailyData(30);

export function getAvailableCurrencies(): string[] {
  return CURRENCIES;
}

export async function fetchDailyTransferability(): Promise<DailyTransfer[]> {
  await new Promise((r) => setTimeout(r, 300));
  return mockDailyTransfers;
}
