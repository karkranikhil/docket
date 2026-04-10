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
import { MarkResolved } from "@/components/admin/MarkResolved"

export default async function AdminFailuresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email?.endsWith("@docket.com.au")) redirect("/dashboard")

  const { data: failures } = await supabase
    .from("message_log")
    .select("*, tradies(business_name, email)")
    .or("processing_status.eq.failed,processing_status.eq.low_confidence")
    .order("created_at", { ascending: false })
    .limit(100)

  const allFailures = failures ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parse failures</h1>
        <p className="text-muted-foreground">
          {allFailures.length} failed or low-confidence messages
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tradie</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allFailures.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  No failures — everything is working
                </TableCell>
              </TableRow>
            ) : (
              allFailures.map((msg) => {
                const tradie = msg.tradies as {
                  business_name: string
                  email: string
                } | null
                return (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {tradie?.business_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tradie?.email ?? msg.whatsapp_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm">
                        {msg.raw_content ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm text-destructive">
                        {msg.error_details ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {msg.processing_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(msg.created_at)}
                    </TableCell>
                    <TableCell>
                      <MarkResolved messageId={msg.id} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
