/**
 * Advanced image preprocessing specifically for business cards
 * Creates multiple variants optimized for different card types
 */

export type PreprocessingVariant = {
  name: string;
  image: string;
  description: string;
};

/**
 * Create multiple preprocessed variants of the image
 * Each variant is optimized for different business card characteristics
 */
export async function createPreprocessingVariants(
  imageBase64: string
): Promise<PreprocessingVariant[]> {
  const variants: PreprocessingVariant[] = [];

  // Load image
  const img = await loadImage(imageBase64);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  // Variant 1: Original (scaled up for better OCR)
  const scaled = scaleImage(img, 2400); // Scale to 2400px on longest side
  variants.push({
    name: "scaled-original",
    image: scaled,
    description: "Original scaled 2x",
  });

  // Variant 2: High contrast black & white
  const highContrast = await applyHighContrast(img);
  variants.push({
    name: "high-contrast",
    image: highContrast,
    description: "High contrast binarization",
  });

  // Variant 3: Adaptive threshold (good for varying lighting)
  const adaptive = await applyAdaptiveThreshold(img);
  variants.push({
    name: "adaptive-threshold",
    image: adaptive,
    description: "Adaptive threshold for varying light",
  });

  // Variant 4: Sharpened and denoised
  const sharpened = await applySharpenAndDenoise(img);
  variants.push({
    name: "sharpened",
    image: sharpened,
    description: "Sharpened with noise reduction",
  });

  // Variant 5: Inverted (for dark backgrounds)
  const inverted = await applyInverted(img);
  variants.push({
    name: "inverted",
    image: inverted,
    description: "Inverted colors for dark cards",
  });

  // Variant 6: Edge-enhanced
  const edgeEnhanced = await applyEdgeEnhancement(img);
  variants.push({
    name: "edge-enhanced",
    image: edgeEnhanced,
    description: "Enhanced text edges",
  });

  // Variant 7: Super high contrast (for faint/light text)
  const superContrast = await applySuperContrast(img);
  variants.push({
    name: "super-contrast",
    image: superContrast,
    description: "Extreme contrast for faint text",
  });

  // Variant 8: Bilateral filter (preserves edges, removes noise - good for photos)
  const bilateral = await applyBilateralFilter(img);
  variants.push({
    name: "bilateral-filtered",
    image: bilateral,
    description: "Bilateral filter for photographed cards",
  });

  // Variant 9: Morphological operations (for stylized fonts)
  const morphological = await applyMorphologicalCleaning(img);
  variants.push({
    name: "morphological",
    image: morphological,
    description: "Morphological cleaning for stylized fonts",
  });

  return variants;
}

function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}

function scaleImage(img: HTMLImageElement, targetSize: number): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Scale to target size on longest side
  const scale = Math.max(img.width, img.height) < targetSize 
    ? targetSize / Math.max(img.width, img.height)
    : 1;
  
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  // Use high-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", 0.95);
}

async function applyHighContrast(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  // Scale up first
  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale and apply Otsu's threshold
  const grayscale = new Uint8Array(data.length / 4);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grayscale[i / 4] = gray;
  }

  // Calculate Otsu threshold
  const threshold = calculateOtsuThreshold(grayscale);

  // Apply threshold with high contrast
  for (let i = 0; i < data.length; i += 4) {
    const gray = grayscale[i / 4];
    const value = gray > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

async function applyAdaptiveThreshold(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Convert to grayscale
  const grayscale = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grayscale[i / 4] = gray;
  }

  // Apply adaptive threshold (local mean)
  const windowSize = 15;
  const offset = Math.floor(windowSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      // Calculate local mean
      for (let wy = Math.max(0, y - offset); wy < Math.min(height, y + offset + 1); wy++) {
        for (let wx = Math.max(0, x - offset); wx < Math.min(width, x + offset + 1); wx++) {
          sum += grayscale[wy * width + wx];
          count++;
        }
      }

      const localMean = sum / count;
      const idx = y * width + x;
      const value = grayscale[idx] > localMean - 10 ? 255 : 0; // -10 for slight bias toward text

      const dataIdx = idx * 4;
      data[dataIdx] = data[dataIdx + 1] = data[dataIdx + 2] = value;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

async function applySharpenAndDenoise(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Apply Gaussian blur for noise reduction (3x3 kernel)
  const blurred = applyGaussianBlur(data, canvas.width, canvas.height);

  // Apply sharpening kernel
  const sharpenKernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  const sharpened = applyConvolution(blurred, canvas.width, canvas.height, sharpenKernel, 3);

  // Copy back
  for (let i = 0; i < data.length; i++) {
    data[i] = sharpened[i];
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

async function applyInverted(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Check if image is predominantly dark (needs inversion)
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const avgBrightness = totalBrightness / (data.length / 4);

  // Only invert if predominantly dark
  if (avgBrightness < 128) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  }

  // Apply high contrast after inversion
  const threshold = calculateOtsuThreshold(data);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const value = gray > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

async function applyEdgeEnhancement(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  // Apply edge detection (Sobel-like)
  const edgeKernel = [
    -1, -1, -1,
    -1, 8, -1,
    -1, -1, -1
  ];

  const edges = applyConvolution(data, canvas.width, canvas.height, edgeKernel, 3);

  // Enhance edges by adding them back to original
  for (let i = 0; i < data.length; i += 4) {
    const enhanced = Math.min(255, data[i] + edges[i] * 0.5);
    data[i] = data[i + 1] = data[i + 2] = enhanced;
  }

  // Apply threshold
  const threshold = calculateOtsuThreshold(data);
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

// Helper: Calculate Otsu threshold
function calculateOtsuThreshold(data: Uint8Array | Uint8ClampedArray): number {
  // Build histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
  }

  // Total pixels
  const total = data.length / 4;

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

// Helper: Apply Gaussian blur
function applyGaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ];
  const kernelSum = 16;
  return applyConvolution(data, width, height, kernel, 3, kernelSum);
}

// Helper: Apply convolution filter
function applyConvolution(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[],
  kernelSize: number,
  divisor: number = 1
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const offset = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const pixelY = Math.min(height - 1, Math.max(0, y + ky - offset));
          const pixelX = Math.min(width - 1, Math.max(0, x + kx - offset));
          const pixelIndex = (pixelY * width + pixelX) * 4;
          const kernelValue = kernel[ky * kernelSize + kx];

          r += data[pixelIndex] * kernelValue;
          g += data[pixelIndex + 1] * kernelValue;
          b += data[pixelIndex + 2] * kernelValue;
        }
      }

      const resultIndex = (y * width + x) * 4;
      result[resultIndex] = Math.min(255, Math.max(0, r / divisor));
      result[resultIndex + 1] = Math.min(255, Math.max(0, g / divisor));
      result[resultIndex + 2] = Math.min(255, Math.max(0, b / divisor));
      result[resultIndex + 3] = data[resultIndex + 3]; // Keep alpha
    }
  }

  return result;
}

// New variant: Super high contrast (for very faint text)
async function applySuperContrast(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale with extreme contrast
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    
    // Apply gamma correction to increase contrast
    gray = Math.pow(gray / 255, 0.5) * 255; // Gamma = 0.5 for high contrast
    
    // Apply aggressive threshold at 50% (127)
    const value = gray > 127 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

// New variant: Bilateral filter (edge-preserving smoothing)
async function applyBilateralFilter(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Convert to grayscale
  const grayscale = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Simplified bilateral filter (for performance)
  const filtered = new Uint8Array(grayscale.length);
  const windowSize = 5;
  const offset = Math.floor(windowSize / 2);
  const sigmaSpace = 2.0;
  const sigmaColor = 50.0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = y * width + x;
      const centerValue = grayscale[centerIdx];
      let sum = 0;
      let weightSum = 0;

      for (let wy = -offset; wy <= offset; wy++) {
        for (let wx = -offset; wx <= offset; wx++) {
          const ny = Math.min(height - 1, Math.max(0, y + wy));
          const nx = Math.min(width - 1, Math.max(0, x + wx));
          const nIdx = ny * width + nx;
          const nValue = grayscale[nIdx];

          // Spatial weight (Gaussian)
          const spatialDist = wx * wx + wy * wy;
          const spatialWeight = Math.exp(-spatialDist / (2 * sigmaSpace * sigmaSpace));

          // Color weight (Gaussian)
          const colorDist = (centerValue - nValue) * (centerValue - nValue);
          const colorWeight = Math.exp(-colorDist / (2 * sigmaColor * sigmaColor));

          const weight = spatialWeight * colorWeight;
          sum += nValue * weight;
          weightSum += weight;
        }
      }

      filtered[centerIdx] = weightSum > 0 ? sum / weightSum : centerValue;
    }
  }

  // Apply threshold
  const threshold = calculateOtsuThreshold(filtered);
  for (let i = 0; i < data.length; i += 4) {
    const value = filtered[i / 4] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

// New variant: Morphological operations (for stylized/decorative fonts)
async function applyMorphologicalCleaning(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = 2400 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Convert to grayscale and binarize
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    binary[i / 4] = gray > 127 ? 255 : 0;
  }

  // Apply morphological opening (erosion followed by dilation)
  // This removes small noise while preserving text structure
  const kernel = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ];

  // Erosion
  const eroded = morphologicalOperation(binary, width, height, kernel, 'erode');
  
  // Dilation
  const opened = morphologicalOperation(eroded, width, height, kernel, 'dilate');

  // Apply morphological closing (dilation followed by erosion)
  // This fills small gaps in text
  const dilated = morphologicalOperation(opened, width, height, kernel, 'dilate');
  const closed = morphologicalOperation(dilated, width, height, kernel, 'erode');

  // Copy back to image data
  for (let i = 0; i < data.length; i += 4) {
    const value = closed[i / 4];
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}

// Helper: Morphological operations
function morphologicalOperation(
  binary: Uint8Array,
  width: number,
  height: number,
  kernel: number[][],
  operation: 'erode' | 'dilate'
): Uint8Array {
  const result = new Uint8Array(binary.length);
  const kh = kernel.length;
  const kw = kernel[0].length;
  const ky = Math.floor(kh / 2);
  const kx = Math.floor(kw / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = operation === 'erode' ? 255 : 0;

      for (let j = 0; j < kh; j++) {
        for (let i = 0; i < kw; i++) {
          if (kernel[j][i] === 0) continue;

          const ny = Math.min(height - 1, Math.max(0, y + j - ky));
          const nx = Math.min(width - 1, Math.max(0, x + i - kx));
          const pixel = binary[ny * width + nx];

          if (operation === 'erode') {
            value = Math.min(value, pixel);
          } else {
            value = Math.max(value, pixel);
          }
        }
      }

      result[y * width + x] = value;
    }
  }

  return result;
}

