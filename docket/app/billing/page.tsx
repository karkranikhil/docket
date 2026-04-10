import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Tradie } from "@/types/database"

export default async function BillingPage() {
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

  const t = tradie as Tradie

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current plan</CardTitle>
            <Badge
              variant={
                t.subscription_status === "active" ? "default" : "secondary"
              }
            >
              {t.subscription_status === "trialing"
                ? "Free trial"
                : t.subscription_status === "active"
                  ? t.subscription_tier === "pro"
                    ? "Pro"
                    : "Starter"
                  : t.subscription_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {t.subscription_status === "trialing" && t.trial_ends_at && (
            <p className="text-sm text-muted-foreground">
              Your free trial ends on{" "}
              {new Date(t.trial_ends_at).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {t.subscription_tier === "pro" ? "Pro" : "Starter"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.subscription_tier === "pro"
                    ? "$49/month — unlimited invoices + BAS export"
                    : "$19/month — up to 30 invoices"}
                </p>
              </div>
            </div>
          </div>

          {t.subscription_tier !== "pro" && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="font-medium">Upgrade to Pro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Unlimited invoices, online payments, BAS quarterly summary, and
                priority support.
              </p>
              <Button className="mt-3">Upgrade — $49/month</Button>
            </div>
          )}

          {t.stripe_customer_id && (
            <Button variant="outline" className="w-full">
              Manage billing
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
