import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/invoices/StatusBadge"
import { formatCurrency, formatDate } from "@/lib/format"
import type { LineItem, InvoiceStatus } from "@/types/database"
import { InvoiceActions } from "@/components/invoices/InvoiceActions"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(name, email, phone, address)")
    .eq("id", id)
    .single()

  if (!invoice) notFound()

  const lineItems = (
    typeof invoice.line_items === "string"
      ? JSON.parse(invoice.line_items)
      : invoice.line_items
  ) as LineItem[]

  const client = invoice.clients as {
    name: string
    email: string | null
    phone: string | null
    address: string | null
  } | null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status as InvoiceStatus} />
          </div>
          <p className="text-muted-foreground">
            Created {formatDate(invoice.created_at)}
          </p>
        </div>
        <Button variant="outline" render={<Link href="/invoices" />}>
          Back to invoices
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bill to
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{client?.name ?? "—"}</p>
            {client?.email && (
              <p className="text-sm text-muted-foreground">{client.email}</p>
            )}
            {client?.phone && (
              <p className="text-sm text-muted-foreground">{client.phone}</p>
            )}
            {client?.address && (
              <p className="text-sm text-muted-foreground">{client.address}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due date</span>
              <span>
                {invoice.due_date ? formatDate(invoice.due_date) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment link</span>
              <span>
                {invoice.stripe_payment_link_url ? (
                  <a
                    href={invoice.stripe_payment_link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Active
                  </a>
                ) : (
                  "Not set up"
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          <div className="space-y-2 text-right">
            <div className="flex justify-end gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="w-28 font-medium">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-end gap-8">
              <span className="text-muted-foreground">GST (10%)</span>
              <span className="w-28 font-medium">
                {formatCurrency(invoice.gst)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-end gap-8 text-lg">
              <span className="font-semibold">Total</span>
              <span className="w-28 font-bold">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Created {formatDate(invoice.created_at)}</span>
            </div>
            {invoice.status !== "draft" && (
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Sent</span>
              </div>
            )}
            {invoice.paid_at && (
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Paid {formatDate(invoice.paid_at)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <InvoiceActions
        invoiceId={invoice.id}
        pdfPath={invoice.pdf_storage_path}
        status={invoice.status as InvoiceStatus}
      />
    </div>
  )
}
