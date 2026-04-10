import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PaymentsSetup } from "@/components/settings/PaymentsSetup"
import type { Tradie } from "@/types/database"

export default async function PaymentsPage() {
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

  const isActive =
    tradie.stripe_charges_enabled && tradie.stripe_payouts_enabled
  const isPending =
    tradie.stripe_account_id && !isActive
  const isNotSetup = !tradie.stripe_account_id

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          Let your clients pay invoices online
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment status</CardTitle>
            {isActive && (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                Active
              </Badge>
            )}
            {isPending && <Badge variant="secondary">Pending</Badge>}
            {isNotSetup && <Badge variant="outline">Not set up</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {isActive && (
            <p className="text-sm text-muted-foreground">
              Your clients can pay invoices online. Money lands in your account
              within 2 business days.
            </p>
          )}
          {isPending && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You&apos;ve started setting up payments but haven&apos;t
                finished. Complete the setup to let clients pay online.
              </p>
              <PaymentsSetup mode="complete" />
            </div>
          )}
          {isNotSetup && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add a bank account so clients can pay your invoices online.
                Takes 2 minutes. Money lands in your account within 2 business
                days.
              </p>
              <PaymentsSetup mode="setup" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
