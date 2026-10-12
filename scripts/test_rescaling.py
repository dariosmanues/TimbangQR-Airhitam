import cv2
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')

for name in ['crop_media2.png', 'crop_full_1600.png', 'crop_media5_red.png', 'crop_test_numbers.png']:
    img = cv2.imread(name)
    if img is None: continue
    h, w = img.shape[:2]
    print(f"\n==================== {name} ({w}x{h}) ====================")
    
    # Coba berbagai teknik:
    # 1. Raw default (imgsz=640)
    res_raw = model.predict(img, conf=0.10, imgsz=640, verbose=False)[0]
    boxes_raw = sorted([(model.names[int(b.cls[0])], round(float(b.conf[0]), 2), round(float(b.xyxy[0][0]), 1)) for b in res_raw.boxes], key=lambda x: x[2])
    print(f"1. Raw imgsz=640: {[b[0] for b in boxes_raw]}")
    
    # 2. Raw imgsz=320
    res_320 = model.predict(img, conf=0.10, imgsz=320, verbose=False)[0]
    boxes_320 = sorted([(model.names[int(b.cls[0])], round(float(b.conf[0]), 2), round(float(b.xyxy[0][0]), 1)) for b in res_320.boxes], key=lambda x: x[2])
    print(f"2. Raw imgsz=320: {[b[0] for b in boxes_320]}")

    # 3. Resize image proportionally so height is ~120px (display normal height)
    target_h = 120
    scale = target_h / h
    target_w = int(w * scale)
    resized = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
    res_norm = model.predict(resized, conf=0.10, imgsz=320, verbose=False)[0]
    boxes_norm = sorted([(model.names[int(b.cls[0])], round(float(b.conf[0]), 2), round(float(b.xyxy[0][0]), 1)) for b in res_norm.boxes], key=lambda x: x[2])
    print(f"3. Rescaled to H=120 (w={target_w}) + imgsz=320: {[b[0] for b in boxes_norm]}")
