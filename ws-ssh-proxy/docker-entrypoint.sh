#!/bin/sh
set -e

if [ -n "$PORT" ]; then
    exec ws-ssh-proxy --port "$PORT"
else
    exec ws-ssh-proxy
fi
