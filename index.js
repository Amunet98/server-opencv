// importing OpenCv library
const cv = require("opencv4nodejs");
const path = require("path");
const express = require("express");
const app = express();
const server = require("http").Server(app);
const cors = require("cors");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

var corsOptions = {
  origin: "*",
};
app.use(cors(corsOptions));
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

// We will now create a video capture object.
const wCap = new cv.VideoCapture(0);

//Setting the height and width of object
wCap.set(cv.CAP_PROP_FRAME_WIDTH, 800);
wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 600);

// // Creating get request simple route
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "index.html"));
// });

//types for Violence
app.get("/types", async (req, res) => {
  try {
    console.log(req.query.group);
    if (req.query.group == null || undefined) {
      //   res.statusCode(400);
      res.send("error group pass not passed in params.");
    }
    var output;
    if (req.query.group == "v") {
      output = await prisma.anomaly_types.findMany({
        where: {
          group: "v",
        },
      });
      res.send(output);
      //   res.statusCode(200);
    } else if (req.query.group == "m") {
      output = await prisma.anomaly_types.findMany({
        where: {
          group: "m",
        },
      });
      res.send(output);
    } else if (req.query.group == "u") {
      output = await prisma.anomaly_types.findMany({
        where: {
          group: "u",
        },
      });
      res.send(output);
      //   res.statusCode(200);
    } else {
      res.send("pass group name");
      //   res.statusCode(200);
    }
  } catch (error) {
    console.log(error);
    res.errored("internal server error");
    // res.statusCode(500);
  }
});

// get all detections
app.get("/detected", async (req, res) => {
  const output = await prisma.detected_anomalies.findMany({
    orderBy: {
      time: "desc",
    },
    include: {
      anomaly_types: true,
    },
  });
  res.send(output);
});

// Using setInterval to read the image every one second.
setInterval(() => {
  // Reading image from video capture device
  const frame = wCap.read();

  // Encoding the image with base64.
  const image = cv.imencode(".jpg", frame).toString("base64");
  io.emit("image", image);
}, 10);

server.listen(5000);
