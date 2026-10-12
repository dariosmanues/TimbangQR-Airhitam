import cv2
from test_pipeline import YoloLedOcr
from yolo_ocr_server import preprocess_led_image

ocr = YoloLedOcr()

crops = {
    'media_2 (scale 1600)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791289094051.png', (180, 40, 320, 160)),
    'media_3 (scale 1600)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791290409964.png', (240, 40, 520, 180)),
    'media_6 (scale 1600)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791296798288.png', (240, 220, 520, 380)),
}

for label, (path, (x1, y1, x2, y2)) in crops.items():
    img = cv2.imread(path)
    crop = img[y1:y2, x1:x2]
    
    # 1. Tanpa preprocess (Raw)
    res_raw = ocr.process_image(crop)
    
    # 2. Dengan preprocess OpenCV yang ada di yolo_ocr_server.py
    cleaned, mask, applied = preprocess_led_image(crop, color_mode="red")
    res_prep = ocr.process_image(cleaned)
    
    print(f"[{label}]")
    print(f"   RAW  => {res_raw['digits']} | success={res_raw['success']} | msg={res_raw['message']}")
    print(f"   PREP => {res_prep['digits']} | success={res_prep['success']} | msg={res_prep['message']}")
