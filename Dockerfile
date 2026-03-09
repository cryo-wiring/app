FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && git config --global user.name "cryowire-app" \
    && git config --global user.email "cryowire-app@localhost"

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/
COPY templates/ templates/

RUN pip install --no-cache-dir .

ENV DATA_DIR=/data
ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["cryowire-app"]
