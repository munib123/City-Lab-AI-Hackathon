FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn

COPY backend ./backend
COPY data ./data
COPY lab_reports ./lab_reports

EXPOSE 8000
CMD ["uvicorn", "medlens.api:app", "--host", "0.0.0.0", "--port", "8000"]
