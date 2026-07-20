FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl && rm -rf /var/lib/apt/lists/*

COPY shared/ /build/shared/
RUN pip install --no-cache-dir --prefix=/install -e /build/shared/

COPY search-service/requirements.txt /build/requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r /build/requirements.txt

FROM python:3.12-slim AS runtime

RUN groupadd --gid 1001 velontri \
    && useradd --uid 1001 --gid velontri --no-create-home velontri

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /install /usr/local
COPY --from=builder /build/shared/ /app/shared/
COPY search-service/ /app/
RUN chown -R velontri:velontri /app

USER velontri

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", "--loop", "uvloop", "--log-config", "/dev/null"]
