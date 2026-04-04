"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Send, Loader2, User, ShieldCheck, HelpCircle, Mic, Volume2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";

export function SupportChat() {
    const { user } = useUser();
    const [ticketId, setTicketId] = useState<Id<"supportTickets"> | null>(null);
    const [inputMessage, setInputMessage] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isAITyping, setIsAITyping] = useState(false);

    const tickets = useQuery(api.support.getTickets, user?.id ? { userId: user.id } : "skip");
    const createTicket = useMutation(api.support.createTicket);
    const sendMessage = useMutation(api.support.sendMessage);

    // Removed useEffect to ensure a fresh session on load

    const messages = useQuery(
        api.support.getMessages,
        ticketId ? { ticketId } : "skip"
    );

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleCreateTicket = async (issueType: string) => {
        if (!user?.id) return;
        const newTicketId = await createTicket({ userId: user.id, issueType });
        setTicketId(newTicketId);
    };

    const startRecording = () => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support Speech Recognition.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsRecording(true);

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputMessage(prev => prev ? `${prev} ${transcript}` : transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.start();
    };

    const readAloud = (text: string) => {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Strip markdown before reading (basic stripping for TTS)
            const cleanText = text.replace(/[*_#`~]/g, '');
            const utterance = new SpeechSynthesisUtterance(cleanText);

            // Optionally select a specific voice if desired
            // const voices = window.speechSynthesis.getVoices();
            // utterance.voice = voices.find(v => v.name.includes('Google US English')) || null;

            window.speechSynthesis.speak(utterance);
        } else {
            alert("Your browser does not support text-to-speech.");
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || !ticketId || !user?.id) return;

        const messageText = inputMessage;
        setInputMessage("");

        await sendMessage({
            ticketId,
            senderId: user.id,
            senderRole: "user",
            content: messageText,
        });

        // Dummy AI Response Trigger (in reality, backend takes over)
        setIsAITyping(true);
        fetch("http://localhost:8000/api/v1/support/ai-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket_id: ticketId, message: messageText, user_id: user.id })
        }).catch(e => console.error("Failed to trigger AI:", e)).finally(() => {
            setIsAITyping(false);
        });
    };

    if (!user) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    if (tickets === undefined) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col h-[500px] border rounded-lg bg-card shadow-sm">
            <div className="flex items-center justify-between p-4 border-b bg-muted/50">
                <div className="flex items-center gap-2">
                    <HelpCircle className="size-5 text-primary" />
                    <h2 className="font-semibold text-lg">Live Support</h2>
                </div>
                {!ticketId && (
                    <div className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                        No active session
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!ticketId ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <ShieldCheck className="size-12 text-muted-foreground mb-2" />
                        <h3 className="text-lg font-medium">How can we help?</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Start a conversation with our Support Assistant for immediate answers or human escalation.
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={() => handleCreateTicket("login_blocked")}>Login Issue</Button>
                            <Button onClick={() => handleCreateTicket("security_alert")} variant="secondary">Security Alert</Button>
                        </div>
                    </div>
                ) : (
                    messages?.map((msg) => {
                        const isUser = msg.senderRole === "user";
                        return (
                            <div key={msg._id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                                <div className={`flex gap-2 max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                                    <div className="size-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                        {isUser ? <User className="size-4" /> : <ShieldCheck className="size-4 text-primary" />}
                                    </div>
                                    <div
                                        className={`p-3 rounded-xl text-sm ${isUser
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-foreground"
                                            }`}
                                    >
                                        {isUser ? (
                                            msg.content
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        )}
                                        <div className={`flex items-center gap-2 mt-1 ${isUser ? "justify-end text-primary-foreground/70" : "text-muted-foreground"} text-[10px]`}>
                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {!isUser && (
                                                <button onClick={() => readAloud(msg.content)} className="hover:text-primary transition-colors" title="Read Aloud">
                                                    <Volume2 className="size-3 cursor-pointer" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {isAITyping && (
                    <div className="flex justify-start">
                        <div className="flex gap-2 max-w-[80%] flex-row">
                            <div className="size-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <ShieldCheck className="size-4 text-primary" />
                            </div>
                            <div className="p-4 rounded-xl text-sm bg-muted text-foreground flex items-center gap-1">
                                <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t bg-background">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        placeholder="Type your message..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        disabled={!ticketId}
                    />
                    <Button type="button" onClick={startRecording} disabled={!ticketId || isRecording} variant="outline" size="icon">
                        <Mic className={`size-4 ${isRecording ? 'text-red-500 animate-pulse' : ''}`} />
                    </Button>
                    <Button type="submit" disabled={!ticketId || !inputMessage.trim()} size="icon">
                        <Send className="size-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
