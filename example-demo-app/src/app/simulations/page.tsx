"use client";

import { useState } from "react";
import { runSimulation, SimulationScenario } from "@/actions/simulation.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Globe, UserX, Bug, Play, Settings } from "lucide-react";
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
    description: "Simulate a login from Sydney then 10 minutes later from New York.",
    metadata: {
      location: "Sydney, AU",
      ip: "1.1.1.1",
      country_changed: 1,
      login_velocity: 8.5, // High velocity across distance
      device_known: 1
    }
  },
  {
    id: "brute_force",
    name: "Brute Force Attack",
    description: "Simulate 5 failed password attempts on the same account.",
    metadata: {
      failed_attempts: 5,
      ip_reputation_score: 0.8,
      location: "Global Data Center",
      device_known: 0
    }
  },
  {
    id: "malicious_ip",
    name: "Malicious IP Source",
    description: "Login from a known VPN, proxy, or data center IP address.",
    metadata: {
      ip: "45.1.2.3",
      ip_reputation_score: 0.1, // Very low reputation
      location: "Proxy Network",
      device: "Tor Browser",
      browser: "Tor Browser"
    }
  },
  {
    id: "device_hijack",
    name: "Device Hijacking",
    description: "Simulate a session from a suspicious/unrecognized user-agent.",
    metadata: {
      device_known: 0,
      browser: "Custom Bot v2",
      device: "Python-Requests/Simulation",
      asn_changed: 1
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
      toast.success(`Simulation Successful: Decision was ${res.decision?.type}`);
      setSelectedScenario(null);
    } else {
      toast.error(`Simulation failed: ${res.error}`);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-3">
          <Bug className="text-primary size-8" />
          Threat Command Center
        </h1>
        <p className="text-muted-foreground italic">
          Test AegisAuth by simulating real-world security threats in this sandbox environment. 
          Monitor the platform dashboard to see risk scores update in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="group hover:border-primary/50 transition-all border-border/50 bg-card/60 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {scenario.id === 'impossible_travel' && <Globe className="size-5 text-blue-500" />}
                  {scenario.id === 'brute_force' && <ShieldAlert className="size-5 text-red-500" />}
                  {scenario.id === 'malicious_ip' && <UserX className="size-5 text-orange-500" />}
                  {scenario.id === 'device_hijack' && <Bug className="size-5 text-primary" />}
                  {scenario.name}
                </CardTitle>
                <div className="size-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
              </div>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-secondary/50 p-3 text-[10px] font-mono">
                <p className="font-bold text-primary mb-1 uppercase tracking-widest">Metadata Payload:</p>
                <pre className="text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(scenario.metadata, null, 2)}
                </pre>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full gap-2 hover:bg-primary/5 rounded-xl"
                onClick={() => {
                  setSelectedScenario(scenario);
                  setCustomMetadata(JSON.stringify(scenario.metadata, null, 2));
                }}
              >
                <Settings className="size-4" />
                Configure Simulation
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Simulation Modal */}
      <Dialog open={!!selectedScenario} onOpenChange={(open) => !open && setSelectedScenario(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configure Threat Metadata</DialogTitle>
            <DialogDescription>
              Customize the "tainted" metadata that will be sent to the AegisAuth Backend for this simulation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              className="h-[200px] font-mono text-xs"
              value={customMetadata}
              onChange={(e) => setCustomMetadata(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedScenario(null)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSimulate} disabled={isLoading} className="gap-2 rounded-xl">
              <Play className="size-3.5" />
              {isLoading ? "Running Simulation..." : "Fire Simulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
