const mongoose = require('mongoose');

const helpTicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requesterName: {
    type: String,
    required: true
  },
  requesterEmail: {
    type: String,
    required: true
  },
  requesterRole: {
    type: String,
    required: true,
    enum: ['doctor', 'crew', 'patient', 'hospital', 'admin']
  },
  patientQrCodeId: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true,
    enum: [
      'EMERGENCY_OVERRIDE',
      'MEDICATION_SAFETY',
      'IDENTITY_MISMATCH',
      'SYSTEM_TECHNICAL',
      'ACCOUNT_VERIFICATION',
      'MEDICAL_RECORD',
      'QR_BADGE',
      'PROFILE_UPDATE',
      'GENERAL_ASSISTANCE'
    ],
    default: 'GENERAL_ASSISTANCE'
  },
  priority: {
    type: String,
    required: true,
    enum: ['NORMAL', 'HIGH', 'CRITICAL'],
    default: 'NORMAL'
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'],
    default: 'PENDING'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

helpTicketSchema.index({ requesterId: 1 });
helpTicketSchema.index({ status: 1 });
helpTicketSchema.index({ priority: 1 });

module.exports = mongoose.model('HelpTicket', helpTicketSchema);
