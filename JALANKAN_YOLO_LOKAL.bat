@echo off
setlocal
title TimbangQR - Server YOLO Vision AI (Port 5001)
cd /d "%~dp0"

echo ====================================================
echo   TIMBANGQR - SERVER YOLO VISION AI (PORT 5001)
echo ====================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python belum terpasang atau belum ditambahkan ke PATH.
  echo Silakan pasang Python dan centang opsi "Add Python to PATH".
  echo.
  pause
  exit /b 1
)

echo Memeriksa dependensi Python (FastAPI, OpenCV, YOLO)...
python -c "import fastapi, uvicorn, cv2, ultralytics" >nul 2>nul
if errorlevel 1 (
  echo [INFO] Menginstal dependensi Python yang dibutuhkan...
  pip install fastapi uvicorn ultralytics opencv-python pydantic
  if errorlevel 1 (
    echo [ERROR] Gagal menginstal dependensi Python.
    pause
    exit /b 1
  )
)

echo.
echo [OK] Menjalankan server YOLO OCR di http://127.0.0.1:5001 ...
echo Biarkan jendela ini tetap terbuka selama aplikasi web digunakan.
echo.
python scripts\yolo_ocr_server.py
pause
