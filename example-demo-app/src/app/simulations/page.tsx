"use client";

import { useState } from "react";
import { runSimulation, SimulationScenario } from "@/actions/simulation.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Globe, UserX, Bug, Play, Settings, Zap, History, ShieldHalf, LayoutDashboard } from "lucide-react";
import toast from "react-hot-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const scenarios: SimulationScenario[] = [
  {
    id: "impossible_travel",
    name: "Impossible Travel",
    description: "Multi-regional login anomaly where session origin shifts across continents in minutes.",
    metadata: {
      location: "Sydney, AU -> New York, US",
      ip: "103.22.201.5",
      country_changed: 1,
      login_velocity: 12.4, 
      device_known: 1,
      expected: "BLOCK / CHALLENGE"
    }
  },
  {
    id: "brute_force",
    name: "Pattern-Based Brute Force",
    description: "Rapid sequential authentication failures typical of automated credential stuffing.",
    metadata: {
      failed_attempts: 15,
      mfa_failures: 2,
      ip_reputation_score: 0.75,
      location: "Data Center (Frankfurt)",
      device_known: 0,
      expected: "BLOCK"
    }
  },
  {
    id: "malicious_ip",
    name: "Reputation Binary Attack",
    description: "Connection originating from a high-risk autonomous system or proxy network.",
    metadata: {
      ip: "185.244.111.3",
      ip_reputation_score: 0.05, 
      location: "Suspicious Proxy Hub",
      device: "Custom Scraper v4",
      browser: "Headless Chrome",
      asn_changed: 1,
      expected: "BLOCK"
    }
  },
  {
    id: "device_hijack",
    name: "Device & identity Hijack",
    description: "Unrecognized user-agent fingerprinting attempt on a known account.",
    metadata: {
      device_known: 0,
      browser: "Unknown Bot",
      device: "Python-Request/AegisSim",
      asn_changed: 1,
      login_hour: 3, // Unusual time
      expected: "CHALLENGE"
    }
  }
];

export default function SimulationsPage() {
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);
  const [customMetadata, setCustomMetadata] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSimulate = async () => {
    if (!selectedScenario) return;
    
    setIsLoading(true);
    let parsedMeta = {};
    try {
      if (customMetadata) {
        parsedMeta = JSON.parse(customMetadata);
      }
    } catch (e) {
      toast.error("Invalid JSON in custom metadata");
      setIsLoading(false);
      return;
    }

    const res = await runSimulation(selectedScenario, parsedMeta);
    if (res.success) {
      toast.success(`Simulation Successful: AegisAuth returned ${res.decision?.type}`);
      setSelectedScenario(null);
    } else {
      toast.error(`Simulation failed: ${res.error}`);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                <ShieldHalf className="text-primary size-6" />
            </div>
            <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
                    Threat Attack Command Center
                </h1>
                <p className="text-muted-foreground flex items-center gap-2 mt-1 italic">
                    <Zap className="size-3 text-warning" />
                    Simulate real-world security scenarios to validate AegisAuth's adaptive enforcement.
                </p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="group relative overflow-hidden border-border/50 bg-card/40 backdrop-blur-xl transition-all hover:border-primary/40 hover:shadow-[0_0_30px_rgba(var(--primary),0.05)]">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {scenario.id === 'impossible_travel' && <Globe className="size-24" />}
                {scenario.id === 'brute_force' && <ShieldAlert className="size-24" />}
                {scenario.id === 'malicious_ip' && <UserX className="size-24" />}
                {scenario.id === 'device_hijack' && <Bug className="size-24" />}
            </div>
            
            <CardHeader className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="size-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary/70">Scenario Vector</span>
                </div>
                <Badge variant="outline" className="rounded-full text-[10px] border-primary/20 bg-primary/5">Active Sandbox</Badge>
              </div>
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                {scenario.name}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-muted-foreground/80">{scenario.description}</CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="relative rounded-xl border border-border/50 bg-black/40 p-4 font-mono text-[11px] group-hover:border-primary/20 transition-colors">
                <div className="absolute top-2 right-2 flex gap-1">
                    <div className="size-2 rounded-full bg-red-500/50" />
                    <div className="size-2 rounded-full bg-yellow-500/50" />
                    <div className="size-2 rounded-full bg-green-500/50" />
                </div>
                <p className="text-primary/60 mb-2 border-b border-white/5 pb-2 uppercase tracking-widest text-[9px]">Simulated_Telemetry_Payload.json</p>
                <div className="max-h-[120px] overflow-hidden group-hover:overflow-auto transition-all">
                    <pre className="text-muted-foreground/90 whitespace-pre-wrap">
                    {JSON.stringify(scenario.metadata, null, 2)}
                    </pre>
                </div>
              </div>
            </CardContent>

            <CardFooter className="relative z-10 pt-4">
              <Button 
                variant="default" 
                className="w-full gap-2 rounded-xl h-11 bg-primary/5 border border-primary/20 hover:bg-primary/10 text-primary shadow-inner"
                onClick={() => {
                  setSelectedScenario(scenario);
                  setCustomMetadata(JSON.stringify(scenario.metadata, null, 2));
                }}
              >
                <Settings className="size-4" />
                Configure Response Vector
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-4">
              <History className="size-8 text-muted-foreground/50" />
              <div>
                  <h3 className="font-bold text-lg">Platform Synchronization</h3>
                  <p className="text-sm text-muted-foreground">All simulation events are transmitted via App ID and reflected in the AegisAuth dashboard.</p>
              </div>
          </div>
          <Button variant="outline" className="gap-2 rounded-xl" asChild>
              <a href="http://localhost:3000" target="_blank">
                <LayoutDashboard className="size-4" />
                Open Dashboard
              </a>
          </Button>
      </div>

      {/* Simulation Modal */}
      <Dialog open={!!selectedScenario} onOpenChange={(open) => !open && setSelectedScenario(null)}>
        <DialogContent className="sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-mono">Simulate: {selectedScenario?.name}</DialogTitle>
            <DialogDescription className="text-xs italic">
                Adjust the "tainted" telemetry parameters before transmission to AegisAuth's adaptive engine.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-xl border border-primary/10 bg-black/60 p-1">
                <Textarea
                className="h-[200px] font-mono text-xs border-none focus-visible:ring-0 resize-none bg-transparent"
                value={customMetadata}
                onChange={(e) => setCustomMetadata(e.target.value)}
                />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" className="rounded-xl" onClick={() => setSelectedScenario(null)} disabled={isLoading}>
              Abort
            </Button>
            <Button onClick={handleSimulate} disabled={isLoading} className="gap-2 rounded-xl px-10 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
              {isLoading ? (
                  <div className="flex items-center gap-2">
                        <div className="size-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Transmitting...
                  </div>
              ) : (
                  <>
                    <Play className="size-3.5 fill-current" />
                    Fire Simulation Vector
                  </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
    return (
        <span className={`px-2.5 py-0.5 text-xs font-semibold ${className} ${variant === 'outline' ? 'border rounded-full' : ''}`}>
            {children}
        </span>
    )
}
