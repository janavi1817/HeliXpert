import os
import logging

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VISION_MODEL_DIR = os.path.join(BASE_DIR, 'models', 'vision')
MODEL_PATH = os.path.join(VISION_MODEL_DIR, 'resnet50.onnx')
LABELS_PATH = os.path.join(VISION_MODEL_DIR, 'imagenet_classes.txt')

class VisionService:
    def __init__(self):
        self.session = None
        self.labels = []
        self._loaded = False

    def _lazy_load(self):
        """Load model only when first needed."""
        if self._loaded:
            return
        self._loaded = True
        try:
            import onnxruntime as ort
            if os.path.exists(MODEL_PATH):
                self.session = ort.InferenceSession(MODEL_PATH, providers=['CPUExecutionProvider'])
                logging.info("Vision ONNX model loaded.")
        except Exception as e:
            logging.warning(f"Vision model not loaded: {e}")

        if os.path.exists(LABELS_PATH):
            with open(LABELS_PATH, 'r') as f:
                self.labels = [line.strip() for line in f.readlines()]

    def preprocess_image(self, image_path):
        from PIL import Image
        import numpy as np
        img = Image.open(image_path).convert('RGB')
        img = img.resize((224, 224))
        img_data = np.array(img).astype('float32') / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        img_data = (img_data - mean) / std
        img_data = np.transpose(img_data, (2, 0, 1))
        img_data = img_data[None, :]
        return img_data

    def analyze(self, image_path):
        self._lazy_load()
        if self.session is None:
            return {
                "success": False,
                "error": "Vision model not loaded. Place resnet50.onnx in models/vision/ and restart."
            }
        try:
            import numpy as np
            input_name = self.session.get_inputs()[0].name
            input_data = self.preprocess_image(image_path)
            outputs = self.session.run(None, {input_name: input_data})
            logits = outputs[0][0]
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / np.sum(exp_logits)
            top_index = int(np.argmax(probs))
            confidence = float(probs[top_index])
            label = self.labels[top_index] if top_index < len(self.labels) else f"Class_{top_index}"
            return {
                "success": True,
                "classification": label,
                "confidence": confidence,
                "dataset_used": "Local ONNX ResNet50 (CPU)"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

vision_service = VisionService()
