const mongoose = require("mongoose");

const hospitalProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  hospitalName: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  staffRole: {
    type: String,
    required: true,
    trim: true
  },
  staffId: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.HospitalProfile || mongoose.model("HospitalProfile", hospitalProfileSchema);
