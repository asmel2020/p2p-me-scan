import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders, fetchOrder } from "./api/orders";
import { useStats } from "./hooks/useStats";
import { OrdersTable } from "./components/orders-table";
import { OrderModal } from "./components/order-modal";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectIcon,
} from "@/components/ui/select";
import { RootLayout } from "@/components/root-layout";
import { DatePickerWithRange } from "@/components/date-picker-with-range";
import type { Order } from "./types";

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--color-muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function OrdersPage() {
  const { cursor, limit, orderId: urlOrderId } = useSearch({ from: "/" });
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const cursorHistory = useRef<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const initialOrderId = useRef(urlOrderId);

  useEffect(() => {
    const id = initialOrderId.current;
    if (id) {
      initialOrderId.current = undefined;
      navigate({ to: "/", search: { cursor, limit }, replace: true });
      fetchOrder(id)
        .then((order) => {
          setSelectedOrder({
            id: order.id,
            orderId: order.orderId,
            user: order.user,
            merchant: order.merchant,
            recipientAddr: order.recipientAddr,
            acceptedMerchant: order.acceptedMerchant,
            usdc: order.usdc,
            fiat: order.fiat,
            orderType: order.orderType,
            currency: order.currency,
            status: order.status,
            createdBlock: order.createdBlock,
            updatedBlock: order.updatedBlock,
            blockTimestamp: order.blockTimestamp,
            blockTimestampUnix: order.blockTimestampUnix,
            updatedAt: order.updatedAt,
          });
        })
        .catch(() => {});
    }
  }, []);

  const goToPage = useCallback(
    (newCursor: string | undefined) => {
      navigate({
        to: "/",
        search: { cursor: newCursor, limit },
        replace: false,
      });
    },
    [navigate, limit],
  );

  function toLocalDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const queryParams = {
    limit,
    cursor: cursor || undefined,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { orderType: typeFilter } : {}),
    ...(currencyFilter ? { currency: currencyFilter } : {}),
    ...(dateRange
      ? { fromDate: toLocalDateStr(dateRange.from), toDate: toLocalDateStr(dateRange.to) }
      : {}),
  };

  const { data, isFetching } = useQuery({
    queryKey: [
      "orders-page",
      cursor,
      limit,
      statusFilter,
      typeFilter,
      currencyFilter,
      dateRange,
    ],
    queryFn: async () => {
      const result = await fetchOrders(queryParams);
      return result;
    },
  });

  useEffect(() => {
    if (data) {
      setNextCursor(data.nextCursor);
    }
  }, [data]);

  const orders = data?.data ?? [];
  const hasPrev = cursorHistory.current.length > 0;
  const hasNext = !!nextCursor;
  const currentPage = cursorHistory.current.length + 1;

  const { data: stats } = useStats({
    ...(currencyFilter ? { currency: currencyFilter } : {}),
    ...(dateRange
      ? { fromDate: toLocalDateStr(dateRange.from), toDate: toLocalDateStr(dateRange.to) }
      : {}),
  });
  const totalUsdc =
    stats?.byCurrency.reduce((sum, c) => sum + c.totalUsdc, 0) ?? 0;

  const handleStatusChange = (value: string | null) => {
    setStatusFilter(value ?? "");
    cursorHistory.current = [];
    goToPage(undefined);
  };

  const handleTypeChange = (value: string | null) => {
    setTypeFilter(value ?? "");
    cursorHistory.current = [];
    goToPage(undefined);
  };

  const handleCurrencyChange = (value: string | null) => {
    setCurrencyFilter(value ?? "");
    cursorHistory.current = [];
    goToPage(undefined);
  };

  const handleDateRangeChange = (from: Date, to: Date) => {
    setDateRange({ from, to });
    cursorHistory.current = [];
    goToPage(undefined);
  };

  const handleLimitChange = (value: string | null) => {
    const n = Number(value) || 25;
    cursorHistory.current = [];
    navigate({
      to: "/",
      search: { cursor: undefined, limit: n },
      replace: false,
    });
  };

  const handleNext = () => {
    if (nextCursor) {
      cursorHistory.current.push(cursor || "");
      goToPage(nextCursor);
    }
  };

  const handlePrev = () => {
    const prev = cursorHistory.current.pop();
    goToPage(prev || undefined);
  };

  const currencies = [
    { code: "INR", label: "Indian Rupee" },
    { code: "VEN", label: "Venezuelan Bolívar" },
    { code: "USD", label: "US Dollar" },
    { code: "EUR", label: "Euro" },
    { code: "ARS", label: "Argentine Peso" },
    { code: "BRL", label: "Brazilian Real" },
    { code: "COP", label: "Colombian Peso" },
    { code: "MEX", label: "Mexican Peso" },
    { code: "IDR", label: "Indonesian Rupiah" },
    { code: "NGN", label: "Nigerian Naira" },
    { code: "ECU", label: "Ecuadorian Sucre" },
  ];

  const pageSizes = [10, 25, 50, 100];

  return (
    <RootLayout>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}
        >
          Orders
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-muted-foreground)",
            margin: 0,
          }}
        >
          Track P2P orders on Base
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="stat-card">
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-muted-foreground)",
              marginBottom: "0.25rem",
            }}
          >
            Total Orders
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {stats?.orders.toLocaleString() ?? "—"}
          </div>
        </div>
        <div className="stat-card">
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-muted-foreground)",
              marginBottom: "0.25rem",
            }}
          >
            USDC Volume
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {totalUsdc ? `${totalUsdc.toLocaleString()} USDC` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-muted-foreground)",
              marginBottom: "0.25rem",
            }}
          >
            Active Orders
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {stats
              ? stats.byStatus
                  .filter(
                    (s) => s.status !== "completed" && s.status !== "cancelled",
                  )
                  .reduce((sum, s) => sum + s.total, 0)
                  .toLocaleString()
              : "—"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <FilterGroup label="Status">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
              <SelectIcon />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="placed">Placed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </FilterGroup>

        <FilterGroup label="Type">
          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
              <SelectIcon />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="BUY">Buy</SelectItem>
              <SelectItem value="SELL">Sell</SelectItem>
              <SelectItem value="RENT">Rent</SelectItem>
            </SelectContent>
          </Select>
        </FilterGroup>

        <FilterGroup label="Currency">
          <Select value={currencyFilter} onValueChange={handleCurrencyChange}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
              <SelectIcon />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {currencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterGroup>

        <FilterGroup label="Per page">
          <Select value={String(limit)} onValueChange={handleLimitChange}>
            <SelectTrigger>
              <SelectValue placeholder={String(limit)} />
              <SelectIcon />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterGroup>

        <FilterGroup label="Date">
          <DatePickerWithRange onApply={handleDateRangeChange} />
        </FilterGroup>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-muted-foreground)",
          }}
        >
          {!isFetching && orders.length > 0 && (
            <span>
              Page {currentPage} · {orders.length} orders
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={handlePrev}
            disabled={!hasPrev || isFetching}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              color: hasPrev
                ? "var(--color-foreground)"
                : "var(--color-muted-foreground)",
              fontWeight: 500,
              fontSize: "0.8125rem",
              cursor: hasPrev && !isFetching ? "pointer" : "not-allowed",
              opacity: hasPrev ? 1 : 0.4,
              transition: "all 0.15s",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 12H5m7 7l-7-7 7-7"
              />
            </svg>
            Prev
          </button>
          <button
            onClick={handleNext}
            disabled={!hasNext || isFetching}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              color: hasNext
                ? "var(--color-foreground)"
                : "var(--color-muted-foreground)",
              fontWeight: 500,
              fontSize: "0.8125rem",
              cursor: hasNext && !isFetching ? "pointer" : "not-allowed",
              opacity: hasNext ? 1 : 0.4,
              transition: "all 0.15s",
            }}
          >
            Next
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14m-7-7l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      <OrdersTable
        orders={orders}
        onOrderClick={setSelectedOrder}
        isLoading={isFetching}
      />

      <OrderModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </RootLayout>
  );
}
