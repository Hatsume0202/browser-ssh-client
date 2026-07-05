# ============ Builder Stage ============
FROM rust:1.79-alpine3.19 AS builder

WORKDIR /app

# Install build dependencies for libssh2 and OpenSSL
RUN apk add --no-cache libssh2-dev openssl-dev pkgconfig

# Copy manifests first for dependency caching
COPY Cargo.toml Cargo.lock* ./
COPY src ./src

# Build the release binary
RUN cargo build --release

# ============ Runtime Stage ============
FROM alpine:3.19

RUN apk add --no-cache libssh2 openssl wget

# Copy the entrypoint script and make it executable
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy the compiled binary from the builder stage
COPY --from=builder /app/target/release/ws-ssh-proxy /usr/local/bin/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
