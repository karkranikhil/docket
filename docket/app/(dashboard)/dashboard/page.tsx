import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { InvoiceList } from "@/components/invoices/InvoiceList"
import { formatCurrency } from "@/lib/format"
import type { Invoice } from "@/types/database"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: tradie } = await supabase
    .from("tradies")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!tradie) redirect("/signup")

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("tradie_id", tradie.id)
    .order("created_at", { ascending: false })
    .limit(20)

  const allInvoices = (invoices ?? []) as Invoice[]

  const outstanding = allInvoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + Number(inv.total), 0)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const collectedThisMonth = allInvoices
    .filter(
      (inv) => inv.status === "paid" && inv.paid_at && new Date(inv.paid_at) >= startOfMonth
    )
    .reduce((sum, inv) => sum + Number(inv.total), 0)

  const invoicesThisMonth = allInvoices.filter(
    (inv) => new Date(inv.created_at) >= startOfMonth
  ).length

  return (
    <div className="space-y-8">
      {params.onboarding === "true" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-medium text-green-800">
            Welcome to Docket! Send a WhatsApp message to create your first
            invoice.
          </p>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your invoices
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          change="Unpaid invoices"
        />
        <MetricCard
          label="Collected this month"
          value={formatCurrency(collectedThisMonth)}
          changeType="positive"
        />
        <MetricCard
          label="Invoices this month"
          value={String(invoicesThisMonth)}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent invoices</h2>
        <InvoiceList invoices={allInvoices} tradieId={tradie.id} />
      </div>
    </div>
  )
}
