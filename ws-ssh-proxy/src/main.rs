use std::net::SocketAddr;
use anyhow::{Context, Result};
use clap::Parser;
use tokio::net::TcpListener;
use tracing::info;

mod handler;

#[derive(Parser, Debug)]
#[command(name = "ws-ssh-proxy")]
#[command(about = "WebSocket SSH proxy - connect to SSH servers via browser WebSocket")]
struct Args {
    #[arg(short, long, default_value = "0.0.0.0")]
    bind: String,

    #[arg(short, long, default_value_t = 8080)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let args = Args::parse();
    let addr: SocketAddr = format!("{}:{}", args.bind, args.port)
        .parse()
        .context("Invalid bind address")?;

    let listener = TcpListener::bind(addr)
        .await
        .context("Failed to bind TCP listener")?;

    info!("ws-ssh-proxy listening on ws://{}/ws", addr);
    info!("Health endpoint: http://{}/health", addr);

    while let Ok((stream, peer_addr)) = listener.accept().await {
        info!("New connection from {}", peer_addr);
        tokio::spawn(handler::handle_connection(stream));
    }

    Ok(())
}
