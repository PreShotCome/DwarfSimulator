# Build stage: compiles the worker and the bundled RandomX C++ library.
FROM rust:1-bookworm AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

# Runtime stage: a slim image with just the binary and libstdc++.
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/monero-worker /usr/local/bin/monero-worker
ENTRYPOINT ["monero-worker"]
