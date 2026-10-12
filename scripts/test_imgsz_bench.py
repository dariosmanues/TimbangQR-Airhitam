import cv2, time
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')

crops = {
    'media_2': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791289094051.png', (180, 40, 320, 160)),
    'media_3': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791290409964.png', (240, 40, 520, 180)),
    'media_6': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791296798288.png', (240, 220, 520, 380)),
}

for imgsz in [256, 320, 416, 640]:
    print(f"\n--- Testing imgsz={imgsz} ---")
    times = []
    for label, (path, (x1, y1, x2, y2)) in crops.items():
        img = cv2.imread(path)
        crop = img[y1:y2, x1:x2]
        
        t0 = time.time()
        res = model.predict(crop, imgsz=imgsz, conf=0.10, verbose=False)[0]
        dt = (time.time() - t0) * 1000
        times.append(dt)
        
        boxes = []
        for b in res.boxes:
            cls_name = model.names[int(b.cls[0])]
            if cls_name.startswith('D'):
                boxes.append((cls_name, float(b.conf[0]), float(b.xyxy[0][0]), float(b.xyxy[0][2])))
        
        # sort & dedup
        boxes.sort(key=lambda x: x[2])
        filtered = []
        for d in boxes:
            if not filtered:
                filtered.append(d)
                continue
            prev = filtered[-1]
            overlap = min(prev[3], d[3]) - max(prev[2], d[2])
            w_min = min(prev[3] - prev[2], d[3] - d[2])
            if overlap > 0.4 * w_min:
                if d[1] > prev[1]:
                    filtered[-1] = d
            else:
                filtered.append(d)
                
        digits = ''.join(b[0].replace('D', '') for b in filtered)
        print(f"[{label}] dt={dt:.1f}ms | Digits={digits}")
    print(f"Average latency for imgsz={imgsz}: {sum(times)/len(times):.1f}ms")
