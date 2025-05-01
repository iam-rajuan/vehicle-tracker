// models/DriverLocation.js
const mongoose = require('mongoose');

const driverLocationSchema = new mongoose.Schema({
  vehicleId: String,
  latitude: Number,
  longitude: Number,
});

const DriverLocation = mongoose.model('DriverLocation', driverLocationSchema);

module.exports = DriverLocation;
