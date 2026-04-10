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
import { Badge } from "@/components/ui/badge"
import { formatDate, formatPhone } from "@/lib/format"

export default async function AdminTradiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email?.endsWith("@docket.com.au")) redirect("/dashboard")

  const { data: tradies } = await supabase
    .from("tradies")
    .select("*")
    .order("created_at", { ascending: false })

  const allTradies = tradies ?? []

  const invoiceCounts: Record<string, number> = {}
  for (const t of allTradies) {
    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("tradie_id", t.id)
    invoiceCounts[t.id] = count ?? 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tradies</h1>
        <p className="text-muted-foreground">
          {allTradies.length} registered accounts
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Invoices</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTradies.map((tradie) => (
              <TableRow key={tradie.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{tradie.business_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tradie.email}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatPhone(tradie.whatsapp_number)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      tradie.subscription_status === "active"
                        ? "default"
                        : tradie.subscription_status === "trialing"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {tradie.subscription_status}
                  </Badge>
                </TableCell>
                <TableCell>{invoiceCounts[tradie.id] ?? 0}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(tradie.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
