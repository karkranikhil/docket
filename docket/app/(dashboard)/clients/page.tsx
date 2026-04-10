import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"

export default async function ClientsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: tradie } = await supabase
    .from("tradies")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!tradie) redirect("/signup")

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("tradie_id", tradie.id)
    .order("created_at", { ascending: false })

  const allClients = clients ?? []

  const { data: invoices } = await supabase
    .from("invoices")
    .select("client_id, total, status, created_at")
    .eq("tradie_id", tradie.id)

  const invoicesByClient = (invoices ?? []).reduce(
    (acc, inv) => {
      if (!inv.client_id) return acc
      if (!acc[inv.client_id]) {
        acc[inv.client_id] = { total: 0, outstanding: 0, lastDate: "" }
      }
      acc[inv.client_id].total += Number(inv.total)
      if (inv.status === "sent" || inv.status === "overdue") {
        acc[inv.client_id].outstanding += Number(inv.total)
      }
      if (inv.created_at > acc[inv.client_id].lastDate) {
        acc[inv.client_id].lastDate = inv.created_at
      }
      return acc
    },
    {} as Record<
      string,
      { total: number; outstanding: number; lastDate: string }
    >
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-muted-foreground">
          {allClients.length} clients from your invoice history
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Total invoiced</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Last invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allClients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-12 text-center text-muted-foreground"
                >
                  No clients yet. Clients are created automatically from your
                  invoices.
                </TableCell>
              </TableRow>
            ) : (
              allClients.map((client) => {
                const stats = invoicesByClient[client.id]
                return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-right">
                      {stats ? formatCurrency(stats.total) : "$0.00"}
                    </TableCell>
                    <TableCell className="text-right">
                      {stats ? formatCurrency(stats.outstanding) : "$0.00"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {stats?.lastDate ? formatDate(stats.lastDate) : "—"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
