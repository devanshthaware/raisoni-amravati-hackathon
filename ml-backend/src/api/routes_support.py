from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import os
from twilio.rest import Client
import google.generativeai as genai
from dotenv import load_dotenv
from convex import ConvexClient
from src.utils.logger import logger
from urllib.parse import urlparse

load_dotenv()
CONVEX_URL = os.getenv("NEXT_PUBLIC_CONVEX_URL", "mock_url")
convex_client = None


def _is_mock_convex_url(url: str) -> bool:
    # In this repo we treat any value containing "mock" as "no Convex available".
    return (not url) or ("mock" in url.lower())


def get_convex_client() -> ConvexClient | None:
    """
    Lazily create the Convex client so ML backend can start even when
    NEXT_PUBLIC_CONVEX_URL isn't a valid Convex HTTP(S) origin.
    """
    global convex_client

    if convex_client is not None:
        return convex_client

    if _is_mock_convex_url(CONVEX_URL):
        return None

    parsed = urlparse(CONVEX_URL)
    # Convex expects an absolute URL like: https://<name>-<id>.convex.cloud
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        logger.warning(
            "Invalid NEXT_PUBLIC_CONVEX_URL for Convex (expected absolute http(s) URL). Got: %r. Running without Convex.",
            CONVEX_URL,
        )
        return None

    try:
        convex_client = ConvexClient(CONVEX_URL)
        return convex_client
    except Exception:
        logger.exception("Failed to initialize ConvexClient; running without Convex.")
        return None

# Setup Router
router = APIRouter(prefix="/api/v1/support", tags=["Support Center"])

# Request Models
class CallRequest(BaseModel):
    user_id: str
    phone_number: str

class ChatRequest(BaseModel):
    ticket_id: str
    message: str
    user_id: str

# Config & Credentials
# Use environment variables for secure keys
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "mock_sid")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "mock_token")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+1234567890")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "mock_agent")

genai.configure(api_key=os.getenv("GEMINI_API_KEY", "mock_gemini_key"))
# Using user requested gemini-2.5-flash
model = genai.GenerativeModel('gemini-2.5-flash') 


def initiate_twilio_call(to_phone: str):
    """
    Mock or real Twilio call function.
    Connects to ElevenLabs conversational AI via Twilio streams.
    """
    if "mock" in TWILIO_ACCOUNT_SID:
        print(f"[MOCK] Twilio Call initiated to {to_phone} using ElevenLabs Agent {ELEVENLABS_AGENT_ID}")
        return {"status": "mock_success", "call_sid": "CA123456789 mock"}
        
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        # In a real integration, the URL would point to TwiML that connects a WebSocket to ElevenLabs
        call = client.calls.create(
            to=to_phone,
            from_=TWILIO_PHONE_NUMBER,
            url="http://demo.twilio.com/docs/voice.xml" # Placeholder TwiML
        )
        return {"status": "success", "call_sid": call.sid}
    except Exception as e:
        print(f"Twilio error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initiate voice call")


@router.post("/call")
async def trigger_voice_support(request: CallRequest, background_tasks: BackgroundTasks):
    """
    Initiates a voice call to the user via Twilio & ElevenLabs.
    """
    try:
        # Run Call in Background to avoid blocking the API response
        background_tasks.add_task(initiate_twilio_call, request.phone_number)
        return {"status": "Call initiated", "phone": request.phone_number}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-chat")
async def trigger_ai_chat(request: ChatRequest):
    """
    Generates an AI response for the user's support message using Gemini.
    In a full implementation, this would also write the response back to Convex.
    """
    try:
        user_context_str = "No specific context available."
        if not _is_mock_convex_url(CONVEX_URL) and request.user_id:
            try:
                client = get_convex_client()
                if client is not None:
                    ctx_data = client.query("support:getUserContext", {"userId": request.user_id})
                else:
                    ctx_data = None
                user_context_str = str(ctx_data)
            except Exception as e:
                print(f"Error fetching context: {e}")

        prompt = f"""
        You are the highly professional AegisAuth Support Assistant. The user's official complaint is:
        "{request.message}"
        
        Please use the following verified system datastore context about this specific user's account to provide a highly personalized, accurate response. Do NOT advise them on anything that contradicts their specific data below. Do NOT reference data of other users.
        
        USER DATASTORE CONTEXT:
        {user_context_str}
        
        CRITICAL FORMATTING INSTRUCTIONS:
        Your response MUST be highly structured and systematic to be easily readable by the user.
        1. Always acknowledge their complaint nicely.
        2. Give advice strictly using **Markdown Bullet Points**. Do not write long paragraphs.
        3. Use **bold text** (`**like this**`) to aggressively highlight important keywords, system names, file paths, or critical warnings so the user's eyes are easily drawn to them.
        4. If it seems like a critical security issue or they ask for a human, prominently tell them an agent will be with them shortly.
        """
        response = model.generate_content(prompt)
        ai_text = response.text
        
        # Write the response back to Convex DB.
        if not _is_mock_convex_url(CONVEX_URL):
            client = get_convex_client()
            if client is not None:
                client.mutation("support:sendMessage", {
                    "ticketId": request.ticket_id,
                    "senderId": "system",
                    "senderRole": "ai",
                    "content": ai_text,
                    "isAiGenerated": True
                })
        
        return {"status": "success", "response": ai_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
