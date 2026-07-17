# Human Anomaly Detection — OpenCV Capture Service

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bimeshpoudel.com.np-facc15)](https://www.bimeshpoudel.com.np/human-anomaly-live-demo)
[![Node.js](https://img.shields.io/badge/Node.js-5fa04e?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![OpenCV](https://img.shields.io/badge/OpenCV-5c3ee8?logo=opencv)](https://opencv.org)
[![Docker](https://img.shields.io/badge/Docker-2496ed?logo=docker&logoColor=white)](https://www.docker.com)

Captures video (a physical webcam locally, or a looping sample clip when no
camera is available — e.g. on a cloud host) and forwards frames as a
socket.io client to the [backend](https://github.com/Amunet98/human-anomaly-detection-backend),
which runs inference and rebroadcasts to the frontend. This service does no
detection itself — it's capture-and-forward only.

It connects as `?role=producer` (authenticated by `PRODUCER_TOKEN`) and the
backend replies with `stream-control {active}` based on how many viewers are
connected — capture only runs while somebody is actually watching, so an
idle deployment streams nothing.

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
| `PRODUCER_TOKEN` | shared secret proving this is the real capture service — must match the backend's `PRODUCER_TOKEN` |

### No-camera fallback

Cloud hosts (Railway, Render, etc.) have no camera hardware. Drop a short,
license-clear demo clip at `sample.mp4` in this directory (or point
`SAMPLE_VIDEO_PATH` elsewhere) and the service will loop it instead, so a
deployed instance still has a live-looking feed to demo.

No `sample.mp4` is committed right now — the shared demo feed is
deliberately paused (sustained inference was exceeding the free tier's
memory); with no camera and no video file the service simply streams
nothing. Re-adding a clip re-enables it, no code changes needed.

## Deploying

Most PaaS buildpacks can't compile `@u4/opencv4nodejs` (it needs OpenCV's
system dev libraries). Use the included `Dockerfile` — both Railway and
Render support deploying from a Dockerfile directly (production runs on
Render, GitHub-connected: push to `main` auto-deploys). Set `BACKEND_URL`
to the deployed backend's URL and `PRODUCER_TOKEN` to the same value as the
backend, and include a `sample.mp4` (see above) since there's no camera in
the container.
