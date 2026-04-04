import { Navbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { Architecture } from "@/components/landing/architecture"
import { CTA } from "@/components/landing/cta"
import { Shield } from "lucide-react"
import { DitherBackground } from "@/components/landing/dither-background"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <DitherBackground />
      <div className="relative z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <Navbar />
          <main>
            <Hero />
            <div id="features">
              <Features />
            </div>
            <div id="architecture">
              <Architecture />
            </div>
            <div id="cta">
              <CTA />
            </div>
          </main>
          <footer className="border-t border-border/40 py-12">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="size-4" />
                <span className="text-sm">AegisAuth. Enterprise-grade adaptive security.</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {"Built for Zero Trust environments."}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
