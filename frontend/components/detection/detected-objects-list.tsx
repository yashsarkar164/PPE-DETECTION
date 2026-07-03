import { cn } from "@/lib/utils";
import type { DetectedObject } from "@/lib/types";

function isViolationClass(className: string) {
  return /^no[-_ ]/i.test(className.trim());
}

export function DetectedObjectsList({ objects }: { objects: DetectedObject[] }) {
  if (objects.length === 0) {
    return <p className="text-sm text-graphite-500">No objects detected.</p>;
  }

  return (
    <ul className="space-y-2">
      {objects.map((obj, i) => {
        const violation = isViolationClass(obj.class);
        return (
          <li
            key={`${obj.class}-${i}`}
            className="flex items-center justify-between rounded-md border border-graphite-800 bg-graphite-900 px-3 py-2"
          >
            <span className={cn("text-sm font-medium", violation ? "text-safety-orange" : "text-white")}>
              {obj.class}
              {obj.occurrences != null && (
                <span className="ml-2 text-xs text-graphite-500">×{obj.occurrences}</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-graphite-800">
                <div
                  className={cn("h-full rounded-full", violation ? "bg-safety-orange" : "bg-safety-yellow")}
                  style={{ width: `${Math.round(obj.confidence * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-xs text-graphite-400">
                {(obj.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
