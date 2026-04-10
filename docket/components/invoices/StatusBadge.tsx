import { Badge } from "@/components/ui/badge"
import type { InvoiceStatus } from "@/types/database"

const statusConfig: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "outline" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
}

const statusColors: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  confirmed: "bg-blue-50 text-blue-700 hover:bg-blue-50",
  sent: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  paid: "bg-green-100 text-green-700 hover:bg-green-100",
  overdue: "bg-red-100 text-red-700 hover:bg-red-100",
  void: "bg-gray-100 text-gray-500 hover:bg-gray-100",
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className={statusColors[status]}>
      {config.label}
    </Badge>
  )
}
