require('dotenv').config();

// importing OpenCv library
const cv = require("@u4/opencv4nodejs");
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { io: ioClient } = require("socket.io-client");

// Prisma stays OFF here on purpose - enabling it in this service previously
// caused segfaults on Fedora (native opencv4nodejs binary + Prisma's native
// engine binary fighting in the same process). Detected-anomaly writes go
// through the backend instead (see the socket 'detected' emit below), which
// has its own healthy Prisma client.
// const { PrismaClient } = require("@prisma/client");
// const prisma = new PrismaClient();

// This service only exposes a status page (no sensitive data), but lock
// CORS down anyway for consistency with the backend's policy.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?bimeshpoudel\.com\.np$/,
  /^https:\/\/frontend-new-[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];
var corsOptions = {
  origin: (origin, callback) => {
    callback(null, !origin || ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)));
  },
};
app.use(cors(corsOptions));

// --- THE ACTUAL LIVE-STREAM BUG ---
// This service used to open its OWN socket.io *server* on port 5000 and
// broadcast frames to whoever connected to it. But nothing connects to
// port 5000 anymore - the frontend only connects to the backend's socket.
// So frames were being emitted into a room with no listeners.
// Fix: this service now connects to the backend as a socket.io *client*
// and forwards frames to it, matching what the backend already expects
// (it listens for 'data' and rebroadcasts as 'frame').
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";
// role=producer lets the backend tell this connection apart from real
// viewer connections, so it only counts actual site visitors when deciding
// whether anyone's watching (see 'stream-control' below).
// Pairs with PRODUCER_TOKEN on the backend - proves this connection is the
// real capture service, not just anyone sending ?role=producer. No-op until
// PRODUCER_TOKEN is set to a matching value on both services.
const socket = ioClient(BACKEND_URL, {
  transports: ["websocket", "polling"],
  query: { role: "producer", token: process.env.PRODUCER_TOKEN || "" },
});

socket.on("connect", () => {
  console.log(`🔌 Connected to backend at ${BACKEND_URL}`);
});
socket.on("disconnect", () => {
  console.log("🔌 Disconnected from backend, will auto-reconnect");
  stopStreaming();
});
socket.on("connect_error", (err) => {
  console.log("⚠️  Could not reach backend:", err.message);
});
// Backend tells us whether any real viewer is currently connected - only
// capture/send frames while someone's actually watching, instead of
// streaming 24/7 into an empty room.
socket.on("stream-control", ({ active }) => {
  if (active) startStreaming();
  else stopStreaming();
});

// --- Camera capture ---
// IMPORTANT: cv.VideoCapture(0) opens a physical camera device attached to
// whatever machine runs this process. That's fine on your own laptop/desktop.
// It will NOT work on Railway, Render, or any other cloud host - those
// servers have no camera hardware, and this will fail to open a device.
// Wrapped in try/catch so it fails with a clear log instead of crashing.
//
// Fallback: if no camera is available, loop a bundled sample video instead
// (SAMPLE_VIDEO_PATH, defaults to sample.mp4 next to this file) so a cloud
// deployment still has something to stream for the demo.
const SAMPLE_VIDEO_PATH = process.env.SAMPLE_VIDEO_PATH || path.join(__dirname, "sample.mp4");

let wCap;
let usingSampleVideo = false;
try {
  wCap = new cv.VideoCapture(0, cv.CAP_V4L2);
  wCap.set(cv.CAP_PROP_FRAME_WIDTH, 800);
  wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 600);
  console.log("📷 Camera opened successfully");
} catch (err) {
  console.log("❌ Could not open camera device 0:", err.message);
  if (fs.existsSync(SAMPLE_VIDEO_PATH)) {
    try {
      wCap = new cv.VideoCapture(SAMPLE_VIDEO_PATH);
      usingSampleVideo = true;
      console.log(`🎬 No camera - looping sample video instead: ${SAMPLE_VIDEO_PATH}`);
    } catch (videoErr) {
      console.log("❌ Could not open sample video either:", videoErr.message);
      wCap = null;
    }
  } else {
    console.log(`   No camera and no sample video at ${SAMPLE_VIDEO_PATH}.`);
    console.log("   Drop a short, license-clear demo clip there (or set SAMPLE_VIDEO_PATH) to get a working feed on hosts with no camera.");
    wCap = null;
  }
}

app.get("/", (req, res) => {
  if (!wCap) return res.send("OpenCV camera service - no camera or sample video available");
  res.send(usingSampleVideo ? "OpenCV camera service - streaming sample video (no camera attached)" : "OpenCV camera service - camera active");
});

// Read and forward one camera (or sample video) frame to the backend.
function captureAndSendFrame() {
  try {
    let frame = wCap.read();
    // Sample video reached its end - loop back to the first frame instead
    // of leaving the stream frozen.
    if (usingSampleVideo && frame.empty) {
      wCap.set(cv.CAP_PROP_POS_FRAMES, 0);
      frame = wCap.read();
    }
    if (!frame.empty) {
      // Lower JPEG quality (default is ~95) cuts both encode time and
      // payload size substantially with little visible difference at
      // this resolution - on a CPU-throttled host, less work per frame
      // means more frames survive each burst-credit window.
      const image = cv.imencode(".jpg", frame, [cv.IMWRITE_JPEG_QUALITY, 60]).toString("base64");
      socket.emit("data", image);
    }
  } catch (err) {
    console.log("⚠️  Frame read failed:", err.message);
  }
}

// 40ms (25 FPS) is fine on real hardware with a real camera, but on a
// CPU-throttled free-tier host it makes each tick's read+encode+emit fall
// behind the timer, so frames arrive in stalled bursts instead of smoothly.
// FRAME_INTERVAL_MS lets a constrained deployment ask for a lower, steadier
// frame rate instead.
const FRAME_INTERVAL_MS = parseInt(process.env.FRAME_INTERVAL_MS, 10) || 40;
let captureInterval = null;

// Only runs while the backend says a real viewer is connected (see the
// 'stream-control' handler above) - streaming 24/7 into an empty room was
// the biggest single chunk of this service's Render bandwidth.
function startStreaming() {
  if (!wCap || captureInterval) return;
  console.log('▶️  Viewer connected - starting frame stream');
  captureInterval = setInterval(captureAndSendFrame, FRAME_INTERVAL_MS);
}

function stopStreaming() {
  if (!captureInterval) return;
  console.log('⏸️  No viewers - pausing frame stream');
  clearInterval(captureInterval);
  captureInterval = null;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📷 OpenCV Camera Service active on port ${PORT}`);
});
