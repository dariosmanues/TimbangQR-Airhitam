import cv2, numpy as np
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')

def smart_opencv_led_preprocess(img, color_mode='red'):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    if color_mode == 'green':
        lower_green = np.array([35, 60, 40])
        upper_green = np.array([85, 255, 255])
        mask = cv2.inRange(hsv, lower_green, upper_green)
    else:
        lower_red1 = np.array([0, 45, 40])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([168, 45, 40])
        upper_red2 = np.array([180, 255, 255])
        mask = cv2.bitwise_or(cv2.inRange(hsv, lower_red1, upper_red1), cv2.inRange(hsv, lower_red2, upper_red2))
    
    if cv2.countNonZero(mask) < 20:
        return img, False
        
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.bitwise_and(img, img, mask=closed)
    return cleaned, True

tests = [
    ('USER SCREENSHOT (1250)', cv2.imread('crop_user_1250_full.png')),
    ('SCALE 1600 (crop_media2)', cv2.imread('crop_media2.png')),
    ('ROOM BACKGROUND (media_1)', cv2.imread(r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791287848093.png')[30:200, 120:460]),
    ('FACE (media_4)', cv2.imread(r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791291376133.png')[30:200, 120:460]),
    ('SCALE 1600 (media_6)', cv2.imread(r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791296798288.png')[220:380, 240:520]),
]

for label, img in tests:
    cleaned, applied = smart_opencv_led_preprocess(img)
    res = model.predict(cleaned, conf=0.10, verbose=False)[0]
    boxes = []
    for b in res.boxes:
        cname = model.names[int(b.cls[0])]
        if cname.startswith('D'):
            boxes.append((cname, float(b.conf[0]), float(b.xyxy[0][0]), float(b.xyxy[0][2])))
    boxes.sort(key=lambda x: x[2])
    
    filtered = []
    for b in boxes:
        if not filtered:
            filtered.append(b)
            continue
        prev = filtered[-1]
        overlap = min(prev[3], b[3]) - max(prev[2], b[2])
        w_min = min(prev[3]-prev[2], b[3]-b[2])
        if overlap > 0.38 * w_min:
            if b[1] > prev[1]:
                filtered[-1] = b
        else:
            filtered.append(b)
            
    digits = ''.join(b[0].replace('D', '') for b in filtered)
    print(f'[{label}] => Digits: "{digits}"')
