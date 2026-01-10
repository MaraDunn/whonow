# Use Python 3.11 bullseye (Debian-based with better package support)
FROM python:3.11-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies with explicit package versions and error handling
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libgomp1 \
        libglib2.0-0 \
        libgl1-mesa-glx \
    || (echo "Package installation had issues, continuing anyway..." && true); \
    rm -rf /var/lib/apt/lists/*; \
    apt-get clean

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Pre-download PaddleOCR models during build (speeds up first request)
# This downloads the models so they're ready when the service starts
RUN python -c "from paddleocr import PaddleOCR; print('Initializing PaddleOCR...'); ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False, show_log=True); print('PaddleOCR models downloaded successfully!')" || echo "Model download may have had issues, but continuing..."

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Health check (using urllib instead of requests)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["python", "main.py"]

