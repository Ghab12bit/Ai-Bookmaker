"use client";

import { cn } from "@/lib/utils";

interface PinDotProps {
  number: number;
  x: number;
  y: number;
  resolved: boolean;
  active: boolean;
  onClick: () => void;
}

export function PinDot({ number, x, y, resolved, active, onClick }: PinDotProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold transition-all z-10 shadow-sm",
        resolved
          ? "bg-neutral-300 text-neutral-500 opacity-60"
          : active
          ? "bg-neutral-900 text-white ring-2 ring-neutral-900 ring-offset-2"
          : "bg-neutral-800 text-white hover:bg-neutral-900"
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {number}
    </button>
  );
}
