FROM node:20-bookworm

# @u4/opencv4nodejs needs OpenCV's dev headers/libs to build its native
# binding against - installing the distro package is far faster than letting
# it build OpenCV from source.
RUN apt-get update && apt-get install -y --no-install-recommends \
	libopencv-dev \
	pkg-config \
	build-essential \
	python3 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# No camera hardware in a container - drop a sample.mp4 here (see README)
# for the fallback "live" feed to work when deployed.

CMD ["node", "index.js"]
