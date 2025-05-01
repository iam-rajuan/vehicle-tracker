const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
const DriverLocation = require('./models/DriverLocation');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/vehicleTracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/api/driver-locations', async (req, res) => {
  try {
    const locations = await DriverLocation.find();
    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).send('Server Error');
  }
});

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('locationUpdate', async ({ vehicleId, coords }) => {
    const { lat, lng } = coords;

    try {
      await DriverLocation.findOneAndUpdate(
        { vehicleId },
        { latitude: lat, longitude: lng },
        { upsert: true, new: true }
      );

      io.emit('locationUpdate', {
        vehicleId,
        coords: { lat, lng }
      });

      console.log(`Location updated: ${vehicleId} -> (${lat}, ${lng})`);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(4000, () => {
  console.log('Server listening on port 4000');
});


































// const express = require('express');
// const http = require('http');
// const mongoose = require('mongoose');
// const socketIo = require('socket.io');
// const cors = require('cors');

// // Models
// const DriverLocation = require('./models/DriverLocation'); // Import the DriverLocation model

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server, {
//   cors: { origin: "*" } // Allow all origins (adjust as necessary)
// });

// app.use(cors());  // Enable CORS for all origins
// app.use(express.json());  // Parse incoming requests with JSON payloads

// // MongoDB connection
// mongoose.connect('mongodb://localhost:27017/vehicleTracker', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log("MongoDB connected"))
//   .catch((err) => console.log("MongoDB connection error:", err));

// // API to get driver locations from MongoDB
// app.get('/api/driver-locations', async (req, res) => {
//   try {
//     const locations = await DriverLocation.find(); // Fetch all driver locations from MongoDB
//     res.json(locations);
//   } catch (error) {
//     console.error('Error fetching locations:', error);
//     res.status(500).send('Error fetching driver locations');
//   }
// });

// // Socket.IO connection for driver location updates
// io.on('connection', (socket) => {
//   console.log('Client connected');

//   socket.on('locationUpdate', async ({ vehicleId, coords }) => {
//     const { lat, lng } = coords;

//     try {
//       // Save location to MongoDB
//       const location = new DriverLocation({
//         vehicleId,
//         latitude: lat,
//         longitude: lng,
//       });
//       await location.save();

//       // Emit the location update to all connected clients
//       io.emit('locationUpdate', { vehicleId, coords });
//       console.log(`Location updated for vehicle ${vehicleId}: ${lat}, ${lng}`);
//     } catch (error) {
//       console.error('Error saving driver location:', error);
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected');
//   });
// });

// // Start the server
// server.listen(4000, () => {
//   console.log('Server listening on port 4000');
// });











// // backend/server.js
// const express = require('express');
// const mongoose = require('mongoose');
// const http = require('http');
// const socketIo = require('socket.io');
// const bodyParser = require('body-parser');
// const DriverLocation = require('./models/DriverLocation'); // Import the DriverLocation model

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server);

// // Middleware
// app.use(bodyParser.json());

// // Serve static files (optional)
// app.use(express.static('public'));

// // API to get driver locations
// app.get('/api/driver-locations', async (req, res) => {
//   try {
//     const locations = await DriverLocation.find();
//     res.json(locations);
//   } catch (error) {
//     console.error('Error fetching locations:', error);
//     res.status(500).send('Error fetching driver locations');
//   }
// });

// // Socket.io connection for driver location updates
// io.on('connection', (socket) => {
//   console.log('A driver connected');

//   socket.on('locationUpdate', async (data) => {
//     const { vehicleId, coords } = data;
//     const { lat, lng } = coords;

//     try {
//       const location = new DriverLocation({ vehicleId, latitude: lat, longitude: lng });
//       await location.save();
//       console.log(`Location updated for ${vehicleId}: ${lat}, ${lng}`);
//     } catch (error) {
//       console.error('Error saving driver location:', error);
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('A driver disconnected');
//   });
// });

// // MongoDB connection
// mongoose.connect('mongodb://localhost/vehicle-tracker', { useNewUrlParser: true, useUnifiedTopology: true });

// // Start the server
// server.listen(4000, () => {
//   console.log('Server is running on port 4000');
// });














// const express = require('express');
// const http = require('http');
// const mongoose = require('mongoose');
// const socketIo = require('socket.io');
// const cors = require('cors');

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server, {
//   cors: { origin: "*" }
// });

// app.use(cors());
// app.use(express.json());

// mongoose.connect('mongodb://localhost:27017/vehicleTracker', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log("MongoDB connected"));

// const vehicleLocations = {};

// io.on('connection', (socket) => {
//   console.log('Client connected');

//   socket.on('locationUpdate', ({ vehicleId, coords }) => {
//     vehicleLocations[vehicleId] = coords;
//     io.emit('locationUpdate', { vehicleId, coords });
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected');
//   });
// });

// server.listen(4000, () => {
//   console.log('Server listening on port 4000');
// });
