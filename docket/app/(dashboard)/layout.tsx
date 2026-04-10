import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Separator } from "@/components/ui/separator"
import { SidebarNav } from "@/components/dashboard/SidebarNav"
import { MobileNav } from "@/components/dashboard/MobileNav"
import type { Tradie } from "@/types/database"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Link href="/dashboard" className="text-lg font-bold">
            Docket
          </Link>
        </div>
        <SidebarNav
          tradie={tradie as Tradie}
          subscriptionTier={tradie.subscription_tier}
        />
        <Separator />
        <div className="p-4">
          <p className="truncate text-sm font-medium">
            {tradie.business_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {tradie.email}
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-6 lg:hidden">
          <MobileNav
            tradie={tradie as Tradie}
            subscriptionTier={tradie.subscription_tier}
          />
          <Link href="/dashboard" className="text-lg font-bold">
            Docket
          </Link>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
