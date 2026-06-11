from dotenv import load_dotenv
from langfuse import Langfuse

# Langfuse credentials are read from the environment (.env): LANGFUSE_PUBLIC_KEY,
# LANGFUSE_SECRET_KEY, LANGFUSE_HOST. Never hard-code secrets in source.
load_dotenv()

client = Langfuse()
traces = client.fetch_traces()
for t in traces.data:
    print(t.id, getattr(t, 'name', 'None'), t.timestamp)
