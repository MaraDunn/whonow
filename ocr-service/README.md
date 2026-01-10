# PaddleOCR Service

High-accuracy OCR service for business card scanning.

## Features

- 🎯 **95%+ accuracy** using PaddleOCR (vs 60-70% with Tesseract)
- 🚀 **Fast processing** (~2-5 seconds per card)
- 📦 **Docker ready** - deploy anywhere
- 🔧 **Easy to use** - REST API with FastAPI
- 💰 **Cost effective** - $0-7/month

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
```

Server runs on `http://localhost:8000`

### Docker

```bash
# Build
docker build -t paddleocr-service .

# Run
docker run -p 8000:8000 paddleocr-service
```

### Test

```bash
# Health check
curl http://localhost:8000/health

# OCR test
curl -X POST http://localhost:8000/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ...", "enhance": true}'
```

## API Documentation

### GET `/health`
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "ocr_initialized": true,
  "gpu_available": false
}
```

### POST `/ocr`
Perform OCR on an image.

**Request**:
```json
{
  "image": "data:image/jpeg;base64,...",  // Base64 encoded image
  "enhance": true  // Optional: apply image enhancement
}
```

**Response**:
```json
{
  "text": "Extracted text here...",
  "words": [
    {
      "text": "Name",
      "confidence": 95.5,
      "x": 100,
      "y": 50,
      "width": 80,
      "height": 20
    }
  ],
  "confidence": 92.3,
  "success": true,
  "error": null
}
```

## Deployment

See [PADDLEOCR_DEPLOYMENT.md](../PADDLEOCR_DEPLOYMENT.md) for full deployment guide.

### Quick Deploy

**Railway**: 
```bash
railway up
```

**Render**: Connect GitHub repo and deploy

**Cloud Run**: 
```bash
gcloud run deploy paddleocr-service --source .
```

## Configuration

Environment variables:
- `PORT`: Server port (default: 8000)
- `PYTHONUNBUFFERED`: Set to 1 for logging

## Performance

- **First request**: 10-20 seconds (downloads models)
- **Subsequent requests**: 2-5 seconds
- **Memory usage**: ~500 MB
- **CPU usage**: 1-2 cores recommended

## Requirements

- Python 3.11+
- 500 MB RAM minimum
- 1 GB disk space (for models)

## License

MIT

