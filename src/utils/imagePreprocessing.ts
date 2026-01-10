/**
 * Image preprocessing utilities for OCR
 * Enhances image quality to improve Tesseract OCR accuracy
 */

/**
 * Preprocess image for better OCR results
 * Applies multiple enhancement techniques for optimal OCR accuracy
 */
export async function preprocessImageForOCR(
  imageBase64: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Scale up image for better OCR (Tesseract works better on larger images)
        // Target minimum 2000px on the longest side for better accuracy
        const maxDimension = 2000;
        const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 3); // Max 3x scale
        const scaledWidth = Math.round(img.width * scale);
        const scaledHeight = Math.round(img.height * scale);

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw and scale original image
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply comprehensive preprocessing pipeline
        const processed = enhanceImageDataAdvanced(data, canvas.width, canvas.height);

        // Put processed data back
        imageData.data.set(processed);
        ctx.putImageData(imageData, 0, 0);

        // Convert back to base64 with high quality
        const processedBase64 = canvas.toDataURL("image/png");
        resolve(processedBase64);
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = imageBase64;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Advanced image enhancement pipeline for OCR
 * Applies multiple techniques for optimal text recognition
 */
function enhanceImageDataAdvanced(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const length = data.length;
  
  // Step 1: Convert to high-quality grayscale
  const grayscale: number[] = [];
  for (let i = 0; i < length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Use ITU-R BT.709 luminance formula (better for modern displays)
    const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    grayscale.push(gray);
  }

  // Step 2: Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
  const claheProcessed = applyCLAHE(grayscale, width, height, 8, 8, 2.0);

  // Step 3: Apply Gaussian blur for noise reduction (light blur)
  const blurred = applyGaussianBlur(claheProcessed, width, height, 1.0);

  // Step 4: Apply sharpening filter to enhance text edges
  const sharpened = applySharpenFilter(blurred, width, height);

  // Step 5: Apply adaptive thresholding (better than global Otsu for varying lighting)
  const thresholdMap = calculateAdaptiveThreshold(sharpened, width, height, 15, 10);
  
  // Step 6: Apply morphological operations to clean up text
  const morphed = applyMorphology(sharpened, thresholdMap, width, height);

  // Step 7: Final contrast enhancement
  const { min, max } = findMinMax(morphed);
  const finalContrast = morphed.map((value) => {
    // Stretch contrast with gamma correction
    const normalized = (value - min) / (max - min || 1);
    const gammaCorrected = Math.pow(normalized, 0.8); // Slight gamma boost
    return Math.round(gammaCorrected * 255);
  });

  // Step 8: Binarize using adaptive threshold
  const enhanced = new Uint8ClampedArray(length);
  for (let i = 0; i < length; i += 4) {
    const grayIndex = i / 4;
    const threshold = thresholdMap[grayIndex];
    const grayValue = finalContrast[grayIndex];
    
    // Use adaptive threshold with slight bias toward white background
    const binaryValue = grayValue > threshold * 0.85 ? 255 : 0;

    enhanced[i] = binaryValue; // R
    enhanced[i + 1] = binaryValue; // G
    enhanced[i + 2] = binaryValue; // B
    enhanced[i + 3] = data[i + 3]; // Alpha (preserve)
  }

  return enhanced;
}

/**
 * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * Improves local contrast while limiting amplification
 */
function applyCLAHE(
  grayscale: number[],
  width: number,
  height: number,
  tileSize: number = 8,
  clipLimit: number = 8,
  contrastLimit: number = 2.0
): number[] {
  const result = new Array(grayscale.length);
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);

  // Process each tile
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, width);
      const y1 = Math.min(y0 + tileSize, height);

      // Build histogram for this tile
      const histogram = new Array(256).fill(0);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * width + x;
          const gray = Math.round(grayscale[idx]);
          histogram[gray]++;
        }
      }

      // Clip histogram (CLAHE enhancement)
      const totalPixels = (x1 - x0) * (y1 - y0);
      const clipThreshold = Math.floor(totalPixels / 256 * clipLimit);
      let clippedSum = 0;
      
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > clipThreshold) {
          clippedSum += histogram[i] - clipThreshold;
          histogram[i] = clipThreshold;
        }
      }

      // Redistribute clipped pixels
      const redistribution = Math.floor(clippedSum / 256);
      for (let i = 0; i < 256; i++) {
        histogram[i] += redistribution;
      }

      // Build cumulative distribution function (CDF)
      const cdf = new Array(256);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }

      // Normalize CDF
      const cdfMin = cdf.find(v => v > 0) || 1;
      const scale = 255 / (totalPixels - cdfMin);

      // Apply transformation to pixels in this tile
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * width + x;
          const gray = Math.round(grayscale[idx]);
          const normalized = Math.round((cdf[gray] - cdfMin) * scale);
          result[idx] = Math.min(255, Math.max(0, normalized));
        }
      }
    }
  }

  return result;
}

/**
 * Apply Gaussian blur for noise reduction
 */
function applyGaussianBlur(
  grayscale: number[],
  width: number,
  height: number,
  sigma: number = 1.0
): number[] {
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1; // Odd size
  const kernel = generateGaussianKernel(kernelSize, sigma);
  const offset = Math.floor(kernelSize / 2);
  const result = new Array(grayscale.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - offset;
          const py = y + ky - offset;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = py * width + px;
            const weight = kernel[ky * kernelSize + kx];
            sum += grayscale[idx] * weight;
            weightSum += weight;
          }
        }
      }

      const idx = y * width + x;
      result[idx] = Math.round(sum / weightSum);
    }
  }

  return result;
}

/**
 * Generate Gaussian kernel
 */
function generateGaussianKernel(size: number, sigma: number): number[] {
  const kernel = new Array(size * size);
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y * size + x] = value;
      sum += value;
    }
  }

  // Normalize
  return kernel.map(v => v / sum);
}

/**
 * Apply sharpening filter (Laplacian-based)
 */
function applySharpenFilter(
  grayscale: number[],
  width: number,
  height: number
): number[] {
  const sharpenKernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  const result = new Array(grayscale.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = x + kx;
          const py = y + ky;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = py * width + px;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += grayscale[idx] * sharpenKernel[kernelIdx];
          }
        }
      }

      const idx = y * width + x;
      result[idx] = Math.min(255, Math.max(0, Math.round(sum)));
    }
  }

  return result;
}

/**
 * Calculate adaptive threshold map
 * Uses local mean-based thresholding
 */
function calculateAdaptiveThreshold(
  grayscale: number[],
  width: number,
  height: number,
  blockSize: number = 15,
  constant: number = 10
): number[] {
  const thresholdMap = new Array(grayscale.length);
  const offset = Math.floor(blockSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      // Calculate local mean
      for (let dy = -offset; dy <= offset; dy++) {
        for (let dx = -offset; dx <= offset; dx++) {
          const px = x + dx;
          const py = y + dy;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = py * width + px;
            sum += grayscale[idx];
            count++;
          }
        }
      }

      const localMean = sum / count;
      const idx = y * width + x;
      thresholdMap[idx] = localMean - constant;
    }
  }

  return thresholdMap;
}

/**
 * Apply morphological operations (opening/closing) to clean text
 */
function applyMorphology(
  grayscale: number[],
  thresholdMap: number[],
  width: number,
  height: number
): number[] {
  // First apply erosion (removes small noise)
  const eroded = applyMorphOperation(grayscale, thresholdMap, width, height, 'erode');
  // Then apply dilation (restores text size)
  const dilated = applyMorphOperation(eroded, thresholdMap, width, height, 'dilate');
  return dilated;
}

/**
 * Apply single morphological operation
 */
function applyMorphOperation(
  grayscale: number[],
  thresholdMap: number[],
  width: number,
  height: number,
  operation: 'erode' | 'dilate'
): number[] {
  const result = new Array(grayscale.length);
  const kernelSize = 3;
  const offset = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const threshold = thresholdMap[idx];
      const isWhite = grayscale[idx] > threshold;

      let resultValue = grayscale[idx];

      if (operation === 'erode') {
        // Erosion: take minimum (for white pixels, this erodes them)
        let minValue = 255;
        for (let dy = -offset; dy <= offset; dy++) {
          for (let dx = -offset; dx <= offset; dx++) {
            const px = x + dx;
            const py = y + dy;

            if (px >= 0 && px < width && py >= 0 && py < height) {
              const nIdx = py * width + px;
              minValue = Math.min(minValue, grayscale[nIdx]);
            }
          }
        }
        resultValue = minValue;
      } else {
        // Dilation: take maximum (for white pixels, this dilates them)
        let maxValue = 0;
        for (let dy = -offset; dy <= offset; dy++) {
          for (let dx = -offset; dx <= offset; dx++) {
            const px = x + dx;
            const py = y + dy;

            if (px >= 0 && px < width && py >= 0 && py < height) {
              const nIdx = py * width + px;
              maxValue = Math.max(maxValue, grayscale[nIdx]);
            }
          }
        }
        resultValue = maxValue;
      }

      result[idx] = resultValue;
    }
  }

  return result;
}

/**
 * Original enhance function kept for compatibility
 */
function enhanceImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  return enhanceImageDataAdvanced(data, width, height);
}

/**
 * Calculate Otsu's threshold for binarization
 */
function calculateOtsuThreshold(grayscale: number[]): number {
  // Build histogram
  const histogram = new Array(256).fill(0);
  for (const value of grayscale) {
    histogram[Math.round(value)]++;
  }

  const total = grayscale.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Apply median filter for noise reduction
 * Uses 3x3 neighborhood
 */
function applyMedianFilter(
  grayscale: number[],
  width: number,
  height: number
): number[] {
  const filtered = new Array(grayscale.length);
  const kernelSize = 3;
  const offset = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const neighbors: number[] = [];

      for (let dy = -offset; dy <= offset; dy++) {
        for (let dx = -offset; dx <= offset; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            neighbors.push(grayscale[ny * width + nx]);
          }
        }
      }

      // Get median value
      neighbors.sort((a, b) => a - b);
      filtered[index] = neighbors[Math.floor(neighbors.length / 2)];
    }
  }

  return filtered;
}

/**
 * Find min and max values in array
 */
function findMinMax(arr: number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const value of arr) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return { min, max };
}

/**
 * Deskew image by detecting rotation angle using projection profile analysis
 * Returns corrected image base64
 */
export async function deskewImage(imageBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Get image data for analysis
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Convert to grayscale
        const grayscale: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          grayscale.push(gray);
        }

        // Detect rotation angle using projection profile method
        const angle = detectSkewAngle(grayscale, canvas.width, canvas.height);
        
        // Only rotate if angle is significant (more than 0.5 degrees)
        if (Math.abs(angle) > 0.5) {
          // Create new canvas for rotated image
          const rotatedCanvas = document.createElement("canvas");
          const rotatedCtx = rotatedCanvas.getContext("2d");
          if (!rotatedCtx) {
            resolve(canvas.toDataURL("image/png"));
            return;
          }

          // Calculate new dimensions
          const rad = (angle * Math.PI) / 180;
          const cos = Math.abs(Math.cos(rad));
          const sin = Math.abs(Math.sin(rad));
          const newWidth = Math.ceil(canvas.width * cos + canvas.height * sin);
          const newHeight = Math.ceil(canvas.width * sin + canvas.height * cos);

          rotatedCanvas.width = newWidth;
          rotatedCanvas.height = newHeight;

          // Rotate and draw
          rotatedCtx.translate(newWidth / 2, newHeight / 2);
          rotatedCtx.rotate(rad);
          rotatedCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

          resolve(rotatedCanvas.toDataURL("image/png"));
        } else {
          // No significant rotation, return original
          resolve(canvas.toDataURL("image/png"));
        }
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = imageBase64;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Detect skew angle using projection profile analysis
 */
function detectSkewAngle(grayscale: number[], width: number, height: number): number {
  // Test angles from -15 to +15 degrees
  const testAngles = [];
  for (let angle = -15; angle <= 15; angle += 0.5) {
    testAngles.push(angle);
  }

  let bestAngle = 0;
  let maxVariance = 0;

  for (const angle of testAngles) {
    const variance = calculateProjectionVariance(grayscale, width, height, angle);
    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * Calculate variance of horizontal projection profile
 * Higher variance indicates better text alignment (less skew)
 */
function calculateProjectionVariance(
  grayscale: number[],
  width: number,
  height: number,
  angle: number
): number {
  const rad = (angle * Math.PI) / 180;
  const projection = new Array(height).fill(0);

  // Build horizontal projection
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Rotate point
      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const rx = dx * Math.cos(-rad) - dy * Math.sin(-rad) + cx;
      const ry = dx * Math.sin(-rad) + dy * Math.cos(-rad) + cy;

      if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
        const idx = Math.round(ry) * width + Math.round(rx);
        if (idx >= 0 && idx < grayscale.length) {
          // Use inverted value (text is usually dark)
          projection[y] += 255 - grayscale[idx];
        }
      }
    }
  }

  // Calculate variance
  const mean = projection.reduce((a, b) => a + b, 0) / projection.length;
  const variance = projection.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / projection.length;

  return variance;
}

