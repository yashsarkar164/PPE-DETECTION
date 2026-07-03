import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViolationCardProps {
  missingPpe: string[];
  confidence?: number | null;
  className?: string;
}

/** The "⚠ PPE Violation Detected" warning card, per spec. */
export function ViolationCard({ missingPpe, confidence, className }: ViolationCardProps) {
  if (missingPpe.length === 0) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-safety-orange/50 bg-safety-orange/10 p-4",
        className
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-safety-orange" />
      <div className="flex items-start gap-3 pl-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-safety-orange animate-pulse-warn" />
        <div className="flex-1">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-safety-orange">
            PPE Violation Detected
          </p>
          <p className="mt-1 text-xs font-medium text-graphite-300">Missing PPE:</p>
          <ul className="mt-1 space-y-0.5">
            {missingPpe.map((item) => (
              <li key={item} className="text-sm text-white">
                • {item}
              </li>
            ))}
          </ul>
          {confidence != null && (
            <p className="mt-2 text-xs text-graphite-400">
              Confidence: <span className="font-mono text-safety-orange">{(confidence * 100).toFixed(1)}%</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
