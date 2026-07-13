import apiClient from "@/api/client";
import type { DailyTransfer } from "../types";

const CURRENCIES = [
  "VEN",
  "INR",
  "IDR",
  "BRL",
  "ARS",
  "MEX",
  "EUR",
  "NGN",
  "USD",
  "COP",
  "ECU",
];

export function getAvailableCurrencies(): string[] {
  return CURRENCIES;
}

export async function fetchDailyTransferability(): Promise<DailyTransfer[]> {
  const { data } = await apiClient.get<DailyTransfer[]>(
    "/analytics/daily-transferability",
  );
  return data;
}
