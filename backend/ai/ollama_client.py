"""
Ollama HTTP client for HeliXpert AI integration.
Provides centralized Ollama API communication with error handling and timeout management.
"""

import requests
import logging
from typing import Optional, List

# Configure logging
logger = logging.getLogger(__name__)


class OllamaClient:
    """
    Client for interacting with Ollama API.
    
    Handles availability checks, model listing, and prompt generation
    with proper error handling and timeouts.
    """
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        """
        Initialize Ollama client.
        
        Args:
            base_url: Ollama API base URL (default: http://localhost:11434)
        """
        self.base_url = base_url
        self.model_name = "llama3.2:latest"  # Default model, can be configured
        logger.info(f"OllamaClient initialized with base_url={base_url}, model={self.model_name}")
    
    def is_available(self) -> bool:
        """
        Check if Ollama service is running and accessible.
        
        Makes a GET request to /api/tags with 2-second timeout.
        
        Returns:
            bool: True if Ollama is available, False otherwise
            
        Requirements: REQ-1.1
        """
        try:
            logger.debug(f"Checking Ollama availability at {self.base_url}/api/tags")
            response = requests.get(
                f"{self.base_url}/api/tags",
                timeout=2
            )
            available = response.status_code == 200
            logger.info(f"Ollama availability check: {available}")
            return available
        except requests.exceptions.Timeout:
            logger.warning("Ollama availability check timed out after 2 seconds")
            return False
        except requests.exceptions.ConnectionError:
            logger.warning(f"Ollama connection error: service not reachable at {self.base_url}")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama availability check failed: {e}")
            return False
    
    def get_available_models(self) -> List[str]:
        """
        Get list of available Ollama models.
        
        Parses the response from GET /api/tags and extracts model names.
        
        Returns:
            List[str]: List of model names, empty list on error
            
        Requirements: REQ-1.2
        """
        try:
            logger.debug(f"Fetching available models from {self.base_url}/api/tags")
            response = requests.get(
                f"{self.base_url}/api/tags",
                timeout=2
            )
            response.raise_for_status()
            
            data = response.json()
            models = [model["name"] for model in data.get("models", [])]
            logger.info(f"Available models: {models}")
            return models
        except requests.exceptions.Timeout:
            logger.warning("Failed to fetch models: request timed out after 2 seconds")
            return []
        except requests.exceptions.ConnectionError:
            logger.warning(f"Failed to fetch models: connection error to {self.base_url}")
            return []
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch available models: {e}")
            return []
        except (KeyError, ValueError) as e:
            logger.error(f"Failed to parse models response: {e}")
            return []
    
    def call_ollama(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout: int = 30
    ) -> str:
        """
        Send a prompt to Ollama and get the response.
        
        Makes a POST request to /api/generate with stream=false.
        
        Args:
            prompt: The prompt text to send to Ollama
            model: Model name to use (default: self.model_name)
            timeout: Request timeout in seconds (default: 30)
            
        Returns:
            str: Generated response text from Ollama
            
        Raises:
            requests.exceptions.Timeout: If request exceeds timeout
            requests.exceptions.ConnectionError: If cannot connect to Ollama
            requests.exceptions.RequestException: For other request errors
            
        Requirements: REQ-1.6
        """
        model = model or self.model_name
        
        logger.debug(f"Calling Ollama with model={model}, prompt_length={len(prompt)}, timeout={timeout}s")
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False  # REQ-1.6: Always use stream=false
                },
                timeout=timeout
            )
            response.raise_for_status()
            
            data = response.json()
            result = data.get("response", "")
            logger.info(f"Ollama response received: {len(result)} characters")
            return result
            
        except requests.exceptions.Timeout:
            logger.error(f"Ollama request timed out after {timeout} seconds")
            raise
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Ollama connection error: {e}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama request failed: {e}")
            raise
