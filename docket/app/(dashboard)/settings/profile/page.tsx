import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/settings/ProfileForm"
import type { Tradie } from "@/types/database"

export default async function SettingsProfilePage() {
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

  const invoiceResult = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("tradie_id", tradie.id)
  const hasInvoices = (invoiceResult.count ?? 0) > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your business details
        </p>
      </div>

      <ProfileForm tradie={tradie as Tradie} abnLocked={hasInvoices} />
    </div>
  )
}
