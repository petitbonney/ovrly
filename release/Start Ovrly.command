#!/bin/bash
# Double-click launcher (macOS): runs the bundled Node on the server and opens the UI.
cd "$(dirname "$0")"
xattr -dr com.apple.quarantine . 2>/dev/null # files from a downloaded zip are blocked until this
(sleep 2; open http://localhost:6875) &
NODE_ENV=production ./node/node server/index.js
