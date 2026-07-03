import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "yellow" | "orange" | "neutral";
  sublabel?: string;
}

export function StatCard({ label, value, icon: Icon, accent = "neutral", sublabel }: StatCardProps) {
  return (
    <Card className="bg-graphite-900 border-graphite-800">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-white">{value}</p>
            {sublabel && <p className="mt-1 text-xs text-graphite-500">{sublabel}</p>}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md",
              accent === "yellow" && "bg-safety-yellow/15 text-safety-yellow",
              accent === "orange" && "bg-safety-orange/15 text-safety-orange",
              accent === "neutral" && "bg-graphite-800 text-graphite-300"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
