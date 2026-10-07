import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(value: string): { year: number; month: number } {
  const [y = NaN, m = NaN] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: y > 0 ? y : now.getFullYear(),
    month: m >= 1 && m <= 12 ? m : now.getMonth() + 1,
  };
}

function label(value: string) {
  const { year, month } = parse(value);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/**
 * Pick a month from a calendar grid instead of typing it.
 * `value` and `onChange` use "YYYY-MM", the same format as `<input type="month">`.
 */
export function MonthPicker({
  value,
  onChange,
  className,
  contentClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** e.g. a higher z-index when used inside a custom modal. */
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [viewYear, setViewYear] = useState(selected.year);
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const pick = (month: number) => {
    onChange(`${viewYear}-${String(month).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setViewYear(selected.year);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-44 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            className,
          )}
          aria-label="Choose month"
        >
          <CalendarDays className="size-4 shrink-0 text-primary" />
          <span className="flex-1 truncate text-left">{label(value)}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-64 p-3", contentClassName)}>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            className="flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Previous year"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-black text-slate-900">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            className="flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Next year"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((name, index) => {
            const month = index + 1;
            const isSelected = viewYear === selected.year && month === selected.month;
            const isCurrent = viewYear === thisYear && month === thisMonth;
            return (
              <button
                key={name}
                type="button"
                onClick={() => pick(month)}
                className={cn(
                  "h-9 rounded-md text-sm font-semibold transition",
                  isSelected
                    ? "bg-gradient-to-r from-primary to-orange-600 text-white shadow"
                    : isCurrent
                      ? "border border-primary/40 text-primary hover:bg-orange-50"
                      : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(`${thisYear}-${String(thisMonth).padStart(2, "0")}`);
            setOpen(false);
          }}
          className="mt-3 w-full rounded-md py-1.5 text-xs font-bold text-primary hover:bg-orange-50"
        >
          This month
        </button>
      </PopoverContent>
    </Popover>
  );
}
