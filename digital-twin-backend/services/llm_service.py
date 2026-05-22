"""
LLM Service — exclusively using Groq API for advanced agentic tool calling.
"""
import os

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

_llm = None
_llm_ready = None   # None = untested, True/False = tested

def _try_build_llm():
    """Build Groq LLM instance."""
    global _llm, _llm_ready

    # Toujours relire depuis l'environnement au cas où .env a changé
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    if not groq_api_key:
        print("[ERROR] GROQ_API_KEY is not set in environment.")
        _llm_ready = False
        return None

    try:
        from langchain_groq import ChatGroq
        _llm = ChatGroq(
            api_key=groq_api_key,
            model=groq_model,
            temperature=0.1
        )
        
        # We assume it's ready if initialized. Sometimes invoke("ping") fails on Groq due to rate limits or strict message structure.
        _llm_ready = True
        print(f"[OK] Groq LLM ready: {groq_model}")
        return _llm
    except Exception as e:
        print(f"[WARNING] Groq unavailable: {e}")
        _llm_ready = False
        return None

def get_llm():
    global _llm, _llm_ready
    if _llm_ready is True:
        return _llm
        
    # Reload environment in case .env was modified
    load_dotenv(override=True)
    
    return _try_build_llm()

def has_real_llm() -> bool:
    return get_llm() is not None


