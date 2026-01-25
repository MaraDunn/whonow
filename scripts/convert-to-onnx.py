#!/usr/bin/env python3
"""
Convert LaMini-Flan-T5-77M to ONNX format for direct ONNX Runtime Web usage.
This bypasses transformers.js entirely for more reliable browser inference.
"""

import os
import sys
from pathlib import Path

print("=" * 60)
print("T5 Model → ONNX Converter")
print("=" * 60)

# Check dependencies
try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    print("✓ PyTorch and Transformers found")
    
    # Try importing optimum - if it fails, we'll use manual ONNX export
    try:
        from optimum.onnxruntime import ORTModelForSeq2SeqLM
        USE_OPTIMUM = True
        print("✓ Optimum library found (using optimized export)")
    except ImportError:
        USE_OPTIMUM = False
        print("⚠ Optimum not available, using manual ONNX export")
        import onnx
        from torch.onnx import export as torch_export
        
except ImportError as e:
    print(f"\n❌ Missing dependency: {e}")
    print("\nInstall required packages:")
    print("  pip3 install torch transformers onnx sentencepiece")
    sys.exit(1)

# Configuration
MODEL_NAME = "MBZUAI/LaMini-Flan-T5-77M"
OUTPUT_DIR = Path(__file__).parent.parent / "onnx-models" / "LaMini-Flan-T5-77M"
CACHE_DIR = Path(__file__).parent.parent / ".model-cache"

print(f"\n📥 Downloading model: {MODEL_NAME}")
print(f"📁 Output directory: {OUTPUT_DIR}")

# Create directories
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

try:
    # Step 1: Download tokenizer
    print("\n[1/3] Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_NAME,
        cache_dir=str(CACHE_DIR)
    )
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("✓ Tokenizer saved")
    
    # Step 2: Download and convert model to ONNX
    print("\n[2/3] Converting model to ONNX format...")
    print("   (This may take 2-5 minutes...)")
    
    if USE_OPTIMUM:
        # Use optimum to convert directly to ONNX
        ort_model = ORTModelForSeq2SeqLM.from_pretrained(
            MODEL_NAME,
            export=True,  # This triggers ONNX conversion
            cache_dir=str(CACHE_DIR)
        )
        
        # Save ONNX model
        ort_model.save_pretrained(OUTPUT_DIR)
        print("✓ ONNX model saved")
    else:
        # Manual ONNX export using PyTorch
        print("   Loading PyTorch model...")
        model = AutoModelForSeq2SeqLM.from_pretrained(
            MODEL_NAME,
            cache_dir=str(CACHE_DIR)
        )
        model.eval()
        
        # Export encoder
        print("   Exporting encoder...")
        dummy_input = torch.randint(0, 1000, (1, 128))
        torch_export(
            model.get_encoder(),
            (dummy_input,),
            str(OUTPUT_DIR / "encoder_model.onnx"),
            input_names=['input_ids'],
            output_names=['last_hidden_state'],
            dynamic_axes={'input_ids': {0: 'batch', 1: 'sequence'}}
        )
        
        # Export decoder (simplified - just for demonstration)
        print("   Exporting decoder...")
        decoder_input = torch.randint(0, 1000, (1, 10))
        encoder_hidden = torch.randn(1, 128, model.config.d_model)
        torch_export(
            model.get_decoder(),
            (decoder_input, encoder_hidden),
            str(OUTPUT_DIR / "decoder_model.onnx"),
            input_names=['input_ids', 'encoder_hidden_states'],
            output_names=['logits'],
            dynamic_axes={
                'input_ids': {0: 'batch', 1: 'sequence'},
                'encoder_hidden_states': {0: 'batch', 1: 'encoder_sequence'}
            }
        )
        
        print("✓ ONNX models exported")
    
    # Step 3: Create config file for our app
    print("\n[3/3] Creating metadata...")
    
    import json
    metadata = {
        "model_name": MODEL_NAME,
        "model_type": "t5",
        "task": "text2text-generation",
        "framework": "onnx",
        "files": {
            "encoder": "encoder_model.onnx",
            "decoder": "decoder_model.onnx",
            "decoder_with_past": "decoder_with_past_model.onnx",
            "tokenizer": "tokenizer.json"
        },
        "config": {
            "max_length": 128,
            "temperature": 0.7,
            "top_p": 0.9
        }
    }
    
    with open(OUTPUT_DIR / "model_info.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    print("✓ Metadata created")
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ CONVERSION COMPLETE!")
    print("=" * 60)
    print(f"\nModel files saved to: {OUTPUT_DIR}")
    print("\nFiles created:")
    for file in sorted(OUTPUT_DIR.glob("*")):
        size_mb = file.stat().st_size / (1024 * 1024)
        print(f"  • {file.name} ({size_mb:.1f} MB)")
    
    total_size = sum(f.stat().st_size for f in OUTPUT_DIR.glob("*")) / (1024 * 1024)
    print(f"\n📦 Total size: {total_size:.1f} MB")
    
    print("\n🚀 Next steps:")
    print("1. Upload to Supabase:")
    print(f"   cd {OUTPUT_DIR}")
    print("   for file in *; do")
    print('     ~/bin/supabase storage cp "$file" \\')
    print('       "ai-models/LaMini-Flan-T5-77M-onnx/$file" \\')
    print('       --project-ref yinicwvgwdjlkwjegrun')
    print("   done")
    print("\n2. Test in your app!")
    
except Exception as e:
    print(f"\n❌ Error during conversion: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
