#!/bin/bash
DECK_IP="192.168.178.30"
DECK_USER="deck"
REMOTE_DIR="/home/deck/flyff-wrapper"

rsync -av --exclude node_modules --exclude .git \
  ~/projects/flyff-wrapper/ \
  $DECK_USER@$DECK_IP:$REMOTE_DIR

echo "Sync fertig."
