const mongoose = require("mongoose");

const ambulanceCrewSchema = new mongoose.Schema({
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
    enum: ['ambulance', 'paramedic', 'fire', 'police', 'emergency_response'],
    default: 'ambulance'
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

module.exports = mongoose.models.AmbulanceCrew || mongoose.model("AmbulanceCrew", ambulanceCrewSchema);
