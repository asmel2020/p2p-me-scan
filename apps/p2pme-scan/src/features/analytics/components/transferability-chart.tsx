import { useCallback, useRef, useState } from "react";
import {
  Chart,
  LineSeries,
  Pane,
  TimeScale,
  TimeScaleFitContentTrigger,
} from "lightweight-charts-react-components";
import type { DailyTransfer } from "../types";

interface Props {
  data: DailyTransfer[];
  isLoading?: boolean;
}

function formatDateLabel(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (/^\d{4}-W\d{2}$/.test(dateStr)) {
    const [, week] = dateStr.split("-W");
    return `Week ${week}, ${dateStr.slice(0, 4)}`;
  }
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + "-01");
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  if (/^\d{4}$/.test(dateStr)) return dateStr;
  return dateStr;
}

function toChartTime(dateStr: string): string | number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-W\d{2}$/.test(dateStr)) {
    const [year, week] = dateStr.split("-W");
    const jan1 = new Date(Number(year), 0, 1);
    const days = (Number(week) - 1) * 7;
    return Math.floor(jan1.getTime() / 1000) + days * 86400;
  }
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return Math.floor(new Date(dateStr + "-01").getTime() / 1000);
  }
  if (/^\d{4}$/.test(dateStr)) {
    return Math.floor(new Date(dateStr + "-01-01").getTime() / 1000);
  }
  return dateStr;
}

export function TransferabilityChart({ data, isLoading }: Props) {
  const [tooltip, setTooltip] = useState<DailyTransfer | null>(null);
  const chartTimeToData = useRef(new Map<string | number, DailyTransfer>());
  chartTimeToData.current = new Map(data.map((d) => [toChartTime(d.date), d]));

  const handleCrosshairMove = useCallback(
    (param: {
      time?: string | number;
      point?: { x: number; y: number } | null;
    }) => {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      setTooltip(chartTimeToData.current.get(param.time) ?? null);
    },
    [],
  );

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 400,
          color: "var(--color-muted-foreground)",
          fontSize: "0.875rem",
        }}
      >
        Loading chart...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 400,
          color: "var(--color-muted-foreground)",
          fontSize: "0.875rem",
        }}
      >
        No data available
      </div>
    );
  }

  const lineData = data.map((d) => ({
    time: toChartTime(d.date),
    value: d.usdcVolume,
  }));
  const chartKey = data.length > 0 ? data[0].date.replace(/\d/g, "X") : "empty";

  return (
    <div style={{ position: "relative", width: "100%", height: 400 }}>
      <Chart
        key={chartKey}
        onCrosshairMove={handleCrosshairMove as any}
        containerProps={{ style: { width: "100%", height: "100%" } }}
        options={{
          height: 400,
          layout: {
            background: { color: "transparent" },
            textColor: "#a0a0a0",
          },
          grid: {
            vertLines: { color: "rgba(255,255,255,0.08)" },
            horzLines: { color: "rgba(255,255,255,0.08)" },
          },
          crosshair: {
            vertLine: {
              color: "rgba(255,255,255,0.08)",
              style: 2,
              width: 1,
              labelBackgroundColor: "#2a2a2a",
            },
            horzLine: {
              color: "rgba(255,255,255,0.08)",
              style: 2,
              width: 1,
              labelBackgroundColor: "#2a2a2a",
            },
          },
          rightPriceScale: {
            borderColor: "rgba(255,255,255,0.08)",
          },
          timeScale: {
            borderColor: "rgba(255,255,255,0.08)",
            timeVisible: false,
          },
        }}
      >
        <Pane>
          <LineSeries
            data={lineData}
            options={{
              color: "#22c55e",
              lineWidth: 2,
              crosshairMarkerVisible: true,
              crosshairMarkerRadius: 4,
              priceFormat: {
                type: "custom",
                minMove: 1,
                formatter: (price: number) =>
                  price >= 1000
                    ? `${(price / 1000).toFixed(1)}k`
                    : String(price),
              },
            }}
          />
        </Pane>
        <TimeScale>
          <TimeScaleFitContentTrigger deps={[data]} />
        </TimeScale>
      </Chart>

      {tooltip && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "#1a1a2e",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: "0.8125rem",
            lineHeight: 1.6,
            color: "#e0e0e0",
            pointerEvents: "none",
            zIndex: 10,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {formatDateLabel(tooltip.date)}
          </div>
          <div>
            USDC:{" "}
            <span style={{ color: "#22c55e", fontWeight: 600 }}>
              {tooltip.usdcVolume.toLocaleString()}
            </span>
          </div>
          {tooltip.fiatVolume > 0 && (
            <div>
              Fiat:{" "}
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                {tooltip.fiatVolume.toLocaleString()} {tooltip.currency}
              </span>
            </div>
          )}
          <div>
            Completed:{" "}
            <span style={{ fontWeight: 600 }}>{tooltip.completedCount}</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 2 }}>
            {tooltip.currency}
          </div>
        </div>
      )}
    </div>
  );
}
