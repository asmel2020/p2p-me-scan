import { useState } from "react";
import { DatePickerWithRange } from "@/components/date-picker-with-range";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export type RangeMode = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
  rangeMode: RangeMode;
  onRangeModeChange: (mode: RangeMode) => void;
  onApplyCustomRange?: (from: Date, to: Date) => void;
}

const modes: { value: RangeMode; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function RangeFilterModal({ rangeMode, onRangeModeChange, onApplyCustomRange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        style={{
          background: "var(--color-muted)",
          color: "var(--color-foreground)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "0.25rem 0.5rem",
          fontSize: "0.8125rem",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          lineHeight: 1.4,
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
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {rangeMode.charAt(0).toUpperCase() + rangeMode.slice(1)}
      </DialogTrigger>
      <DialogContent style={{ maxWidth: 320 }}>
        <DialogTitle>Filter by Range</DialogTitle>
        <DialogClose />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            marginTop: "0.5rem",
          }}
        >
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                onRangeModeChange(m.value);
                setOpen(false);
              }}
              style={{
                padding: "0.5rem",
                borderRadius: "var(--radius-lg)",
                border: `1px solid ${rangeMode === m.value ? "var(--color-primary)" : "var(--color-border)"}`,
                background:
                  rangeMode === m.value
                    ? "color-mix(in oklab, var(--color-primary) 15%, transparent)"
                    : "var(--color-muted)",
                color: "var(--color-foreground)",
                fontSize: "0.8125rem",
                fontWeight: rangeMode === m.value ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Separator />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "0.5rem",
          }}
        >
          <DatePickerWithRange
            onApply={(from, to) => {
              onApplyCustomRange?.(from, to);
              setOpen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
