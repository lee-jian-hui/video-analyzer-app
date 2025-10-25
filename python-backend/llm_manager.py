import threading
from transformers import AutoTokenizer, AutoModelForCausalLM
from core.singleton import SingletonMeta
from mcp_manager import mcp_manager_singleton
MODEL_ID = "microsoft/Phi-3-mini-4k-instruct"
# MODEL_ID = "meta-llama/Llama-3.2-1B-Instruct"


class LLMManager(metaclass=SingletonMeta):
    def __init__(self):
        print("🚀 Initializing local LLM...")
        self._load_model()

    def _load_model(self):
        """Safely load tokenizer + model once per runtime."""
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
            self.model = AutoModelForCausalLM.from_pretrained(MODEL_ID, device_map="cpu")
            print(f"✅ Loaded model: {MODEL_ID}")
        except Exception as e:
            print(f"❌ Failed to load model {MODEL_ID}: {e}")
            self.tokenizer = None
            self.model = None

    # --------------------------------------------------------------------
    # Inject tool context dynamically from MCPManager
    # --------------------------------------------------------------------
    def _build_tool_context(self):
        """Serialize available MCP tools into a natural language format."""
        tools = mcp_manager_singleton.list_all_tools()
        if not tools:
            return "No tools are currently registered."

        lines = ["You can use these available tools:"]
        for t in tools:
            lines.append(f"- **{t['name']}** from `{t['server']}`: {t.get('description', '')}")
        return "\n".join(lines)

    def generate(self, prompt: str, max_new_tokens: int = 100) -> str:
        if not self.model or not self.tokenizer:
            raise RuntimeError("❌ LLM not initialized correctly.")

        # 🧩 Inject tool registry into system context
        tool_context = self._build_tool_context()
        messages = [
            {"role": "system", "content": "You are a local AI assistant capable of using the following MCP tools."},
            {"role": "system", "content": tool_context},
            {"role": "user", "content": prompt},
        ]

        # Template + inference
        template = self.tokenizer.apply_chat_template(messages, tokenize=False)
        inputs = self.tokenizer(template, return_tensors="pt")
        outputs = self.model.generate(**inputs, max_new_tokens=max_new_tokens)
        return self.tokenizer.decode(outputs[0], skip_special_tokens=True)


# ✅ Singleton instance
llm_manager = LLMManager()


# ✅ Global singleton instance
llm_manager = LLMManager()
