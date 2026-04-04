"use client";

import { useState } from "react";
import { Phone, PhoneCall, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

export function VoiceCallButton() {
    const { user } = useUser();
    const [isCalling, setIsCalling] = useState(false);
    const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active">("idle");

    const initiateCall = async () => {
        if (!user) return;
        setIsCalling(true);
        setCallStatus("connecting");

        try {
            const response = await fetch("http://localhost:8000/api/v1/support/call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: user.id,
                    phone_number: user.primaryPhoneNumber?.phoneNumber || "+1234567890", // fallback
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to initiate call");
            }

            setCallStatus("active");
            toast.success("Call Initiated. Please pick up your phone.");

            setTimeout(() => {
                setCallStatus("idle");
                setIsCalling(false);
            }, 5000); // Mock active state reset

        } catch (error) {
            console.error(error);
            toast.error("Failed to connect to Voice Support.");
            setCallStatus("idle");
            setIsCalling(false);
        }
    };

    return (
        <Button
            onClick={initiateCall}
            disabled={isCalling}
            variant={callStatus === "active" ? "secondary" : "default"}
            size="lg"
            className="w-full sm:w-auto"
        >
            {callStatus === "connecting" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
            ) : callStatus === "active" ? (
                <PhoneCall className="mr-2 size-4 animate-pulse text-green-500" />
            ) : (
                <Phone className="mr-2 size-4" />
            )}
            {callStatus === "connecting" ? "Connecting..." : callStatus === "active" ? "Call in Progress" : "Call Support (Voice)"}
        </Button>
    );
}
