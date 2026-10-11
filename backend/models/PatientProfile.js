const mongoose = require("mongoose");

const patientProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  age: {
    type: Number,
    min: 0,
    max: 150
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
  },
  healthIssues: String,
  allergies: String,
  medications: String,
  emergencyContacts: [
    {
      name: String,
      phone: String,
      relationship: String,
      priority: {
        type: Number,
        default: 1
      }
    }
  ],
  qrCode: String,
  qrCodeId: {
    type: String,
    required: true,
    unique: true
  },
  lastLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  publicProfile: {
    type: Boolean,
    default: true
  },
  emergencyViewSettings: {
    themeColor: {
      type: String,
      default: '#E11D2E'
    },
    showAllergiesBanner: {
      type: Boolean,
      default: true
    },
    showBloodGroupLarge: {
      type: Boolean,
      default: true
    },
    showMedicationsPublicly: {
      type: Boolean,
      default: true
    },
    organDonor: {
      type: Boolean,
      default: false
    },
    dnrDirective: {
      type: String,
      enum: ['FULL_CODE', 'DNR', 'ADVANCE_DIRECTIVE', 'COMFORT_CARE'],
      default: 'FULL_CODE'
    },
    emergencyBannerText: {
      type: String,
      default: ''
    },
    preferredLanguage: {
      type: String,
      default: 'en'
    },
    bystanderPhoneMasking: {
      type: Boolean,
      default: false
    }
  },
  organDonor: {
    type: Boolean,
    default: false
  },
  insuranceProvider: String,
  insurancePolicyNumber: String,
  reports: [
    {
      filename: String,
      originalName: String,
      mimeType: String,
      url: String,
      category: String,
      description: String,
      uploadedAt: Date
    }
  ],
  activities: [
    {
      type: {
        type: String
      },
      title: String,
      description: String,
      metadata: mongoose.Schema.Types.Mixed,
      timestamp: Date
    }
  ],
  sosAlerts: [
    {
      status: {
        type: String,
        default: 'sent',
        enum: ['sent', 'acknowledged', 'dispatched', 'en_route', 'resolved']
      },
      location: {
        lat: Number,
        lng: Number
      },
      message: String,
      sentTo: [String],
      acknowledgedBy: {
        userId: mongoose.Schema.Types.ObjectId,
        name: String,
        phone: String,
        vehicleNumber: String,
        station: String,
        timestamp: Date
      },
      createdAt: Date
    }
  ],
  authorizedDoctors: [
    {
      doctorId: mongoose.Schema.Types.ObjectId,
      name: String,
      email: String,
      grantedAt: Date
    }
  ],
  medicalHistory: [
    {
      type: {
        type: String,
        enum: ['treatment', 'vital', 'symptom']
      },
      title: String,
      description: String,
      author: {
        userId: mongoose.Schema.Types.ObjectId,
        name: String,
        role: String
      },
      timestamp: Date
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model("PatientProfile", patientProfileSchema);
