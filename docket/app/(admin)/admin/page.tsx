import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MetricCard } from "@/components/dashboard/MetricCard"

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!user.email?.endsWith("@docket.com.au")) redirect("/dashboard")

  const { count: totalTradies } = await supabase
    .from("tradies")
    .select("*", { count: "exact", head: true })

  const { count: activeSubs } = await supabase
    .from("tradies")
    .select("*", { count: "exact", head: true })
    .eq("subscription_status", "active")

  const { count: trialing } = await supabase
    .from("tradies")
    .select("*", { count: "exact", head: true })
    .eq("subscription_status", "trialing")

  const { count: canceled } = await supabase
    .from("tradies")
    .select("*", { count: "exact", head: true })
    .eq("subscription_status", "canceled")

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: signupsToday } = await supabase
    .from("tradies")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today.toISOString())

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: signupsWeek } = await supabase
    .from("tradies")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString())

  const starterCount = (activeSubs ?? 0)
  const proActive = await supabase
    .from("tradies")
    .select("*", { count: "exact", head: true })
    .eq("subscription_status", "active")
    .eq("subscription_tier", "pro")

  const mrr =
    ((starterCount - (proActive.count ?? 0)) * 19) +
    ((proActive.count ?? 0) * 49)

  const total = totalTradies ?? 0
  const churnRate = total > 0 ? (((canceled ?? 0) / total) * 100).toFixed(1) : "0"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted-foreground">Docket platform metrics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="MRR" value={`$${mrr.toLocaleString()}`} />
        <MetricCard
          label="Active subscribers"
          value={String(activeSubs ?? 0)}
        />
        <MetricCard label="Trialing" value={String(trialing ?? 0)} />
        <MetricCard label="Churn rate" value={`${churnRate}%`} />
        <MetricCard
          label="Signups today"
          value={String(signupsToday ?? 0)}
        />
        <MetricCard
          label="Signups this week"
          value={String(signupsWeek ?? 0)}
        />
      </div>
    </div>
  )
}
