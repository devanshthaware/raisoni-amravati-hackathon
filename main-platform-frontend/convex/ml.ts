import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { evaluateDecision, DecisionType } from "./decisions";
import { transitionSession, SessionState } from "./sessionState";
import { emitEvent } from "./events";

export const getSessionAppAndSettings = query({
    args: { sessionId: v.id("sessions") },
    handler: async (ctx, args) => {
        const session = await ctx.db.get(args.sessionId);
        if (!session) throw new Error("Session not found");
        
        let settings = await ctx.db
            .query("securitySettings")
            .withIndex("by_application", q => q.eq("applicationId", session.applicationId))
            .first();

        if (!settings) {
            settings = {
                _id: "default" as any,
                _creationTime: Date.now(),
                applicationId: session.applicationId,
                enforceMfa: false,
                riskBasedAuth: true,
                autoBlockHighRisk: true,
                sessionRecording: false,
                ipAllowlistEnabled: false,
                updatedAt: Date.now()
            };
        }
        return { session, settings };
    }
});

export const assessRisk = action({
    args: {
        sessionId: v.id("sessions"),
        correlationId: v.string(),
        context: v.any(),
    },
    handler: async (ctx, args) => {
        const mlUrl = process.env.ML_BACKEND_URL || "http://localhost:8000";

        // Fetch session & unique security settings mapping for this specific app
        const { session, settings } = await ctx.runQuery(api.ml.getSessionAppAndSettings, {
            sessionId: args.sessionId
        });

        const requestBody = {
            login: {
                username: args.context.userEmail || session.userEmail || "user@example.com",
                ip_address: args.context.ip || session.ip || "192.168.1.1",
                user_agent: session.browser || "AegisAuth-SDK/1.0",
                login_timestamp: new Date().toISOString(),
                correlation_id: args.correlationId,
            },
            session: { session_id: args.sessionId },
            device: { device_id: args.context.device || session.device || "dev_unknown" }
        };

        try {
            const response: any = await fetch(`${mlUrl}/predict/risk`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-api-key": process.env.ML_BACKEND_API_KEY || "aegis_master_key_2024"
                 },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) throw new Error(`ML Backend responded with ${response.status}`);

            const result: any = await response.json();
            
            // Generate the decision strictly based on the database-enforced settings
            const decision = evaluateDecision(result.risk_score, result.risk_level, settings, session.ip);

            const stateMap: Record<DecisionType, SessionState> = {
                ALLOW: "ACTIVE",
                CHALLENGE: "CHALLENGED",
                RESTRICT: "RESTRICTED",
                BLOCK: "BLOCKED"
            };

            await ctx.runMutation(api.ml.syncMLResults, {
                sessionId: args.sessionId,
                correlationId: args.correlationId,
                score: result.risk_score,
                state: stateMap[decision.type],
                decisionType: decision.type,
                riskResult: result
            });

            return { ...result, decision };
        } catch (error) {
            console.error("ML Risk Assessment failed:", error);
            return null;
        }
    },
});

export const syncMLResults = mutation({
    args: {
        sessionId: v.id("sessions"),
        correlationId: v.string(),
        score: v.number(),
        state: v.string(),
        decisionType: v.string(),
        riskResult: v.any(),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db.get(args.sessionId);
        if (!session || session.state === "TERMINATED") return;

        // 1. Emit RISK_CALCULATED
        await emitEvent(ctx.db, {
            type: "RISK_CALCULATED",
            sessionId: args.sessionId,
            correlationId: args.correlationId,
            applicationId: session.applicationId,
            payload: args.riskResult
        });

        // 2. Emit DECISION_MADE
        await emitEvent(ctx.db, {
            type: "DECISION_MADE",
            sessionId: args.sessionId,
            correlationId: args.correlationId,
            applicationId: session.applicationId,
            payload: {
                decision: args.decisionType,
                target_state: args.state
            }
        });

        // 3. Emit ACTION_DISPATCHED
        await emitEvent(ctx.db, {
            type: "ACTION_DISPATCHED",
            sessionId: args.sessionId,
            correlationId: args.correlationId,
            applicationId: session.applicationId,
            payload: {
                dispatched_at: Date.now(),
                context: "ML_ORCHESTRATED_DECISION"
            }
        });

        // 4. Persist score and transition state
        await ctx.db.patch(args.sessionId, { score: args.score });

        await transitionSession(
            ctx.db, 
            args.sessionId, 
            args.state as SessionState, 
            "ML_ASSESSMENT_COMPLETED",
            args.correlationId
        );

        // Generate Risk/Block Alerts
        if (args.decisionType === "BLOCK" || args.score >= 0.8) {
            const app = await ctx.db.get(session.applicationId);
            if (app) {
                await ctx.db.insert("alerts", {
                    userId: app.userId,
                    applicationId: session.applicationId,
                    type: args.decisionType === "BLOCK" ? "BLOCKED" : "HIGH_RISK",
                    message: args.decisionType === "BLOCK" ? "Session blocked due to high risk policy" : "Critical risk session detected by ML",
                    severity: "CRITICAL",
                    correlationId: args.correlationId,
                    isRead: false,
                    createdAt: Date.now()
                });
            }
        }
    },
});
