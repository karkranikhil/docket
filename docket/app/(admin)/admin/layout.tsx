import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tradies", label: "Tradies" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/failures", label: "Failures" },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")
  if (!user.email?.endsWith("@docket.com.au")) redirect("/dashboard")

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
          <Link href="/admin" className="text-lg font-bold">
            Docket Admin
          </Link>
          <nav className="flex gap-4">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
