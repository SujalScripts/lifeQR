const mongoose = require("mongoose");

const crewProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  vehicleNumber: {
    type: String,
    required: true
  },
  crewType: {
    type: String,
    enum: ['ambulance', 'fire', 'police', ''],
    required: true
  },
  station: {
    type: String,
    required: true
  },
  organization: {
    type: String,
    default: ''
  },
  currentLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  status: {
    type: String,
    enum: ['available', 'on_duty', 'dispatched', 'en_route', 'at_scene', 'transporting', 'off_duty'],
    default: 'on_duty'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("CrewProfile", crewProfileSchema);
