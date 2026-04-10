import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/format"
import { RevenueChart } from "@/components/reports/RevenueChart"
import Link from "next/link"

function getQuarterDates(): { start: Date; end: Date; label: string } {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  // Australian BAS quarters: Jul-Sep (Q1), Oct-Dec (Q2), Jan-Mar (Q3), Apr-Jun (Q4)
  let qStart: Date
  let qEnd: Date
  let qLabel: string

  if (month >= 6 && month <= 8) {
    qStart = new Date(year, 6, 1)
    qEnd = new Date(year, 9, 0)
    qLabel = `Q1 FY${year}-${year + 1}`
  } else if (month >= 9 && month <= 11) {
    qStart = new Date(year, 9, 1)
    qEnd = new Date(year + 1, 0, 0)
    qLabel = `Q2 FY${year}-${year + 1}`
  } else if (month >= 0 && month <= 2) {
    qStart = new Date(year, 0, 1)
    qEnd = new Date(year, 3, 0)
    qLabel = `Q3 FY${year - 1}-${year}`
  } else {
    qStart = new Date(year, 3, 1)
    qEnd = new Date(year, 6, 0)
    qLabel = `Q4 FY${year - 1}-${year}`
  }

  return { start: qStart, end: qEnd, label: qLabel }
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: tradie } = await supabase
    .from("tradies")
    .select("id, subscription_tier")
    .eq("user_id", user.id)
    .single()

  if (!tradie) redirect("/signup")

  if (tradie.subscription_tier !== "pro") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Badge variant="secondary" className="mb-4 text-sm">
          Pro feature
        </Badge>
        <h1 className="text-2xl font-bold">Reports & BAS summary</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Upgrade to Pro to access BAS quarterly summaries, revenue charts, and
          PDF exports.
        </p>
        <Button className="mt-6" render={<Link href="/billing" />}>
          Upgrade to Pro — $49/month
        </Button>
      </div>
    )
  }

  const quarter = getQuarterDates()

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, gst, status, paid_at, created_at")
    .eq("tradie_id", tradie.id)
    .gte("created_at", quarter.start.toISOString())
    .lte("created_at", quarter.end.toISOString())

  const all = invoices ?? []
  const totalGst = all
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + Number(inv.gst), 0)
  const totalRevenue = all
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + Number(inv.total), 0)

  const { data: yearInvoices } = await supabase
    .from("invoices")
    .select("total, status, paid_at, created_at")
    .eq("tradie_id", tradie.id)
    .eq("status", "paid")
    .gte(
      "created_at",
      new Date(new Date().getFullYear(), 0, 1).toISOString()
    )

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const monthInvoices = (yearInvoices ?? []).filter((inv) => {
      const d = new Date(inv.paid_at ?? inv.created_at)
      return d.getMonth() === i
    })
    return {
      month: new Date(2024, i, 1).toLocaleString("en-AU", { month: "short" }),
      revenue: monthInvoices.reduce((s, inv) => s + Number(inv.total), 0),
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          BAS summary and revenue for {quarter.label}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              GST collected ({quarter.label})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalGst)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue ({quarter.label})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={monthlyData} />
        </CardContent>
      </Card>
    </div>
  )
}
