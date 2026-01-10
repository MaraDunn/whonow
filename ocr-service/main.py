"""
PaddleOCR Service - Fast, accurate OCR for business cards
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
import os
from PIL import Image
import numpy as np
from paddleocr import PaddleOCR
import logging
import threading
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="PaddleOCR Service",
    description="High-accuracy OCR service for business cards",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy initialization of PaddleOCR (initializes on first request, not at startup)
# This prevents startup timeouts and crashes on Render free tier
ocr = None
ocr_lock = threading.Lock()
ocr_initializing = False
ocr_init_error = None


def get_ocr_instance():
    """Get or initialize PaddleOCR instance (thread-safe lazy initialization)"""
    global ocr, ocr_initializing, ocr_init_error
    
    if ocr is not None:
        return ocr
    
    with ocr_lock:
        # Double-check pattern
        if ocr is not None:
            return ocr
        
        if ocr_initializing:
            # Another thread is initializing, wait and retry
            wait_time = 0
            max_wait = 180  # Wait up to 3 minutes
            while ocr_initializing and wait_time < max_wait:
                time.sleep(2)
                wait_time += 2
                if ocr is not None:
                    return ocr
                if ocr_init_error:
                    raise Exception(f"PaddleOCR initialization failed: {ocr_init_error}")
            if ocr is None:
                raise Exception("PaddleOCR initialization timeout")
        
        try:
            ocr_initializing = True
            logger.info("Initializing PaddleOCR (lazy initialization)...")
            logger.info("This may take 30-60 seconds on first request while models download...")
            
            ocr = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                use_gpu=False,  # Set to True if GPU is available
                show_log=True,  # Enable logging to see model downloads
                det_db_thresh=0.3,  # Detection threshold (lower = more sensitive)
                det_db_box_thresh=0.5,  # Box threshold
                rec_batch_num=6,  # Recognition batch size
            )
            
            logger.info("PaddleOCR initialized successfully!")
            ocr_initializing = False
            return ocr
        except Exception as e:
            ocr_init_error = str(e)
            ocr_initializing = False
            logger.error(f"Failed to initialize PaddleOCR: {e}", exc_info=True)
            raise Exception(f"PaddleOCR initialization failed: {e}")


class OCRRequest(BaseModel):
    image: str  # Base64 encoded image
    enhance: bool = True  # Whether to enhance image quality


class OCRWord(BaseModel):
    text: str
    confidence: float
    x: int
    y: int
    width: int
    height: int


class OCRResponse(BaseModel):
    text: str
    words: list[OCRWord]
    confidence: float
    success: bool
    error: str | None = None


def base64_to_image(base64_string: str) -> np.ndarray:
    """Convert base64 string to numpy array (image)"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(base64_string)
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to numpy array
        return np.array(image)
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")


def enhance_image(image: np.ndarray) -> np.ndarray:
    """Apply basic image enhancement for better OCR"""
    try:
        from PIL import ImageEnhance
        
        # Convert to PIL
        pil_image = Image.fromarray(image)
        
        # Increase contrast
        enhancer = ImageEnhance.Contrast(pil_image)
        pil_image = enhancer.enhance(1.5)
        
        # Increase sharpness
        enhancer = ImageEnhance.Sharpness(pil_image)
        pil_image = enhancer.enhance(1.5)
        
        return np.array(pil_image)
    except Exception as e:
        logger.warning(f"Image enhancement failed: {e}, using original")
        return image


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "PaddleOCR",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "ocr_initialized": ocr is not None,
        "ocr_initializing": ocr_initializing,
        "ocr_init_error": ocr_init_error,
        "gpu_available": False  # Update if using GPU
    }


@app.post("/ocr", response_model=OCRResponse)
async def perform_ocr(request: OCRRequest):
    """
    Perform OCR on a base64 encoded image
    
    Args:
        request: OCRRequest containing base64 image
        
    Returns:
        OCRResponse with extracted text and word details
    """
    try:
        logger.info("Received OCR request")
        
        # Get or initialize OCR instance (this may take time on first call)
        logger.info("Getting PaddleOCR instance...")
        ocr_instance = get_ocr_instance()
        logger.info("PaddleOCR instance ready")
        
        # Convert base64 to image
        image = base64_to_image(request.image)
        logger.info(f"Image shape: {image.shape}")
        
        # Enhance image if requested
        if request.enhance:
            image = enhance_image(image)
            logger.info("Image enhanced")
        
        # Perform OCR
        logger.info("Running PaddleOCR...")
        result = ocr_instance.ocr(image, cls=True)
        
        if not result or not result[0]:
            logger.warning("No text detected in image")
            return OCRResponse(
                text="",
                words=[],
                confidence=0.0,
                success=True,
                error="No text detected in image"
            )
        
        # Parse results
        words = []
        full_text_lines = []
        total_confidence = 0.0
        word_count = 0
        
        for line in result[0]:
            if not line:
                continue
                
            # line format: [box_coordinates, (text, confidence)]
            box = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            text_info = line[1]  # (text, confidence)
            
            text = text_info[0]
            confidence = float(text_info[1]) * 100  # Convert to percentage
            
            # Calculate bounding box
            x_coords = [point[0] for point in box]
            y_coords = [point[1] for point in box]
            x = int(min(x_coords))
            y = int(min(y_coords))
            width = int(max(x_coords) - min(x_coords))
            height = int(max(y_coords) - min(y_coords))
            
            words.append(OCRWord(
                text=text,
                confidence=confidence,
                x=x,
                y=y,
                width=width,
                height=height
            ))
            
            full_text_lines.append(text)
            total_confidence += confidence
            word_count += 1
        
        # Calculate average confidence
        avg_confidence = total_confidence / word_count if word_count > 0 else 0.0
        
        # Join all text
        full_text = "\n".join(full_text_lines)
        
        logger.info(f"OCR completed: {word_count} words, avg confidence: {avg_confidence:.1f}%")
        
        return OCRResponse(
            text=full_text,
            words=words,
            confidence=avg_confidence,
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR error: {e}", exc_info=True)
        return OCRResponse(
            text="",
            words=[],
            confidence=0.0,
            success=False,
            error=str(e)
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

