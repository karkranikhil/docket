import Link from "next/link"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/invoices/StatusBadge"
import { formatCurrency, formatDate } from "@/lib/format"
import type { InvoiceStatus } from "@/types/database"

const PAGE_SIZE = 20

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    client?: string
    page?: string
  }>
}) {
  const params = await searchParams
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

  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from("invoices")
    .select("*, clients(name)", { count: "exact" })
    .eq("tradie_id", tradie.id)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status)
  }

  const { data: invoices, count } = await query

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    if (params.status) p.set("status", params.status)
    if (params.client) p.set("client", params.client)
    if (params.page) p.set("page", params.page)
    Object.entries(overrides).forEach(([k, v]) => p.set(k, v))
    return `/invoices?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">
          {count ?? 0} total invoices
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="contents">
          <Select defaultValue={params.status ?? "all"}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search client..."
            defaultValue={params.client ?? ""}
            className="w-48"
          />
        </form>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invoices ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              (invoices ?? []).map((invoice) => {
                const clientData = invoice.clients as { name: string } | null
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {clientData?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status as InvoiceStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.due_date ? formatDate(invoice.due_date) : "—"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={buildUrl({ page: String(page - 1) })} />}
              >
                Previous
              </Button>
            )}
            {page < totalPages && (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={buildUrl({ page: String(page + 1) })} />}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
