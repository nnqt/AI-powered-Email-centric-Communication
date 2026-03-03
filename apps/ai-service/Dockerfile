# Builder: alpine + build tools needed to compile uvloop, httptools (uvicorn[standard] C extensions)
FROM python:3.12-alpine AS builder
WORKDIR /app
RUN apk add --no-cache gcc musl-dev libffi-dev
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Runner: clean alpine image – no build tools, much smaller attack surface than slim/debian
FROM python:3.12-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /install /usr/local
COPY . .
EXPOSE 5000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
