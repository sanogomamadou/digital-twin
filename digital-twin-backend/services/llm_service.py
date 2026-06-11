import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.callbacks import BaseCallbackHandler
from db.database import SessionLocal, LLMConfigDB, AgentMetricsDB
import json
import time

load_dotenv()

# Basic Callback handler to store metrics in our local PostgreSQL
class AgentMetricsCallbackHandler(BaseCallbackHandler):
    def __init__(self, trace_id="agent_call"):
        self.trace_id = trace_id
        self.start_time = None
        self.token_count = 0

    def on_llm_start(self, serialized, prompts, **kwargs):
        self.start_time = time.time()
        # Very rough estimate of input tokens
        self.token_count += sum(len(p) for p in prompts) // 4

    def on_llm_end(self, response, **kwargs):
        if not self.start_time: return
        latency = (time.time() - self.start_time) * 1000
        
        # Estimate output tokens
        try:
            self.token_count += len(response.generations[0][0].text) // 4
        except:
            pass

        self._save_metric(latency, 1, None)

    def on_llm_error(self, error: Exception, **kwargs):
        if not self.start_time: return
        latency = (time.time() - self.start_time) * 1000
        self._save_metric(latency, 0, str(error))

    def _save_metric(self, latency, success, error_msg):
        try:
            db = SessionLocal()
            metric = AgentMetricsDB(
                trace_id=self.trace_id,
                latency_ms=latency,
                token_count=self.token_count,
                success=success,
                error_message=error_msg
            )
            db.add(metric)
            db.commit()
            db.close()
        except Exception as e:
            print(f"[Metrics] Failed to save metric: {e}")

def get_langfuse_callback():
    try:
        if os.getenv("LANGFUSE_SECRET_KEY") and os.getenv("LANGFUSE_PUBLIC_KEY"):
            # Set timeout to 30 seconds to prevent ReadTimeout when sending large LangGraph traces
            os.environ["LANGFUSE_TIMEOUT"] = "30"
            from langfuse.langchain import CallbackHandler
            return CallbackHandler()
    except Exception as e:
        print(f"[WARNING] Langfuse initialization failed: {e}")
    return None

def get_langfuse_client():
    """Returns the Langfuse client if configured."""
    try:
        if os.getenv("LANGFUSE_SECRET_KEY") and os.getenv("LANGFUSE_PUBLIC_KEY"):
            from langfuse import Langfuse
            return Langfuse()
    except Exception as e:
        print(f"[WARNING] Langfuse client initialization failed: {e}")
    return None

def get_langfuse_prompt(prompt_name: str, fallback_prompt: str = "") -> str:
    """Fetch a prompt from Langfuse prompt management. Fallback to DB or hardcoded if it fails."""
    try:
        client = get_langfuse_client()
        if client:
            prompt = client.get_prompt(prompt_name)
            if prompt:
                # Compile without variables just to get the raw text 
                # (if it uses Mustache {{var}}, you can pass kwargs here, but for system prompts it's usually static)
                return prompt.compile() 
    except Exception as e:
        print(f"[WARNING] Failed to fetch prompt '{prompt_name}' from Langfuse: {e}")
        
    return fallback_prompt

def _build_llm_from_db():
    try:
        db = SessionLocal()
        config = db.query(LLMConfigDB).first()
        db.close()
        
        if not config:
            return None
            
        keys = json.loads(config.api_keys_json) if config.api_keys_json else []
        if not keys:
            # Fallback to env
            env_key = os.getenv("GROQ_API_KEY")
            if env_key:
                keys = [env_key]
            else:
                return None
                
        model_name = config.model
        temp = config.temperature
        max_tok = config.max_tokens or None  # None → provider default (no cap)

        # Route to correct LLM provider
        is_openai = "gpt" in model_name.lower() or "o1" in model_name.lower() or "o3" in model_name.lower()
        is_anthropic = "claude" in model_name.lower()
        is_google = "gemini" in model_name.lower()

        def create_llm_instance(key: str):
            if is_openai:
                try:
                    from langchain_openai import ChatOpenAI
                except ImportError:
                    raise ValueError("langchain-openai is not installed")
                return ChatOpenAI(
                    api_key=key,
                    model=model_name,
                    temperature=temp,
                    max_tokens=max_tok,
                    max_retries=1
                )
            elif is_anthropic:
                try:
                    from langchain_anthropic import ChatAnthropic
                except ImportError:
                    raise ValueError("langchain-anthropic is not installed")
                return ChatAnthropic(
                    api_key=key,
                    model_name=model_name,
                    temperature=temp,
                    max_tokens=max_tok,
                    max_retries=1
                )
            elif is_google:
                try:
                    from langchain_google_genai import ChatGoogleGenerativeAI
                except ImportError:
                    raise ValueError("langchain-google-genai is not installed")
                return ChatGoogleGenerativeAI(
                    google_api_key=key,
                    model=model_name,
                    temperature=temp,
                    max_output_tokens=max_tok
                )
            else:
                return ChatGroq(
                    api_key=key,
                    model=model_name,
                    temperature=temp,
                    max_tokens=max_tok,
                    max_retries=1
                )

        # Create primary LLM
        primary_llm = create_llm_instance(keys[0])
        
        # Create fallbacks if multiple keys exist
        if len(keys) > 1:
            fallbacks = []
            for key in keys[1:]:
                fallbacks.append(create_llm_instance(key))
                
            return primary_llm.with_fallbacks(fallbacks)
            
        return primary_llm
        
    except Exception as e:
        print(f"[ERROR] Failed to build LLM from DB: {e}")
        return None

def get_llm():
    return _build_llm_from_db()

def has_real_llm() -> bool:
    return get_llm() is not None

def get_base_system_prompt() -> str:
    try:
        db = SessionLocal()
        config = db.query(LLMConfigDB).first()
        db.close()
        if config and config.system_prompt:
            return config.system_prompt.strip()
    except:
        pass
    return ""
