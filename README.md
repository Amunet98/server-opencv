# Human Anomaly Detection — OpenCV Capture Service

Captures video (a physical webcam locally, or a looping sample clip when no
camera is available — e.g. on a cloud host) and forwards frames as a
socket.io client to the [backend](https://github.com/Amunet98/human-anomaly-detection-backend),
which runs inference and rebroadcasts to the frontend. This service does no
detection itself — it's capture-and-forward only.

## Setup

```bash
npm install     # builds the native @u4/opencv4nodejs binding against system OpenCV
npm start
```

`@u4/opencv4nodejs` needs OpenCV available on the machine (via pkg-config) to
build its native binding — see that package's docs if `npm install` fails to
build it.

### Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | where to forward captured frames (defaults to `http://localhost:8081`) |
| `PORT` | health-check route port (default `5000`) |
| `SAMPLE_VIDEO_PATH` | path to a video file to loop when no camera is attached (defaults to `sample.mp4` next to `index.js`) |

### No-camera fallback

Cloud hosts (Railway, Render, etc.) have no camera hardware. Drop a short,
license-clear demo clip at `sample.mp4` in this directory (or point
`SAMPLE_VIDEO_PATH` elsewhere) and the service will loop it instead, so a
deployed instance still has a live-looking feed to demo.

## Deploying

Most PaaS buildpacks can't compile `@u4/opencv4nodejs` (it needs OpenCV's
system dev libraries). Use the included `Dockerfile` — both Railway and
Render support deploying from a Dockerfile directly. Set `BACKEND_URL` to
the deployed backend's URL, and include a `sample.mp4` (see above) since
there's no camera in the container.
