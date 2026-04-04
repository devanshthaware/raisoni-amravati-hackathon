"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, ArrowRight, Play } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

export function Hero() {
  const stats = useQuery(api.sessions.getStats, {})

  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:py-36">
        <div className="flex flex-col items-center text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <Shield className="size-4" />
            <span>Zero-Trust Adaptive Authentication</span>
          </div>
          <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Authentication Should Not Be a Checkpoint{" "}
            <span className="text-primary">
              {"— It Should Be Continuous."}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground lg:text-xl">
            Zero-Trust. Context-Aware. Continuous Risk Intelligence. Protect every session, every action, in real time.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild className="gap-2 rounded-xl px-8">
              <Link href="/sign-up">
                Start Building Free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-8 text-center lg:gap-16">
            <div>
              <div className="text-2xl font-bold text-primary lg:text-3xl">
                {stats?.activeApps ?? "0"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Active Apps</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground lg:text-3xl">
                {stats?.totalSessions ?? "0"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Sessions Secured</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground lg:text-3xl">
                {stats?.highRiskAlerts ?? "0"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Threats Blocked</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
