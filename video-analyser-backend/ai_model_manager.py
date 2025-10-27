import os
import logging
from pathlib import Path
from typing import Dict, Optional, Any
import hashlib
from enum import Enum
from configs import Config


class AIModelType(Enum):
    """Enum for tracking AI model types by capability"""
    TRANSCRIPTION = "transcription"    # Whisper for speech-to-text
    OBJECT_DETECTION = "object_detection"  # YOLO for object detection
    LLM = "llm"                       # Language model (Llama/CodeLlama/Gemini)


class ModelType(Enum):
    """Model types by primary capability"""
    TRANSCRIPTION = "transcription"
    OBJECT_DETECTION = "object_detection"
    LLM_FUNCTION_CALLING = "llm_function_calling"
    LLM_CHAT = "llm_chat"
    LLM_GENERAL = "llm_general"


class ModelSize(Enum):
    """Model size categories"""
    TINY = "tiny"       # < 1B parameters
    SMALL = "small"     # 1-3B parameters  
    MEDIUM = "medium"   # 3-7B parameters
    LARGE = "large"     # 7-15B parameters
    XLARGE = "xlarge"   # > 15B parameters


class SupportedModels(Enum):
    """Hardcoded list of all supported models"""
    # Transcription Models
    WHISPER_TINY = "whisper_tiny"
    WHISPER_BASE = "whisper_base"
    WHISPER_SMALL = "whisper_small"
    WHISPER_MEDIUM = "whisper_medium"
    WHISPER_LARGE = "whisper_large"
    
    # Object Detection Models
    YOLOV8N = "yolov8n"
    YOLOV8S = "yolov8s"
    YOLOV8M = "yolov8m"
    YOLOV8L = "yolov8l"
    YOLOV8X = "yolov8x"
    
    # LLM Models
    LLAMA3_2_1B = "llama3_2_1b"
    CODELLAMA_7B = "codellama_7b"
    CODELLAMA_7B_4BIT = "codellama_7b_4bit"
    QWEN_CODER_1_5B = "qwen_coder_1_5b"
    QWEN3_1_7B = "qwen3_1_7b"
    PHI3_MINI = "phi3_mini"
    
    # Remote Models
    GEMINI_FLASH = "gemini_flash"

class AIModelManager:
    """Manages AI model downloads and caching for all agents"""

    def __init__(self, models_dir: str = None):
        if models_dir is None:
            models_dir = Config.get_ml_model_cache_dir()
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        self.logger = logging.getLogger(__name__)

        # Model configurations using capability-based enum
        self.model_configs = {
            AIModelType.TRANSCRIPTION: {
                "models": ["tiny", "base", "small", "medium", "large"],
                "default": "base",
                "cache_dir": self.models_dir / "whisper"
            },
            AIModelType.OBJECT_DETECTION: {
                "models": ["yolov8n.pt", "yolov8s.pt", "yolov8m.pt", "yolov8l.pt", "yolov8x.pt"],
                "default": "yolov8n.pt",
                "cache_dir": self.models_dir / "yolo"
            },
            AIModelType.LLM: {
                "llama": {
                    "model_name": "meta-llama/Llama-3.2-1B-Instruct",
                    "cache_dir": self.models_dir / "llama3-2b"
                },
                "codellama": {
                    "model_name": "codellama/CodeLlama-7b-Instruct-hf",
                    "cache_dir": self.models_dir / "codellama-7b"
                }
            }
        }

        # Create subdirectories
        for model_type, config in self.model_configs.items():
            if model_type == AIModelType.LLM:
                # LLM has nested structure
                for llm_type, llm_config in config.items():
                    llm_config["cache_dir"].mkdir(exist_ok=True)
            else:
                # Other models have direct cache_dir
                config["cache_dir"].mkdir(exist_ok=True)

    def initialize_all_models(self) -> Dict[AIModelType, bool]:
        """Initialize all required models. Returns status for each model type."""
        results = {}

        self.logger.info("Initializing AI models...")

        # Initialize Transcription (Whisper)
        results[AIModelType.TRANSCRIPTION] = self._initialize_whisper()

        # Initialize Object Detection (YOLO)
        results[AIModelType.OBJECT_DETECTION] = self._initialize_yolo()

        # Initialize LLM based on config
        results[AIModelType.LLM] = self._initialize_local_llm()

        return results

    def _initialize_whisper(self) -> bool:
        """Initialize Whisper model"""
        try:
            import whisper

            model_name = self.model_configs[AIModelType.TRANSCRIPTION]["default"]
            cache_dir = self.model_configs[AIModelType.TRANSCRIPTION]["cache_dir"]

            self.logger.info(f"Loading Whisper model: {model_name}")

            # Set Whisper cache directory
            os.environ["WHISPER_CACHE_DIR"] = str(cache_dir)

            # Load model (will download if not cached)
            model = whisper.load_model(model_name, download_root=str(cache_dir))

            self.logger.info(f"Whisper model {model_name} loaded successfully")
            return True

        except ImportError:
            self.logger.error("Whisper not installed. Run: pip install openai-whisper")
            return False
        except Exception as e:
            self.logger.error(f"Failed to initialize Whisper: {e}")
            return False

    def _initialize_yolo(self) -> bool:
        """Initialize YOLO model"""
        try:
            from ultralytics import YOLO
            from ultralytics.utils import SETTINGS

            model_name = self.model_configs[AIModelType.OBJECT_DETECTION]["default"]
            cache_dir = self.model_configs[AIModelType.OBJECT_DETECTION]["cache_dir"]
            model_path = cache_dir / model_name

            # Set ultralytics weights directory to our cache
            SETTINGS['weights_dir'] = str(cache_dir)

            self.logger.info(f"Loading YOLO model: {model_name}")

            # Load model (will download if not present)
            if not model_path.exists():
                # Download model - YOLO will download to its default cache
                model = YOLO(model_name)
                # Copy to our cache directory
                self._ensure_yolo_in_cache(model_name, cache_dir)
                # Verify the copy worked
                if model_path.exists():
                    self.logger.info(f"YOLO model {model_name} cached successfully")
                else:
                    self.logger.warning(f"Failed to cache YOLO model to {model_path}")
            else:
                model = YOLO(str(model_path))

            self.logger.info(f"YOLO model {model_name} loaded successfully")
            return True

        except ImportError:
            self.logger.error("Ultralytics not installed. Run: pip install ultralytics")
            return False
        except Exception as e:
            self.logger.error(f"Failed to initialize YOLO: {e}")
            return False

    def _initialize_llama(self) -> bool:
        """Initialize Llama model - cache it for later use"""
        try:
            self.logger.info("Downloading Llama model to cache...")
            result = self.get_llama_model()
            if result:
                self.logger.info("✅ Llama model cached successfully")
                return True
            else:
                return False
        except Exception as e:
            self.logger.error(f"Failed to initialize Llama: {e}")
            return False

    def _initialize_codellama(self) -> bool:
        """Initialize CodeLlama model - cache it for later use"""
        try:
            self.logger.info("Downloading CodeLlama model to cache...")
            result = self.get_codellama_model()
            if result:
                self.logger.info("✅ CodeLlama model cached successfully")
                return True
            else:
                return False
        except Exception as e:
            self.logger.error(f"Failed to initialize CodeLlama: {e}")
            return False

    def _initialize_qwen(self) -> bool:
        """Initialize Qwen2.5-Coder-1.5B model - cache it for later use"""
        try:
            self.logger.info("Downloading Qwen2.5-Coder-1.5B model to cache...")
            result = self.get_qwen_1_5_b_model()
            if result:
                self.logger.info("✅ Qwen2.5-Coder-1.5B model cached successfully")
                return True
            else:
                return False
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Qwen2.5-Coder-1.5B: {e}")
            return False

    def _initialize_qwen3(self) -> bool:
        """Initialize Qwen3-1.7B model - cache it for later use"""
        try:
            self.logger.info("Downloading Qwen3-1.7B model to cache...")
            result = self.get_qwen3_1_7b_model()
            if result:
                self.logger.info("✅ Qwen3-1.7B model cached successfully")
                return True
            else:
                return False
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Qwen3-1.7B: {e}")
            return False

    def _initialize_phi3(self) -> bool:
        """Initialize Phi-3 model - cache it for later use"""
        try:
            self.logger.info("Downloading Phi-3 model to cache...")
            result = self.get_phi3_model()
            if result:
                self.logger.info("✅ Phi-3 model cached successfully")
                return True
            else:
                return False
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Phi-3: {e}")
            return False

    def _initialize_codellama_4bit(self) -> bool:
        """Initialize CodeLlama 4-bit model - cache it for later use"""
        try:
            self.logger.info("Downloading CodeLlama 4-bit model to cache...")
            result = self.get_codellama_4bit_model()
            if result:
                self.logger.info("✅ CodeLlama 4-bit model cached successfully")
                return True
            else:
                return False
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize CodeLlama 4-bit: {e}")
            return False

    def _initialize_local_llm(self) -> bool:
        """Initialize the configured local LLM"""
        local_model_type = Config.LOCAL_MODEL_TYPE.lower()

        if local_model_type == "codellama":
            return self._initialize_codellama()
        elif local_model_type == "codellama_4bit":
            return self._initialize_codellama_4bit()
        elif local_model_type == "llama":
            return self._initialize_llama()
        elif local_model_type == "qwen":
            return self._initialize_qwen()
        elif local_model_type == "qwen3":
            return self._initialize_qwen3()
        elif local_model_type == "phi3":
            return self._initialize_phi3()
        else:
            self.logger.error(f"Unknown local model type: {local_model_type}")
            return False

    def _ensure_yolo_in_cache(self, model_name: str, cache_dir: Path):
        """Ensure YOLO model is in our cache directory"""
        import shutil
        import glob

        our_model_path = cache_dir / model_name

        # Try multiple common ultralytics cache locations
        possible_locations = [
            Path.home() / ".cache" / "ultralytics" / model_name,
            Path.home() / ".ultralytics" / model_name,
            Path.cwd() / model_name,
        ]

        # Also try to find the model in any ultralytics directory
        ultralytics_cache = Path.home() / ".cache" / "ultralytics"
        if ultralytics_cache.exists():
            found_models = list(ultralytics_cache.glob(f"**/{model_name}"))
            possible_locations.extend(found_models)

        # Find the first existing model file
        for source_path in possible_locations:
            if source_path.exists() and source_path.is_file():
                try:
                    shutil.copy2(source_path, our_model_path)
                    self.logger.info(f"Copied {model_name} from {source_path} to {our_model_path}")
                    return
                except Exception as e:
                    self.logger.warning(f"Failed to copy {model_name}: {e}")

        self.logger.warning(f"Could not find YOLO model {model_name} to copy to cache")

    def get_whisper_model(self, model_size: str = None) -> Optional[Any]:
        """Get cached Whisper model"""
        try:
            import whisper

            model_size = model_size or self.model_configs[AIModelType.TRANSCRIPTION]["default"]
            cache_dir = self.model_configs[AIModelType.TRANSCRIPTION]["cache_dir"]

            # Set cache directory
            os.environ["WHISPER_CACHE_DIR"] = str(cache_dir)

            return whisper.load_model(model_size, download_root=str(cache_dir))

        except Exception as e:
            self.logger.error(f"Failed to load Whisper model: {e}")
            return None

    def get_yolo_model(self, model_size: str = None) -> Optional[Any]:
        """Get cached YOLO model"""
        try:
            from ultralytics import YOLO
            from ultralytics.utils import SETTINGS

            model_size = model_size or self.model_configs[AIModelType.OBJECT_DETECTION]["default"]
            cache_dir = self.model_configs[AIModelType.OBJECT_DETECTION]["cache_dir"]
            model_path = cache_dir / model_size

            # Set ultralytics weights directory to our cache
            SETTINGS['weights_dir'] = str(cache_dir)

            if model_path.exists():
                return YOLO(str(model_path))
            else:
                # Fallback to download
                self.logger.warning(f"Model {model_size} not in cache, downloading...")
                return YOLO(model_size)

        except Exception as e:
            self.logger.error(f"Failed to load YOLO model: {e}")
            return None

    def get_llama_model(self):
        """Get cached Llama model and tokenizer"""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM

            model_config = self.model_configs[AIModelType.LLM]["llama"]
            model_name = model_config["model_name"]
            cache_dir = model_config["cache_dir"]

            # Load from cache (will use cached files automatically)
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=str(cache_dir)
            )
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                dtype="auto",
                device_map=Config.DEVICE_MAP
            )

            return {"model": model, "tokenizer": tokenizer}

        except Exception as e:
            self.logger.error(f"Failed to load Llama model: {e}")
            return None

    def get_codellama_model(self):
        """Get cached CodeLlama model and tokenizer"""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM

            model_config = self.model_configs[AIModelType.LLM]["codellama"]
            model_name = model_config["model_name"]
            cache_dir = model_config["cache_dir"]

            # Load from cache (will use cached files automatically)
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=str(cache_dir)
            )
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                dtype="auto",
                device_map=Config.DEVICE_MAP
            )

            return {"model": model, "tokenizer": tokenizer}

        except Exception as e:
            self.logger.error(f"Failed to load CodeLlama model: {e}")
            return None

    def get_qwen_1_5_b_model(self):
        """Get Qwen2.5-Coder-1.5B model and tokenizer"""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
            import torch

            model_name = "unsloth/Qwen2.5-Coder-1.5B-bnb-4bit"
            cache_dir = Path(Config.get_ml_model_cache_dir()) / "qwen-coder-1.5b"
            cache_dir.mkdir(parents=True, exist_ok=True)

            # 4-bit quantization config
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
            )

            # Load tokenizer
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                trust_remote_code=True
            )
            
            # Set chat template
            if tokenizer.chat_template is None:
                tokenizer.chat_template = (
                    "{% for message in messages %}"
                    "{{'<|im_start|>' + message['role'] + '\\n' + message['content'] + '<|im_end|>' + '\\n'}}"
                    "{% endfor %}"
                    "{% if add_generation_prompt %}{{'<|im_start|>assistant\\n'}}{% endif %}"
                )
                tokenizer.save_pretrained(cache_dir)

            # Load model with quantization
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                device_map=Config.DEVICE_MAP,
                trust_remote_code=True,
                quantization_config=bnb_config
            )

            return {"model": model, "tokenizer": tokenizer}

        except Exception as e:
            self.logger.error(f"Failed to load Qwen2.5-Coder-1.5B model: {e}")
            return None

    def get_qwen3_1_7b_model(self):
        """Get Qwen3-1.7B model and tokenizer"""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
            import torch

            model_name = "Qwen/Qwen3-1.7B"
            cache_dir = Path(Config.get_ml_model_cache_dir()) / "qwen3-1.7b"
            cache_dir.mkdir(parents=True, exist_ok=True)

            # 4-bit quantization config for smaller memory footprint
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
            )

            # Load tokenizer
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                trust_remote_code=True
            )
            
            # Set chat template for Qwen3
            if tokenizer.chat_template is None:
                tokenizer.chat_template = (
                    "{% for message in messages %}"
                    "{{'<|im_start|>' + message['role'] + '\\n' + message['content'] + '<|im_end|>' + '\\n'}}"
                    "{% endfor %}"
                    "{% if add_generation_prompt %}{{'<|im_start|>assistant\\n'}}{% endif %}"
                )
                tokenizer.save_pretrained(cache_dir)

            # Load model with quantization
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                device_map=Config.DEVICE_MAP,
                trust_remote_code=True,
                quantization_config=bnb_config,
                torch_dtype=torch.float16,
            )

            return {"model": model, "tokenizer": tokenizer}

        except Exception as e:
            self.logger.error(f"Failed to load Qwen3-1.7B model: {e}")
            return None

    def get_phi3_model(self):
        """Get Phi-3 Mini model and tokenizer"""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
            import torch

            model_name = "microsoft/Phi-3-mini-4k-instruct"
            cache_dir = Path(Config.get_ml_model_cache_dir()) / "phi3-mini"
            cache_dir.mkdir(parents=True, exist_ok=True)

            # 4-bit quantization config
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
            )

            # Load tokenizer
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                trust_remote_code=True,
            )
            
            # Phi-3 has built-in chat template, but set if needed
            if tokenizer.chat_template is None:
                tokenizer.chat_template = "{% for message in messages %}{{'<|' + message['role'] + '|>\n' + message['content'] + '<|end|>\n'}}{% endfor %}{% if add_generation_prompt %}{{'<|assistant|>\n'}}{% endif %}"
            
            # Load model with quantization
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                device_map=Config.DEVICE_MAP,
                trust_remote_code=True,
                quantization_config=bnb_config
            )

            return {"model": model, "tokenizer": tokenizer}

        except Exception as e:
            self.logger.error(f"Failed to load Phi-3 model: {e}")
            return None

    def get_codellama_4bit_model(self):
        """Get CodeLlama 4-bit quantized model for function calling"""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
            import torch

            model_name = "codellama/CodeLlama-7b-Instruct-hf"
            cache_dir = Path(Config.get_ml_model_cache_dir()) / "codellama-4bit-7b"
            cache_dir.mkdir(parents=True, exist_ok=True)

            # 4-bit quantization config optimized for function calling with CPU offload
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                llm_int8_enable_fp32_cpu_offload=True,  # Enable CPU offload for insufficient GPU RAM
            )

            # Load tokenizer
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                trust_remote_code=True,
            )
            
            # Load model with 4-bit quantization
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=str(cache_dir),
                device_map=Config.DEVICE_MAP,
                trust_remote_code=True,
                quantization_config=bnb_config,
                torch_dtype=torch.float16,
            )

            return {"model": model, "tokenizer": tokenizer}

        except Exception as e:
            self.logger.error(f"Failed to load CodeLlama 4-bit model: {e}")
            return None

    def get_model_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all models"""
        status = {}

        # Transcription status
        transcription_cache = self.model_configs[AIModelType.TRANSCRIPTION]["cache_dir"]
        transcription_files = list(transcription_cache.glob("*.pt")) if transcription_cache.exists() else []
        status["transcription"] = {
            "cache_dir": str(transcription_cache),
            "models_cached": [f.stem for f in transcription_files],
            "default_model": self.model_configs[AIModelType.TRANSCRIPTION]["default"]
        }

        # Object Detection status
        object_detection_cache = self.model_configs[AIModelType.OBJECT_DETECTION]["cache_dir"]
        object_detection_files = list(object_detection_cache.glob("*.pt")) if object_detection_cache.exists() else []
        status["object_detection"] = {
            "cache_dir": str(object_detection_cache),
            "models_cached": [f.name for f in object_detection_files],
            "default_model": self.model_configs[AIModelType.OBJECT_DETECTION]["default"]
        }

        # LLM status
        llm_configs = self.model_configs[AIModelType.LLM]
        status["llm"] = {}
        for llm_type, llm_config in llm_configs.items():
            llm_cache = llm_config["cache_dir"]
            status["llm"][llm_type] = {
                "cache_dir": str(llm_cache),
                "model_name": llm_config["model_name"],
                "cached": llm_cache.exists() and any(llm_cache.iterdir())
            }

        return status

    def cleanup_old_models(self, keep_default: bool = True):
        """Clean up old or unused models"""
        if keep_default:
            self.logger.info("Cleanup with default models preserved is not implemented yet")
        else:
            self.logger.info("Full cleanup is not implemented yet")


# Global instance
_model_manager = None

def get_model_manager() -> AIModelManager:
    """Get the global model manager instance"""
    global _model_manager
    if _model_manager is None:
        _model_manager = AIModelManager()
    return _model_manager

def initialize_models() -> Dict[str, bool]:
    """Initialize all models - call this at application startup"""
    manager = get_model_manager()
    return manager.initialize_all_models()