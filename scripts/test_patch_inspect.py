import cv2, numpy as np
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')
img = cv2.imread('crop_media2.png')

res = model.predict(img, imgsz=320, conf=0.10, verbose=False)[0]

boxes = []
for b in res.boxes:
    cls_name = model.names[int(b.cls[0])]
    conf = float(b.conf[0])
    x1, y1, x2, y2 = b.xyxy[0].tolist()
    patch = img[max(0, int(y1)):min(img.shape[0], int(y2)), max(0, int(x1)):min(img.shape[1], int(x2))]
    if patch.size > 0:
        mean_b = float(patch[:, :, 0].mean())
        mean_g = float(patch[:, :, 1].mean())
        mean_r = float(patch[:, :, 2].mean())
        red_excess = mean_r - max(mean_g, mean_b)
    else:
        mean_b, mean_g, mean_r, red_excess = 0, 0, 0, 0
    boxes.append({'cls': cls_name, 'conf': conf, 'x1': x1, 'x2': x2, 'mean_r': mean_r, 'red_excess': red_excess, 'width': x2-x1})

boxes.sort(key=lambda x: x['x1'])

# Dedup overlap
filtered = []
for d in boxes:
    if not filtered:
        filtered.append(d)
        continue
    prev = filtered[-1]
    overlap = min(prev['x2'], d['x2']) - max(prev['x1'], d['x1'])
    if overlap > 0.4 * min(prev['width'], d['width']):
        if d['conf'] > prev['conf']:
            filtered[-1] = d
    else:
        filtered.append(d)

max_excess = max([d['red_excess'] for d in filtered], default=0.0)
print(f"max_excess = {max_excess:.1f}, threshold (max_excess * 0.62) = {max_excess * 0.62:.1f}")

for d in filtered:
    print(f"Digit {d['cls']}: red_excess={d['red_excess']:.1f}, mean_r={d['mean_r']:.1f}")
