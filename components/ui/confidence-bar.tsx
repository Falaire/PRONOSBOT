import { confidenceLabel } from "@/lib/utils";

export function ConfidenceBar({ value }: { value: number }) {
  const { label, color } = confidenceLabel(value);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={color}>{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
