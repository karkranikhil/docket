"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "./StatusBadge"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Invoice, InvoiceStatus } from "@/types/database"

interface InvoiceListProps {
  invoices: Invoice[]
  tradieId: string
}

export function InvoiceList({
  invoices: initial,
  tradieId,
}: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initial)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("invoice-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
          filter: `tradie_id=eq.${tradieId}`,
        },
        (payload) => {
          const updated = payload.new as Invoice
          setInvoices((prev) => {
            const idx = prev.findIndex((inv) => inv.id === updated.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = updated
              return next
            }
            return [updated, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tradieId])

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-lg font-medium">No invoices yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a message on WhatsApp to create your first invoice
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
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
                {(invoice as Invoice & { client_name?: string }).client_name ??
                  "—"}
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
