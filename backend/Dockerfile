FROM python:3.11-slim

# System deps for OpenCV headless + ffmpeg (video read/write) + build tools for a few wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/images uploads/videos results/images results/videos models

EXPOSE 8000

# NOTE: place your trained model at backend/models/iocl_ppe.pt before building,
# or mount it as a volume at runtime (see docker-compose.yml).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
