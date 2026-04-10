import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    status?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email?.endsWith("@docket.com.au")) redirect("/dashboard")

  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("message_log")
    .select("*, tradies(business_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (params.status && params.status !== "all") {
    query = query.eq("processing_status", params.status)
  }

  const { data: messages, count } = await query

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">
          {count ?? 0} total messages in log
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tradie</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(messages ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  No messages found
                </TableCell>
              </TableRow>
            ) : (
              (messages ?? []).map((msg) => {
                const tradie = msg.tradies as { business_name: string } | null
                return (
                  <TableRow key={msg.id}>
                    <TableCell className="max-w-32 truncate">
                      {tradie?.business_name ?? msg.whatsapp_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{msg.direction}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {msg.message_type}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {msg.raw_content ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          msg.processing_status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {msg.processing_status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(msg.created_at)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <p className="text-center text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
      )}
    </div>
  )
}
