"use server";

import { login } from "@devanshthaware/aegis-auth";
import { revalidatePath } from "next/cache";

export type SimulationScenario = {
  id: string;
  name: string;
  description: string;
  metadata: any;
};

export async function runSimulation(scenario: SimulationScenario, customMetadata?: any) {
  try {
    console.log(`[Simulation] Running ${scenario.id}...`);
    
    // We use the login() function from the SDK to trigger the threat
    // This will hit the /auth/login endpoint of the ML backend
    const response = await login({
      email: "attacker@simulation.test", // Dedicated test email
      metadata: {
        ...scenario.metadata,
        ...customMetadata,
        isSimulation: true,
        timestamp: new Date().toISOString(),
      },
    });

    console.log("[Simulation] Response:", response);
    
    revalidatePath("/");
    return { success: true, decision: response.decision };
  } catch (error) {
    console.error("Simulation error:", error);
    return { success: false, error: "Failed to run simulation" };
  }
}
