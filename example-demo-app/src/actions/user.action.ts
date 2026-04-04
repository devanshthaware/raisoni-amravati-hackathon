"use server";

import prisma from "@/lib/prisma";
import "@/lib/aegis"; // Import to ensure AegisAuth is initialized on the server
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs"; 
import { getCurrentUser, logout, signup, login, setTracking } from "@devanshthaware/aegis-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

interface AegisUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * Syncs the AegisAuth user with our Prisma database.
 * If user doesn't exist, it creates one.
 */
export async function syncAegisUser(aegisUser: AegisUser) {
  if (!aegisUser) return null;

  try {
    const user = await (prisma as any).user.upsert({
      where: { email: aegisUser.email },
      update: {
        name: aegisUser.name,
      },
      create: {
        email: aegisUser.email,
        username: aegisUser.email.split("@")[0], // Fallback username
        name: aegisUser.name,
        passwordHash: "", // Placeholder for externally managed users
      },
    });

    return user;
  } catch (error) {
    console.error("Error in syncAegisUser:", error);
    return null;
  }
}

/**
 * Returns the current authenticated user's database ID.
 * Resolves from AegisAuth session.
 */
export async function getDbUserId(): Promise<string | null> {
  try {
    // 1. Check for manual override (dev only)
    const envUserId = process.env.CURRENT_USER_ID;
    if (envUserId) return envUserId;

    // 2. Restore AegisAuth session from cookies
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("aegis_session_id")?.value;
    const correlationId = cookieStore.get("aegis_correlation_id")?.value;

    if (sessionId) {
      setTracking(sessionId, correlationId || "restored");
    }

    // 3. Get user from AegisAuth SDK
    const aegisUser = await getCurrentUser();
    if (!aegisUser) return null;

    // 4. Find user in Prisma
    const user = await prisma.user.findUnique({
      where: { email: aegisUser.email },
      select: { id: true },
    });

    return user?.id || null;
  } catch (error) {
    console.error("Error in getDbUserId:", error);
    return null;
  }
}

/**
 * User Registration (Security Optimized)
 */
export async function registerUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const username = formData.get("username") as string;

  if (!email || !password) return { success: false, error: "Email and password are required" };

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return { success: false, error: "User already exists" };

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await (prisma as any).user.create({
      data: {
        email,
        username: username || email.split("@")[0],
        name: name,
        passwordHash,
      },
    });

    // Call AegisAuth SDK to track signup and return initial decision
    const aegisResponse = await signup({
      email,
      name: name || undefined,
      metadata: { username }
    });

    console.log("Aegis signup response:", aegisResponse);

    // Store session in cookies for persistence
    const cookieStore = await cookies();
    if (aegisResponse.sessionId) {
      cookieStore.set("aegis_session_id", aegisResponse.sessionId, { httpOnly: true, secure: true });
      if (aegisResponse.correlationId) {
        cookieStore.set("aegis_correlation_id", aegisResponse.correlationId, { httpOnly: true, secure: true });
      }
    }

    return { success: true, user: { id: user.id, email: user.email } };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Failed to register user" };
  }
}

/**
 * User Login with Real-time Risk Tracking (Step 6 of guide)
 */
export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { success: false, error: "Missing fields" };

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(user as any).passwordHash) {
      return { success: false, error: "Invalid credentials" };
    }

    const valid = await bcrypt.compare(password, (user as any).passwordHash);

    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    let status: "SUCCESS" | "FAILED" | "BLOCKED" = "SUCCESS";

    if (!valid) {
      riskLevel = "HIGH";
      status = "FAILED";
    }

    // Logic for Security Alert (Step 7)
    if (status === "FAILED") {
      await (prisma as any).securityAlert.create({
        data: {
          userId: user.id,
          type: "SUSPICIOUS_LOGIN",
          severity: "MEDIUM",
          message: `Failed login attempt for account ${email}`,
        },
      });
    }

    // Store Login History (Step 6)
    await (prisma as any).loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: "127.0.0.1", // In production use request headers
        device: "Web Browser",
        location: "India",
        status,
        riskLevel,
      },
    });

    if (!valid) return { success: false, error: "Invalid credentials" };

    // Call AegisAuth SDK to track login and get risk decision
    const aegisResponse = await login({
      email,
      metadata: { timestamp: new Date().toISOString() }
    });

    console.log("Aegis login response:", aegisResponse);

    // Store session in cookies for persistence
    const cookieStore = await cookies();
    if (aegisResponse.sessionId) {
      cookieStore.set("aegis_session_id", aegisResponse.sessionId, { httpOnly: true, secure: true });
      if (aegisResponse.correlationId) {
        cookieStore.set("aegis_correlation_id", aegisResponse.correlationId, { httpOnly: true, secure: true });
      }
    }

    // In a real app, you'd set a session cookie here.
    // For this demo, we'll assume the client handles the session via AegisAuth SDK.
    
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Logout the user (AegisAuth session termination)
 */
export async function logoutUser() {
  try {
    await logout();
    const cookieStore = await cookies();
    cookieStore.delete("aegis_session_id");
    cookieStore.delete("aegis_correlation_id");
  } catch (error) {
    console.error("Logout error:", error);
  }
  revalidatePath("/");
  redirect("/login");
}

export async function getRandomUsers() {
  try {
    const userId = await getDbUserId();
    if (!userId) return [];

    const randomUsers = await prisma.user.findMany({
      where: {
        AND: [
          { NOT: { id: userId } },
          {
            NOT: {
              followers: {
                some: {
                  followerId: userId,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
      take: 3,
    });

    return randomUsers;
  } catch (error) {
    console.log("Error fetching random users", error);
    return [];
  }
}

export async function toggleFollow(targetUserId: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) return;

    if (userId === targetUserId) throw new Error("You cannot follow yourself");

    const existingFollow = await prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      await prisma.follows.delete({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: targetUserId,
          },
        },
      });
    } else {
      await prisma.$transaction([
        prisma.follows.create({
          data: {
            followerId: userId,
            followingId: targetUserId,
          },
        }),
        prisma.notification.create({
          data: {
            type: "FOLLOW",
            userId: targetUserId,
            creatorId: userId,
          },
        }),
      ]);
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.log("Error in toggleFollow", error);
    return { success: false, error: "Error toggling follow" };
  }
}

/**
 * Fetch real-time security alerts for the current user
 */
export async function getSecurityAlerts() {
  const userId = await getDbUserId();
  if (!userId) return [];

  return (prisma as any).securityAlert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}
