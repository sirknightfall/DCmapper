# Dockerfile for FastAPI Backend
FROM python:3.11-slim

# Install system dependencies for ping (iputils-ping)
RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure the backend has permissions for ICMP packets
# (Alternatively, run as root or set capabilities, but for simplicity in Docker we often run as root or useCAP_NET_RAW)
# We will use the --cap-add=NET_RAW in docker-compose

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
