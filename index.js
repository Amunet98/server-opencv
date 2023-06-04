// importing OpenCv library
const cv = require('opencv4nodejs');
const path = require('path')
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);



// We will now create a video capture object.
const wCap = new cv.VideoCapture(0);

//Setting the height and width of object
wCap.set(cv.CAP_PROP_FRAME_WIDTH, 800);
wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 600);

// Creating get request simple route
app.get('/', (req, res)=>{
	res.sendFile(path.join(__dirname, 'index.html'));
});

// Using setInterval to read the image every one second.
setInterval(()=>{

	// Reading image from video capture device
	const frame = wCap.read();

	// Encoding the image with base64.
	const image = cv.imencode('.jpg', frame).toString('base64');
	io.emit('image', image);
}, 10)

server.listen(5000);
