use std::io::{Read, Write};
use std::net::TcpStream as TcpStream2;

use anyhow::{anyhow, Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use ssh2::Session;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::sync::mpsc::error::TryRecvError;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};

/// Incoming connect message from the WebSocket client.
#[derive(Debug, Deserialize)]
struct ConnectMessage {
    #[serde(rename = "type")]
    msg_type: String,
    host: String,
    port: Option<u16>,
    username: String,
    password: Option<String>,
    #[serde(rename = "privateKey")]
    private_key: Option<String>,
}

/// Commands sent from the async WebSocket handler to the blocking SSH worker thread.
#[derive(Debug)]
enum SshCommand {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

/// Events sent from the blocking SSH worker thread back to the async WebSocket handler.
#[derive(Debug)]
enum SshEvent {
    Data(Vec<u8>),
    Connected,
    Error(String),
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Accept and handle a single connection. Checks for health check requests
/// before attempting WebSocket upgrade.
pub async fn handle_connection(stream: TcpStream) {
    let peer = stream.peer_addr().ok();
    match try_handle(stream).await {
        Ok(()) => {}
        Err(e) => warn!("Connection from {:?} error: {:?}", peer, e),
    }
}

/// Read the first line from the stream to determine request type.
async fn try_handle(mut stream: TcpStream) -> Result<()> {
    // Read the first 1024 bytes to determine request type
    let mut header_buf = [0u8; 1024];
    let n = stream.peek(&mut header_buf).await.context("Failed to peek at request")?;

    if n == 0 {
        return Err(anyhow!("Empty request"));
    }

    let header_str = String::from_utf8_lossy(&header_buf[..n]);

    // Check if this is a health check request
    if header_str.starts_with("GET /health") {
        let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}\r\n";
        stream.write_all(response.as_bytes()).await?;
        stream.flush().await?;
        info!("Health check request handled");
        return Ok(());
    }

    // Must be a WebSocket upgrade request — upgrade the connection
    let ws_stream = accept_async(stream)
        .await
        .context("WebSocket upgrade failed")?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Read the first message — must be a JSON connect/auth payload
    let connect_msg = match ws_receiver.next().await {
        Some(Ok(Message::Text(text))) => {
            let msg: ConnectMessage =
                serde_json::from_str(&text).context("Failed to parse connect message")?;
            anyhow::ensure!(
                msg.msg_type == "connect",
                "First message must have type 'connect'"
            );
            msg
        }
        Some(Ok(other)) => {
            return Err(anyhow!(
                "Expected a text connect message, got {:?}",
                other
            ));
        }
        Some(Err(e)) => return Err(anyhow!("WebSocket error: {}", e)),
        None => return Err(anyhow!("Connection closed before receiving connect message")),
    };

    anyhow::ensure!(
        connect_msg.password.is_some() || connect_msg.private_key.is_some(),
        "Either 'password' or 'privateKey' must be provided"
    );

    let port = connect_msg.port.unwrap_or(22);
    let ssh_addr = format!("{}:{}", connect_msg.host, port);
    let ssh_username = connect_msg.username.clone();

    info!(
        "Connecting SSH {}@{} (auth: {})",
        ssh_username,
        ssh_addr,
        if connect_msg.password.is_some() {
            "password"
        } else {
            "publickey"
        }
    );

    let (to_ssh_tx, to_ssh_rx) = mpsc::unbounded_channel::<SshCommand>();
    let (to_ws_tx, mut to_ws_rx) = mpsc::unbounded_channel::<SshEvent>();

    std::thread::spawn(move || {
        ssh_worker(
            &ssh_addr,
            &ssh_username,
            connect_msg.password.as_deref(),
            connect_msg.private_key.as_deref(),
            to_ssh_rx,
            to_ws_tx,
        );
    });

    loop {
        tokio::select! {
            biased;

            ws_msg = ws_receiver.next() => {
                match ws_msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                            match json["type"].as_str() {
                                Some("ping") => {
                                    ws_sender
                                        .send(Message::Text(r#"{"type":"pong"}"#.to_string()))
                                        .await?;
                                }
                                Some("resize") => {
                                    let cols = json["cols"].as_u64().unwrap_or(80) as u32;
                                    let rows = json["rows"].as_u64().unwrap_or(24) as u32;
                                    let _ = to_ssh_tx.send(SshCommand::Resize { cols, rows });
                                }
                                Some("connect") => {}
                                _ => {
                                    let _ = to_ssh_tx.send(SshCommand::Data(text.into_bytes()));
                                }
                            }
                        } else {
                            let _ = to_ssh_tx.send(SshCommand::Data(text.into_bytes()));
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        let _ = to_ssh_tx.send(SshCommand::Data(data.to_vec()));
                    }
                    Some(Ok(Message::Ping(data))) => {
                        ws_sender.send(Message::Pong(data)).await?;
                    }
                    Some(Ok(Message::Pong(_))) => {}
                    Some(Ok(Message::Frame(_))) => {}
                    Some(Ok(Message::Close(_))) | None => {
                        let _ = to_ssh_tx.send(SshCommand::Close);
                        break;
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error: {}", e);
                        let _ = to_ssh_tx.send(SshCommand::Close);
                        break;
                    }
                }
            }

            ws_event = to_ws_rx.recv() => {
                match ws_event {
                    Some(SshEvent::Connected) => {
                        ws_sender
                            .send(Message::Text(r#"{"type":"connected"}"#.to_string()))
                            .await?;
                    }
                    Some(SshEvent::Data(data)) => {
                        ws_sender.send(Message::Binary(data)).await?;
                    }
                    Some(SshEvent::Error(msg)) => {
                        let err_payload = serde_json::json!({"type": "error", "message": msg});
                        ws_sender
                            .send(Message::Text(err_payload.to_string()))
                            .await
                            .ok();
                        break;
                    }
                    None => {
                        break;
                    }
                }
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Blocking SSH worker
// ---------------------------------------------------------------------------

fn ssh_worker(
    addr: &str,
    username: &str,
    password: Option<&str>,
    private_key: Option<&str>,
    mut to_ssh_rx: mpsc::UnboundedReceiver<SshCommand>,
    to_ws_tx: mpsc::UnboundedSender<SshEvent>,
) {
    let send_error = |msg: String| {
        let _ = to_ws_tx.send(SshEvent::Error(msg));
    };

    let tcp = match TcpStream2::connect(addr) {
        Ok(t) => t,
        Err(e) => {
            send_error(format!("Failed to connect to SSH server: {}", e));
            return;
        }
    };

    let mut session = match Session::new() {
        Ok(s) => s,
        Err(e) => {
            send_error(format!("Failed to create SSH session: {}", e));
            return;
        }
    };

    session.set_tcp_stream(tcp);

    if let Err(e) = session.handshake() {
        send_error(format!("SSH handshake failed: {}", e));
        return;
    }

    let auth_result = if let Some(pw) = password {
        session.userauth_password(username, pw)
    } else if let Some(key) = private_key {
        session.userauth_pubkey_memory(username, None, key, None)
    } else {
        unreachable!()
    };

    if let Err(e) = auth_result {
        send_error(format!("Authentication failed: {}", e));
        return;
    }

    let mut channel = match session.channel_session() {
        Ok(c) => c,
        Err(e) => {
            send_error(format!("Failed to open SSH channel: {}", e));
            return;
        }
    };

    if let Err(e) = channel.request_pty("xterm", None, Some((80, 24, 0, 0))) {
        send_error(format!("Failed to request PTY: {}", e));
        return;
    }

    if let Err(e) = channel.shell() {
        send_error(format!("Failed to start shell: {}", e));
        return;
    }

    let _ = to_ws_tx.send(SshEvent::Connected);

    session.set_blocking(true);
    session.set_timeout(100);

    info!("SSH session established");

    let mut buf = [0u8; 32_768];
    let mut stderr_buf = [0u8; 4096];
    let mut need_close = false;

    while !need_close {
        match channel.read(&mut buf) {
            Ok(0) => {
                info!("SSH EOF");
                break;
            }
            Ok(n) => {
                if to_ws_tx.send(SshEvent::Data(buf[..n].to_vec())).is_err() {
                    break;
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(e) => {
                error!("SSH read error: {}", e);
                break;
            }
        }

        match channel.stderr().read(&mut stderr_buf) {
            Ok(0) | Err(_) => {}
            Ok(n) => {
                if to_ws_tx.send(SshEvent::Data(stderr_buf[..n].to_vec())).is_err() {
                    break;
                }
            }
        }

        loop {
            match to_ssh_rx.try_recv() {
                Ok(SshCommand::Data(data)) => {
                    if channel.write_all(&data).is_err() {
                        need_close = true;
                        break;
                    }
                    let _ = channel.flush();
                }
                Ok(SshCommand::Resize { cols, rows }) => {
                    let _ = channel.request_pty_size(cols, rows, None, None);
                }
                Ok(SshCommand::Close) => {
                    need_close = true;
                    break;
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    need_close = true;
                    break;
                }
            }
        }
    }

    let _ = channel.close();
    let _ = channel.wait_close();
    info!("SSH session closed");
}
