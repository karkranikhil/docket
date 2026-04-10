import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"

export default async function PaymentsDonePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: tradie } = await supabase
    .from("tradies")
    .select("stripe_charges_enabled, stripe_payouts_enabled")
    .eq("user_id", user.id)
    .single()

  if (!tradie) redirect("/signup")

  const isActive =
    tradie.stripe_charges_enabled && tradie.stripe_payouts_enabled

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      {isActive ? (
        <Card className="w-full">
          <CardHeader className="items-center">
            <CheckCircle className="mb-2 h-12 w-12 text-green-500" />
            <CardTitle>Payments activated!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your clients can now pay invoices online. Money lands in your
              account within 2 business days.
            </p>
            <Button className="w-full" render={<Link href="/dashboard" />}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full">
          <CardHeader className="items-center">
            <CardTitle>Almost there</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your payment setup is being verified. This usually takes a few
              minutes. Check back shortly.
            </p>
            <Button
              variant="outline"
              className="w-full"
              render={<Link href="/settings/payments" />}
            >
              Back to payments
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
