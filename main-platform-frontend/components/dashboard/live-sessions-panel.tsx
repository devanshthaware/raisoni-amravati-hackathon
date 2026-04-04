"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RiskBadge } from "@/components/dashboard/risk-badge"
import { Radio, Eye, Search, ArrowUpDown, X } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

type SessionStatus = "safe" | "suspicious" | "blocked" | "ACTIVE" | "CHALLENGED" | "RESTRICTED" | "BLOCKED" | string

type SortField = "user" | "riskScore" | "status" | null
type SortDir = "asc" | "desc"

export function LiveSessionsPanel({ applicationId }: { applicationId?: Id<"applications"> }) {
  const sessionsList = useQuery(api.sessions.list, { applicationId: applicationId ?? undefined })
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all")
  const [detailSession, setDetailSession] = useState<any | null>(null)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => {
    if (!sessionsList) return []
    let data = [...sessionsList]
    if (statusFilter !== "all" && statusFilter !== "safe" && statusFilter !== "suspicious" && statusFilter !== "blocked") {
      data = data.filter((s) => s.state === statusFilter)
    } else if (statusFilter === "safe") {
      data = data.filter((s) => (s.score ?? 0) <= 0.3)
    } else if (statusFilter === "suspicious") {
      data = data.filter((s) => (s.score ?? 0) > 0.3 && (s.score ?? 0) < 0.8)
    } else if (statusFilter === "blocked") {
      data = data.filter((s) => (s.score ?? 0) >= 0.8 || s.state === "BLOCKED")
    }

    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (s) =>
          (s.userEmail || "").toLowerCase().includes(q) ||
          (s.location || "").toLowerCase().includes(q) ||
          (s.ip || "").includes(q) ||
          (s.device || "").toLowerCase().includes(q)
      )
    }
    if (sortField) {
      data.sort((a, b) => {
        let cmp = 0
        if (sortField === "user") cmp = (a.userEmail || "").localeCompare(b.userEmail || "")
        else if (sortField === "riskScore") cmp = (a.score ?? 0) - (b.score ?? 0)
        else if (sortField === "status") cmp = (a.state || "").localeCompare(b.state || "")
        return sortDir === "desc" ? -cmp : cmp
      })
    }
    return data as any[]
  }, [sessionsList, search, sortField, sortDir, statusFilter])

  const safeCount = sessionsList?.filter((s: any) => (s.score ?? 0) <= 0.3).length || 0
  const suspiciousCount = sessionsList?.filter((s: any) => (s.score ?? 0) > 0.3 && (s.score ?? 0) < 0.8).length || 0
  const blockedCount = sessionsList?.filter((s: any) => (s.score ?? 0) >= 0.8 || s.state === "BLOCKED").length || 0

  if (!sessionsList) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
        <p className="animate-pulse text-sm">Loading application sessions...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Live Sessions</h2>
          <p className="text-sm text-muted-foreground">Monitor active sessions and risk scores in real time.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-success">
          <Radio className="size-4 animate-pulse" />
          <span>Live Monitoring</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button onClick={() => setStatusFilter(statusFilter === "safe" ? "all" : "safe")} className="text-left w-full h-full block">
          <Card className={`rounded-xl border-border/50 bg-card transition-colors h-full ${statusFilter === "safe" ? "ring-2 ring-success/50" : "hover:border-success/30"}`}>
            <CardContent className="flex items-center justify-between pt-6 h-full">
              <div>
                <p className="text-sm text-muted-foreground">Safe Sessions</p>
                <p className="text-2xl font-bold text-success">{safeCount}</p>
              </div>
              <div className="size-3 rounded-full bg-success/20 ring-4 ring-success/10" />
            </CardContent>
          </Card>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === "suspicious" ? "all" : "suspicious")} className="text-left w-full h-full block">
          <Card className={`rounded-xl border-border/50 bg-card transition-colors h-full ${statusFilter === "suspicious" ? "ring-2 ring-warning/50" : "hover:border-warning/30"}`}>
            <CardContent className="flex items-center justify-between pt-6 h-full">
              <div>
                <p className="text-sm text-muted-foreground">Suspicious</p>
                <p className="text-2xl font-bold text-warning">{suspiciousCount}</p>
              </div>
              <div className="size-3 rounded-full bg-warning/20 ring-4 ring-warning/10" />
            </CardContent>
          </Card>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === "blocked" ? "all" : "blocked")} className="text-left w-full h-full block">
          <Card className={`rounded-xl border-border/50 bg-card transition-colors h-full ${statusFilter === "blocked" ? "ring-2 ring-destructive/50" : "hover:border-destructive/30"}`}>
            <CardContent className="flex items-center justify-between pt-6 h-full">
              <div>
                <p className="text-sm text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
              </div>
              <div className="size-3 rounded-full bg-destructive/20 ring-4 ring-destructive/10" />
            </CardContent>
          </Card>
        </button>
      </div>

      <Card className="rounded-xl border-border/50 bg-card min-h-[500px] flex flex-col">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Active Sessions</CardTitle>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-secondary/50 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>
                  <Button variant="ghost" size="sm" className="gap-1 -ml-3 text-muted-foreground hover:text-foreground" onClick={() => toggleSort("user")}>
                    User <ArrowUpDown className="size-3" />
                  </Button>
                </TableHead>
                <TableHead>Device</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="gap-1 -ml-3 text-muted-foreground hover:text-foreground" onClick={() => toggleSort("riskScore")}>
                    Risk Score <ArrowUpDown className="size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="gap-1 -ml-3 text-muted-foreground hover:text-foreground" onClick={() => toggleSort("status")}>
                    Status <ArrowUpDown className="size-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-[450px] text-center text-muted-foreground align-middle">
                    <div className="flex flex-col items-center justify-center">
                      <p className="mb-2 text-base text-foreground font-medium">No sessions found</p>
                      <p className="text-sm max-w-sm">There are no matching sessions for this application in the last 24h. Connect an application to start streaming live telemetry data.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((session) => (
                  <TableRow key={session._id} className="border-border/30">
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="font-medium text-foreground">{session.userEmail || "Anonymous"}</span>
                         <span className="text-xs text-muted-foreground">{session.ip || "Unknown IP"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{session.device || "Unknown Device"}</span>
                        <span className="text-xs text-muted-foreground">{session.browser || "Unknown Browser"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{session.location || "Unknown Location"}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-medium">{session.score ?? 0}</span>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={(session.score ?? 0) >= 0.8 || session.state === "BLOCKED" ? "blocked" : (session.score ?? 0) > 0.3 ? "suspicious" : "safe"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setDetailSession(session)}
                      >
                        <Eye className="size-4" />
                        <span className="sr-only">View session details</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Session Detail Dialog */}
      <Dialog open={!!detailSession} onOpenChange={(open) => !open && setDetailSession(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Session Metadata</DialogTitle>
          </DialogHeader>
          {detailSession && (
            <div className="flex flex-col gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">User Email</span>
                  <span className="text-sm font-medium">{detailSession.userEmail || "Anonymous"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">IP Address</span>
                  <span className="text-sm font-mono">{detailSession.ip || "Unknown"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Device</span>
                  <span className="text-sm">{detailSession.device || "Unknown"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Browser</span>
                  <span className="text-sm">{detailSession.browser || "Unknown"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Location</span>
                  <span className="text-sm">{detailSession.location || "Unknown"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Login Time</span>
                  <span className="text-sm font-mono">{new Date(detailSession.loginTime || Date.now()).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/30 p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Real-Time Risk Score</span>
                  <span className="text-2xl font-bold font-mono">{detailSession.score ?? 0}</span>
                </div>
                <RiskBadge level={(detailSession.score ?? 0) >= 0.8 || detailSession.state === "BLOCKED" ? "blocked" : (detailSession.score ?? 0) > 0.3 ? "suspicious" : "safe"} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
