import { Badge } from "@/components/ui/badge";
import type { GprStatus } from "@/lib/types";

const config: Record<GprStatus, { label: string; variant: "warning" | "info" | "muted" | "success" }> = {
  unsigned: { label: "Unsigned", variant: "muted" },
  signed:   { label: "Signed",   variant: "info" },
  stamped:  { label: "Stamped",  variant: "warning" },
  upgraded: { label: "Confirmed",variant: "success" },
};

export function GprStatusBadge({ status }: { status: GprStatus }) {
  const { label, variant } = config[status] ?? { label: status, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}
