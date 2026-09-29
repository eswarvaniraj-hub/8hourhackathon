"""
Gemini Agricultural AI Assistant Service
Handles:
- Loading GEMINI_API_KEY securely from .env
- Initializing Google GenAI Client
- Multi-language prompt engineering (English & Tamil)
- Domain grounding in Tamil Nadu agriculture and current dashboard scenario
- Automatic model fallback resilience
"""

import os
from dotenv import load_dotenv

# Load .env from backend directory
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Supported models with fallback
PRIMARY_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"]

SYSTEM_PROMPTS = {
    "en": (
        "You are 'AgriYield AI - Uzhavar Thozhan', an expert agronomic assistant specialized in Tamil Nadu agriculture. "
        "Your mission is to assist farmers, agricultural officers, and students in Tamil Nadu with practical, scientifically-grounded advice. "
        "Keep your tone respectful, encouraging, and clear. Cover crops like Rice (Paddy), Maize, Groundnut, and Pulses, "
        "and seasons like Kuruvai, Samba, and Navarai. Provide actionable tips on soil health, irrigation, fertilizer management, "
        "pest control, and weather adaptability. Keep responses concise (under 180 words) and suitable to be spoken aloud by a voice assistant."
    ),
    "ta": (
        "நீங்கள் 'அக்ரி-ஈல்டு உழவர் தோழன்' (AgriYield Uzhavar Thozhan) என்ற தமிழ்நாடு வேளாண்மைக்கான பிரத்யேக செயற்கை நுண்ணறிவு உதவியாளர். "
        "தமிழ்நாட்டு விவசாயிகளுக்கு நெல் (குறுவை, சம்பா, நவரை), மக்காச்சோளம், நிலக்கடலை, பயறு வகைகள் பயிரிடுதல், உர மேலாண்மை, "
        "பாசன முறை, பூச்சி மற்றும் நோய் கட்டுப்பாடு, காலநிலை மாற்றம் குறித்த எளிய, பயனுள்ள ஆலோசனைகளை தமிழில் வழங்க வேண்டும். "
        "பதில்களை தெளிவாகவும், மரியாதை கலந்த எளிய தமிழிலும், சுருக்கமாகவும் (150 வார்த்தைகளுக்குள்) தரவும். வாய்ஸ் அசிஸ்டண்ட் மூலம் படிக்க ஏதுவாக இருக்க வேண்டும்."
    )
}

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.client = None
        
        if self.api_key:
            try:
                from google import genai
                # genai.Client automatically reads GEMINI_API_KEY environment variable
                self.client = genai.Client(api_key=self.api_key)
                print("Gemini GenAI client initialized successfully.")
            except Exception as e:
                print(f"Warning: Failed to initialize Gemini GenAI client: {e}")
                self.client = None
        else:
            print("Warning: GEMINI_API_KEY is not set in backend/.env")

    def is_available(self):
        return self.client is not None and bool(self.api_key)

    def generate_chat_response(self, user_message, language="en", context=None):
        """
        Generate answer using Gemini with language localization and dashboard context.
        """
        if not self.is_available():
            err_msg = (
                "Gemini AI சேவையை இணைக்க முடியவில்லை. தயவுசெய்து backend/.env கோப்பில் GEMINI_API_KEY உள்ளதா என சரிபார்க்கவும்."
                if language == "ta" else
                "Gemini AI service is not initialized. Please ensure GEMINI_API_KEY is configured in backend/.env."
            )
            return {"success": False, "error": err_msg}

        if not user_message or not str(user_message).strip():
            return {"success": False, "error": "Message cannot be empty."}

        lang = "ta" if str(language).lower() in ["ta", "tamil", "தமிழ்"] else "en"
        sys_prompt = SYSTEM_PROMPTS.get(lang, SYSTEM_PROMPTS["en"])

        # Inject active dashboard scenario if available
        context_str = ""
        if context and isinstance(context, dict):
            dist = context.get("district", "Tamil Nadu")
            crop = context.get("crop", "Crop")
            season = context.get("season", "Season")
            pred_yield = context.get("predicted_yield_kg_ha")
            rain = context.get("rainfall_mm")
            temp = context.get("temperature_c")
            
            if lang == "ta":
                context_str = f"\n[தற்போதைய பண்ணை சூழல்: மாவட்டம்: {dist}, பயிர்: {crop}, பருவம்: {season}, கணிக்கப்பட்ட மகசூல்: {pred_yield} kg/ha, மழை: {rain} mm, வெப்பநிலை: {temp}°C]\n"
            else:
                context_str = f"\n[Current Farm Scenario: District: {dist}, Crop: {crop}, Season: {season}, Predicted Yield: {pred_yield} kg/ha, Rainfall: {rain} mm, Temp: {temp}°C]\n"

        full_prompt = f"{sys_prompt}\n{context_str}\nUser Question: {user_message}\nAnswer:"

        last_error = None
        for model_name in PRIMARY_MODELS:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=full_prompt
                )
                if response and response.text:
                    return {
                        "success": True,
                        "reply": response.text.strip(),
                        "language": lang,
                        "model_used": model_name
                    }
            except Exception as e:
                last_error = e
                print(f"Model {model_name} failed: {e}. Trying fallback...")
                continue

        return {
            "success": False,
            "error": f"Failed to generate response: {str(last_error)}"
        }

# Singleton instance
gemini_service = GeminiService()
