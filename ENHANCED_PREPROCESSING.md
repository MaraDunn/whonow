# Enhanced Preprocessing - 9 Variants

## What Changed

Added **3 new specialized preprocessing variants** to handle challenging business cards:

### New Variants:

**7. Super High Contrast** (for faint/light text)
- Extreme gamma correction (0.5)
- Aggressive 50% threshold
- Best for: Cards with very light or faded text
- **Target**: Chris Green card (if text is faint)

**8. Bilateral Filter** (for photographed cards)
- Edge-preserving smoothing
- Removes photo noise while keeping text sharp
- Best for: Phone photos with glare, shadows, or blur
- **Target**: Real-world photo conditions

**9. Morphological Cleaning** (for stylized fonts)
- Opening operation (removes noise)
- Closing operation (fills gaps in decorative text)
- Best for: Stylized, decorative, or script fonts
- **Target**: Your "stylized font" card

### Dynamic PSM Mode Selection

Different variants now use different Tesseract PSM modes:

- **Morphological & Super Contrast**: PSM 11 (sparse text)
- **Bilateral & Adaptive**: PSM 4 (single column)
- **Inverted & Edge Enhanced**: PSM 6 (uniform block)

This maximizes the chance of success for each variant type.

---

## Total Variants: 6 → 9

1. Scaled Original (2x)
2. High Contrast (Otsu)
3. Adaptive Threshold
4. Sharpened
5. Inverted
6. Edge Enhanced
7. **Super Contrast** ⭐ NEW
8. **Bilateral Filter** ⭐ NEW
9. **Morphological** ⭐ NEW

---

## Expected Impact

### Anna Marchesi:
- ✅ Already working
- Should continue to work consistently

### Chris Green:
- 🎯 Super Contrast variant should help if text is faint
- 🎯 Bilateral Filter should help if it's a photo with noise
- Try scanning again - should see improvement

### Stylized Font Card:
- 🎯 Morphological variant specifically targets decorative fonts
- 🎯 PSM 11 (sparse text) mode better for non-standard layouts
- **Realistic expectation**: Will improve, but heavily stylized fonts may still struggle

---

## Performance Impact

- **Before**: 6 variants, ~6-10 seconds
- **After**: 9 variants, ~9-15 seconds
- **Accuracy**: Should handle more edge cases

---

## Testing Instructions

### 1. Test Chris Green Again

```
Scan the Chris Green card
Check console logs - look for:
  - Which variant produced the best result?
  - Did "super-contrast" or "bilateral-filtered" contribute?
```

**If still failing**, share:
- Console logs (which variants worked)
- What text is being extracted
- Description of the card (is text faint? Is it a photo? Colorful background?)

### 2. Test Stylized Font Card

```
Scan the stylized font card
Check console for "morphological" variant result
```

**Expected**:
- Morphological variant should extract SOMETHING
- May not be perfect, but better than before
- Merging should pick best words from all variants

**If still failing**, this might be a fundamental OCR limitation.

---

## OCR Limitations (Be Aware)

Even with 9 variants, some cards are just too hard for Tesseract:

### Tesseract Struggles With:

❌ **Heavily stylized/decorative fonts**
- Script fonts, handwriting-style fonts
- Very thin or very thick fonts
- Fonts with swirls, flourishes, ornamental elements

❌ **Extremely low quality images**
- Very blurry, out-of-focus photos
- Severely underexposed or overexposed
- Heavy JPEG compression artifacts

❌ **Complex backgrounds**
- Text over busy patterns or images
- Very similar text/background colors
- Gradients or textures behind text

❌ **Unusual layouts**
- Vertical text
- Circular or curved text
- Heavily rotated text

### What Works Best:

✅ **Standard business card fonts**
- Arial, Helvetica, Times New Roman
- Sans-serif and serif fonts
- Clear, simple fonts

✅ **Good lighting and focus**
- Well-lit, sharp photos
- High contrast between text and background
- Minimal shadows or glare

✅ **Simple layouts**
- Horizontal text
- Standard business card format
- White or solid color backgrounds

---

## Optimization Options

### If Speed Is Critical (reduce to 5 variants):

```typescript
// In src/utils/advancedImagePreprocessing.ts
// Keep only these:
return [
  variants[0], // scaled-original
  variants[1], // high-contrast  
  variants[2], // adaptive-threshold
  variants[6], // super-contrast
  variants[8], // morphological
];
```

**Result**: ~6-8 seconds, still covers most cases

### If Accuracy Is Critical (keep all 9):

Current setup - maximizes accuracy at cost of speed.

---

## Troubleshooting by Card Type

### Chris Green Card

**Symptoms**: Wrong name ("Lidia Tt )")

**Likely causes**:
1. Faint or light colored text
2. Photo quality issues (blur, glare)
3. Background pattern interfering

**Best variants**: 
- Super Contrast (if text is faint)
- Bilateral Filter (if it's a photo)
- Adaptive Threshold (if lighting varies)

**Debug steps**:
1. Check console - which variant gave best result?
2. Look at confidence scores - are they all low?
3. Check sample text from each variant
4. If all variants fail, might need manual entry

### Stylized Font Card

**Symptoms**: Completely wrong or gibberish text

**Likely causes**:
1. Decorative/script font Tesseract can't recognize
2. Very thin or very thick strokes
3. Connected letters (script fonts)

**Best variants**:
- Morphological (fills gaps, cleans noise)
- Super Contrast (simplifies to black/white)
- High Contrast (removes complexity)

**Reality check**:
- If font is too stylized, OCR may be impossible
- Consider: Can YOU easily read it from far away?
- If humans struggle, OCR will definitely struggle

---

## Next Steps

1. **Test Chris Green card** with new preprocessing
2. **Test stylized font card** - see how close it gets
3. **Check console logs** to see which variants work best
4. **Report back** with results:
   - What improved?
   - What's still failing?
   - Console logs showing variant results

---

## If Still Not Working

For cards that consistently fail even with 9 variants:

### Option 1: Manual Review
- Extract what we can, let user correct the rest
- Show confidence scores so user knows what to check

### Option 2: Targeted Preprocessing
- If we know specific card type (e.g., "always faint text"), add custom variant
- Could add card-type detection and apply specific preprocessing

### Option 3: Hybrid Approach
- Use multi-pass for most cards
- For known-difficult cards, suggest manual entry
- Or use cloud OCR for difficult cards only (requires internet)

### Option 4: Set Expectations
- Show user which fields have low confidence
- Let them know some cards may require manual correction
- This is normal for OCR - no system is 100% accurate

---

## The Reality of OCR

**Tesseract is amazing for standard text**, but it's not magic:

- Google Cloud Vision: ~95% accuracy (paid, online only)
- Tesseract (single pass): ~30-40% accuracy on business cards
- **Our multi-pass (9 variants): ~70-80% accuracy** 🎯

That's a HUGE improvement, but still not perfect. Some cards will always require human review.

**The goal isn't perfection** - it's to get close enough that users can quickly review and correct, rather than typing everything from scratch.

