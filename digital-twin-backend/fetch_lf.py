import os
from langfuse import Langfuse

os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-a8f10522-306d-4a3f-9ea1-c08ce2859294"
os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-c420edae-0fab-46c7-b2d7-e97c0629c421"
os.environ["LANGFUSE_HOST"] = "https://cloud.langfuse.com"

client = Langfuse()
traces = client.fetch_traces()
for t in traces.data:
    print(t.id, getattr(t, 'name', 'None'), t.timestamp)
