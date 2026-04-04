"""
Model loader with singleton pattern for loading ML models at startup.
"""
import joblib
from pathlib import Path
from typing import Dict, Any, Optional

from src.config.settings import WEIGHTS_DIR, MODEL_FILES
from src.utils.logger import logger


class ModelLoader:
    """
    Singleton class for loading and managing ML models.
    """
    _instance: Optional['ModelLoader'] = None
    _models: Dict[str, Any] = {}
    _loaded: bool = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelLoader, cls).__new__(cls)
        return cls._instance
    
    def load_models(self) -> Dict[str, Any]:
        """
        Load all models from the weights directory.
        
        Returns:
            Dictionary mapping model names to loaded pipelines
        
        Raises:
            FileNotFoundError: If any model file is missing
            Exception: If model loading fails
        """
        if self._loaded:
            logger.info("Models already loaded, returning cached models")
            return self._models
        
        logger.info(f"Loading models from: {WEIGHTS_DIR}")
        
        if not WEIGHTS_DIR.exists():
            raise FileNotFoundError(
                f"Weights directory not found: {WEIGHTS_DIR}. "
                f"Please ensure model weights are saved in this location."
            )
        
        self._models = {}
        missing_files = []
        
        for model_name, filename in MODEL_FILES.items():
            model_path = WEIGHTS_DIR / filename
            
            if not model_path.exists():
                missing_files.append(str(model_path))
                continue
            
            try:
                logger.info(f"Loading {model_name} model from {model_path}")
                model = joblib.load(model_path)
                self._models[model_name] = model
                logger.info(f"Successfully loaded {model_name} model")
            except Exception as e:
                logger.error(f"Failed to load {model_name} model: {e}")
                raise Exception(f"Error loading {model_name} model: {e}")
        
        if missing_files:
            raise FileNotFoundError(
                f"Missing model files: {', '.join(missing_files)}. "
                f"Please ensure all models are trained and saved."
            )
        
        self._loaded = True
        logger.info(f"Successfully loaded {len(self._models)} models")
        
        return self._models
    
    def get_models(self) -> Dict[str, Any]:
        """
        Get loaded models. Loads models if not already loaded.
        
        Returns:
            Dictionary mapping model names to loaded pipelines
        """
        if not self._loaded:
            return self.load_models()
        return self._models
    
    def get_model(self, model_name: str) -> Any:
        """
        Get a specific model by name.
        
        Args:
            model_name: Name of the model (login, session, device, baseline, global)
        
        Returns:
            Loaded model pipeline
        
        Raises:
            KeyError: If model name is not found
        """
        models = self.get_models()
        if model_name not in models:
            raise KeyError(
                f"Model '{model_name}' not found. Available models: {list(models.keys())}"
            )
        return models[model_name]
    
    def reload_models(self) -> Dict[str, Any]:
        """
        Force reload all models (useful for hot-reloading in development).
        
        Returns:
            Dictionary mapping model names to reloaded pipelines
        """
        logger.info("Force reloading all models")
        self._loaded = False
        self._models = {}
        return self.load_models()


# Global instance
_model_loader = ModelLoader()


def get_models() -> Dict[str, Any]:
    """Convenience function to get all models."""
    return _model_loader.get_models()


def get_model(model_name: str) -> Any:
    """Convenience function to get a specific model."""
    return _model_loader.get_model(model_name)
