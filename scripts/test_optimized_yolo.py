import cv2, numpy as np, time
from ultralytics import YOLO

class OptimizedYoloOcr:
    def __init__(self, model_path='models/7segment_yolo.pt'):
        self.model = YOLO(model_path)
        
    def predict_ocr(self, img_bgr, conf=0.10, imgsz=416, configured_digits=0):
        t0 = time.time()
        h, w = img_bgr.shape[:2]
        if h == 0 or w == 0:
            return {"success": False, "message": "Ukuran gambar tidak valid"}
            
        # Optional: Mild contrast enhancement only if image is underexposed
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        if gray.mean() < 40 and gray.max() > 60:
            # Display gelap, boosting terang sedikit
            img_in = cv2.convertScaleAbs(img_bgr, alpha=1.2, beta=10)
        else:
            img_in = img_bgr

        # Run YOLO predict
        res = self.model.predict(img_in, conf=conf, imgsz=imgsz, verbose=False)[0]
        
        raw_boxes = []
        for box in res.boxes:
            cls_id = int(box.cls[0])
            cls_name = self.model.names[cls_id]
            conf_val = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            patch = img_bgr[max(0, int(y1)):min(h, int(y2)), max(0, int(x1)):min(w, int(x2))]
            if patch.size == 0:
                continue
                
            mean_b = float(patch[:, :, 0].mean())
            mean_g = float(patch[:, :, 1].mean())
            mean_r = float(patch[:, :, 2].mean())
            max_r = float(patch[:, :, 2].max())
            p90_r = float(np.percentile(patch[:, :, 2], 90))
            red_excess = mean_r - max(mean_g, mean_b)
            
            raw_boxes.append({
                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                'center_x': (x1 + x2) / 2.0,
                'width': x2 - x1,
                'height': y2 - y1,
                'cls': cls_name,
                'conf': conf_val,
                'mean_r': mean_r,
                'max_r': max_r,
                'p90_r': p90_r,
                'red_excess': red_excess,
            })
            
        # Ambil hanya kelas digit (D0..D9)
        digits = [b for b in raw_boxes if b['cls'].startswith('D')]
        if not digits:
            return {
                "success": False,
                "digits": "",
                "weightKg": 0,
                "confidence": 0.0,
                "digitCount": 0,
                "boxes": [],
                "latencyMs": round((time.time() - t0) * 1000, 1),
                "message": "Tidak ada digit LED terdeteksi"
            }
            
        # Urutkan dari kiri ke kanan
        digits.sort(key=lambda b: b['center_x'])
        
        # Deduplikasi overlap (misal D1 dan D7 terdeteksi di lokasi sama)
        filtered = []
        for d in digits:
            if not filtered:
                filtered.append(d)
                continue
            prev = filtered[-1]
            overlap = min(prev['x2'], d['x2']) - max(prev['x1'], d['x1'])
            min_w = min(prev['width'], d['width'])
            if overlap > 0.35 * min_w:
                if d['conf'] > prev['conf']:
                    filtered[-1] = d
            else:
                filtered.append(d)
                
        # Filter segmen mati (unlit / bayangan redup 88)
        # Gunakan p90_r atau max_r agar digit '1' yang segmennya sedikit tidak tereliminasi
        max_p90 = max([d['p90_r'] for d in filtered], default=0.0)
        max_red_excess = max([d['red_excess'] for d in filtered], default=0.0)
        
        active_digits = []
        for d in filtered:
            is_active = True
            # Jika display memiliki segmen menyala terang, buang segmen bayangan yang redup
            if max_p90 > 130:
                if d['p90_r'] < 90 or d['max_r'] < 110:
                    is_active = False
            elif max_red_excess > 40:
                if d['red_excess'] < 15 and d['max_r'] < 100:
                    is_active = False
            if is_active:
                active_digits.append(d)
                
        if not active_digits:
            return {
                "success": False,
                "digits": "",
                "weightKg": 0,
                "confidence": 0.0,
                "digitCount": 0,
                "boxes": [],
                "latencyMs": round((time.time() - t0) * 1000, 1),
                "message": "Segmen redup / non-aktif"
            }
            
        # Potong jika melebihi configuredDigits
        if configured_digits and configured_digits > 0:
            if len(active_digits) > configured_digits:
                active_digits = active_digits[-configured_digits:]
                
        digit_str = ''.join(d['cls'].replace('D', '') for d in active_digits)
        avg_conf = sum(d['conf'] for d in active_digits) / len(active_digits)
        try:
            val = int(digit_str)
        except ValueError:
            val = 0
            
        boxes_out = [
            {
                "digit": d['cls'].replace('D', ''),
                "conf": round(d['conf'], 2),
                "box": [round(d['x1'], 1), round(d['y1'], 1), round(d['x2'], 1), round(d['y2'], 1)]
            }
            for d in active_digits
        ]
        
        dt_ms = round((time.time() - t0) * 1000, 1)
        return {
            "success": True,
            "digits": digit_str,
            "weightKg": val,
            "confidence": round(avg_conf, 3),
            "digitCount": len(active_digits),
            "boxes": boxes_out,
            "latencyMs": dt_ms,
            "message": f"Terbaca {digit_str} KG ({round(avg_conf*100)}%)"
        }

if __name__ == '__main__':
    engine = OptimizedYoloOcr()
    
    test_cases = [
        ('media_1 (room)', r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791287848093.png', (120, 30, 460, 200)),
        ('media_2 (scale 1600)', r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791289094051.png', (180, 40, 320, 160)),
        ('media_3 (scale 1600)', r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791290409964.png', (240, 40, 520, 180)),
        ('media_4 (face)', r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791291376133.png', (120, 30, 460, 200)),
        ('media_6 (scale 1600)', r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791296798288.png', (240, 220, 520, 380)),
    ]
    
    for label, path, (x1, y1, x2, y2) in test_cases:
        img = cv2.imread(path)
        crop = img[y1:y2, x1:x2]
        res = engine.predict_ocr(crop, configured_digits=4)
        print(f"[{label}] => success={res['success']} | digits='{res.get('digits','')}' | latency={res['latencyMs']}ms | msg={res['message']}")
