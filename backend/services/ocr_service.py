import fitz
import numpy as np
import io
from PIL import Image
from paddleocr import PaddleOCR

class OCRService:
    def __init__(self):
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en')
    
    def extract_text(self, pdf_path: str) -> str:
        """Extrait le texte d'un PDF."""
        doc = fitz.open(pdf_path)
        full_text = ""
        
        for page in doc:
            text = page.get_text()
            
            if len(text.strip()) > 50:
                full_text += text
            else:
                pix = page.get_pixmap(dpi=300)
                img_np = np.array(Image.open(io.BytesIO(pix.tobytes("png"))))
                result = self.ocr.ocr(img_np, cls=True)
                if result and result[0]:
                    full_text += " ".join([line[1][0] for line in result[0]])
        
        doc.close()
        return full_text
    
    def extract_text_from_bytes(self, pdf_bytes: bytes) -> str:
        """Extrait le texte depuis des bytes (pour les uploads)."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""
        
        for page in doc:
            text = page.get_text()
            
            if len(text.strip()) > 50:
                full_text += text
            else:
                pix = page.get_pixmap(dpi=300)
                img_np = np.array(Image.open(io.BytesIO(pix.tobytes("png"))))
                result = self.ocr.ocr(img_np, cls=True)
                if result and result[0]:
                    full_text += " ".join([line[1][0] for line in result[0]])
        
        doc.close()
        return full_text


# Singleton
ocr_service = OCRService()