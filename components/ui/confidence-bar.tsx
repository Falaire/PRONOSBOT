import { confidenceLabel } from "@/lib/utils";

export function ConfidenceBar({ value }: { value: number }) {
  const { label, color } = confidenceLabel(value);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className={color}>{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden ring-1 ring-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500 shadow-[0_0_8px_rgba(24,184,98,0.6)] transition-[width] duration-700 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
