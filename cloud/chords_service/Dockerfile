FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CHORDS_STORAGE_DIR=/data/chords-jobs

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY cloud/chords_service/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY cloud/chords_service /app

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
