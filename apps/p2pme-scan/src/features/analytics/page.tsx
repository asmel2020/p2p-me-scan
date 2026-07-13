import { useState, useMemo } from "react";
import { RootLayout } from "@/components/root-layout";
import {
  useDailyTransferability,
  getAvailableCurrencies,
} from "./hooks/useDailyTransferability";
import { TransferabilityChart } from "./components/transferability-chart";
import {
  RangeFilterModal,
  type RangeMode,
} from "./components/range-filter-modal";
import type { DailyTransfer } from "./types";

const currencies = getAvailableCurrencies();

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="stat-card">
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--color-muted-foreground)",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-muted-foreground)",
            marginTop: "0.125rem",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getWeekId(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getMonthId(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function getYearId(dateStr: string): string {
  return dateStr.slice(0, 4);
}

function aggregate(
  data: DailyTransfer[],
  rangeMode: RangeMode,
  fromDate?: string,
  toDate?: string,
): DailyTransfer[] {
  let filtered = data;

  if (fromDate) {
    filtered = filtered.filter((d) => d.date >= fromDate);
  }
  if (toDate) {
    filtered = filtered.filter((d) => d.date <= toDate);
  }

  if (rangeMode === "daily") {
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }

  const getKey =
    rangeMode === "weekly"
      ? getWeekId
      : rangeMode === "monthly"
        ? getMonthId
        : getYearId;

  const map = new Map<
    string,
    { usdcVolume: number; completedCount: number; fiatVolume: number }
  >();
  for (const d of filtered) {
    const key = getKey(d.date);
    const existing = map.get(key);
    if (existing) {
      existing.usdcVolume += d.usdcVolume;
      existing.completedCount += d.completedCount;
      existing.fiatVolume += d.fiatVolume;
    } else {
      map.set(key, {
        usdcVolume: d.usdcVolume,
        completedCount: d.completedCount,
        fiatVolume: d.fiatVolume,
      });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      date: key,
      usdcVolume: v.usdcVolume,
      fiatVolume: v.fiatVolume,
      completedCount: v.completedCount,
      currency: filtered[0]?.currency ?? "ALL",
    }));
}

export function AnalyticsPage() {
  const { data, isFetching } = useDailyTransferability();
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [rangeMode, setRangeMode] = useState<RangeMode>("daily");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function toLocalDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const handleRangeModeChange = (mode: RangeMode) => {
    setRangeMode(mode);
    if (mode === "daily") {
      setFromDate("");
      setToDate("");
    } else {
      const today = new Date();
      const to = toLocalDateStr(today);
      const from = new Date(today);
      if (mode === "weekly") from.setDate(from.getDate() - 7);
      else if (mode === "monthly") from.setDate(from.getDate() - 30);
      else from.setDate(from.getDate() - 365);
      setFromDate(toLocalDateStr(from));
      setToDate(to);
    }
  };

  const handleApplyCustomRange = (from: Date, to: Date) => {
    setFromDate(toLocalDateStr(from));
    setToDate(toLocalDateStr(to));
    setRangeMode("daily");
  };

  const currencyFiltered = useMemo(() => {
    if (!data) return [];
    if (currencyFilter === "all") {
      const map = new Map<string, DailyTransfer>();
      for (const d of data) {
        const existing = map.get(d.date);
        if (existing) {
          existing.usdcVolume += d.usdcVolume;
          existing.completedCount += d.completedCount;
        } else {
          map.set(d.date, {
            date: d.date,
            usdcVolume: d.usdcVolume,
            fiatVolume: 0,
            completedCount: d.completedCount,
            currency: "ALL",
          });
        }
      }
      return Array.from(map.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    }
    return data.filter((d) => d.currency === currencyFilter);
  }, [data, currencyFilter]);

  const filtered = useMemo(
    () =>
      aggregate(
        currencyFiltered,
        rangeMode,
        fromDate || undefined,
        toDate || undefined,
      ),
    [currencyFiltered, rangeMode, fromDate, toDate],
  );

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const totalVolume = filtered.reduce((s, d) => s + d.usdcVolume, 0);
    const totalFiat = filtered.reduce((s, d) => s + d.fiatVolume, 0);
    const totalCompleted = filtered.reduce((s, d) => s + d.completedCount, 0);
    const periods = filtered.length;
    const avgVolume = totalVolume / periods;
    return {
      totalVolume,
      totalFiat,
      totalCompleted,
      avgVolume,
      periods,
    };
  }, [filtered]);

  const rangeLabel = rangeMode.charAt(0).toUpperCase() + rangeMode.slice(1);

  return (
    <RootLayout>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}
        >
          Analytics
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-muted-foreground)",
            margin: 0,
          }}
        >
          {rangeLabel} transferability overview
        </p>
      </div>

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <StatCard
            label="Total Volume"
            value={`${stats.totalVolume.toLocaleString()} USDC`}
          />
          {currencyFilter !== "all" && (
            <StatCard
              label="Total Fiat"
              value={stats.totalFiat.toLocaleString()}
              subtitle={currencyFilter}
            />
          )}
          <StatCard
            label="Avg. Volume"
            value={`${(stats.avgVolume / 1000).toFixed(1)}k USDC`}
          />
          <StatCard
            label="Completed Orders"
            value={stats.totalCompleted.toLocaleString()}
            subtitle={`${stats.periods} periods`}
          />
        </div>
      )}

      <div
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-xl)",
          padding: "1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
            USDC Volume ({rangeLabel})
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {isFetching && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-muted-foreground)",
                }}
              >
                Updating...
              </span>
            )}
            <RangeFilterModal
              rangeMode={rangeMode}
              onRangeModeChange={handleRangeModeChange}
              onApplyCustomRange={handleApplyCustomRange}
            />
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              style={{
                background: "var(--color-muted)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "0.25rem 0.5rem",
                fontSize: "0.8125rem",
                minWidth: 140,
                cursor: "pointer",
              }}
            >
              <option value="all">All currencies</option>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TransferabilityChart data={filtered} isLoading={isFetching} />
      </div>
    </RootLayout>
  );
}
