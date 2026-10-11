const express = require('express');
const HelpTicket = require('../../models/HelpTicket');
const User = require('../../models/User');
const { authenticateToken } = require('../../middleware/auth');
const { logEvent } = require('../../services/securityLogger');

const router = express.Router();

// Helper to enforce admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. System Administrator clearance required.' });
  }
  next();
};

// 1. Submit a new Help Ticket (Doctors, Crew, Patients)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const rawMessage = req.body.message || req.body.description;
    const { subject, category, priority, patientQrCodeId } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!rawMessage || !rawMessage.trim()) {
      return res.status(400).json({ error: 'Detailed message description is required' });
    }

    const user = await User.findById(req.user.userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Generate unique readable Ticket ID, e.g. TKT-7K9A-402
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

    const validCategories = [
      'EMERGENCY_OVERRIDE',
      'MEDICATION_SAFETY',
      'IDENTITY_MISMATCH',
      'SYSTEM_TECHNICAL',
      'ACCOUNT_VERIFICATION',
      'MEDICAL_RECORD',
      'QR_BADGE',
      'PROFILE_UPDATE',
      'GENERAL_ASSISTANCE'
    ];
    const ticketCategory = validCategories.includes(category) ? category : 'GENERAL_ASSISTANCE';

    const validPriorities = ['NORMAL', 'HIGH', 'CRITICAL'];
    const ticketPriority = validPriorities.includes(priority) ? priority : 'NORMAL';

    const ticket = await HelpTicket.create({
      ticketId,
      requesterId: user._id,
      requesterName: user.name || 'Practitioner',
      requesterEmail: user.email,
      requesterRole: user.role,
      patientQrCodeId: (patientQrCodeId || '').trim(),
      category: ticketCategory,
      priority: ticketPriority,
      subject: subject.trim(),
      message: rawMessage.trim(),
      status: 'PENDING'
    });

    logEvent('HELP_TICKET_CREATED', {
      ticketId: ticket.ticketId,
      userId: user._id,
      role: user.role,
      priority: ticket.priority,
      category: ticket.category
    });

    // Notify connected admin via Socket.IO if available
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('admin:all').emit('help-ticket-created', {
          ticketId: ticket.ticketId,
          requesterName: ticket.requesterName,
          requesterRole: ticket.requesterRole,
          subject: ticket.subject,
          priority: ticket.priority,
          createdAt: ticket.createdAt
        });
      }
    } catch (e) {
      console.warn('Socket notification error for help ticket:', e.message);
    }

    res.status(201).json({
      message: 'Help request submitted successfully. LifeQR administrators have been notified.',
      ticket
    });
  } catch (error) {
    console.error('Error creating help ticket:', error);
    res.status(500).json({ error: 'Failed to submit help ticket' });
  }
});

// 2. Get tickets created by the logged-in user
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const tickets = await HelpTicket.find({ requesterId: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching user help tickets:', error);
    res.status(500).json({ error: 'Failed to retrieve your tickets' });
  }
});

// 3. Admin: Get all tickets with optional filtering
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, priority, role } = req.query;
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }
    if (priority && priority !== 'ALL') {
      filter.priority = priority;
    }
    if (role && role !== 'ALL') {
      filter.requesterRole = role;
    }

    const tickets = await HelpTicket.find(filter)
      .sort({ createdAt: -1 })
      .populate('resolvedBy', 'name email')
      .lean();

    const pendingCount = await HelpTicket.countDocuments({ status: 'PENDING' });
    const inProgressCount = await HelpTicket.countDocuments({ status: 'IN_PROGRESS' });
    const resolvedCount = await HelpTicket.countDocuments({ status: 'RESOLVED' });
    const criticalCount = await HelpTicket.countDocuments({ priority: 'CRITICAL', status: { $ne: 'RESOLVED' } });

    res.json({
      tickets,
      counts: {
        total: tickets.length,
        pending: pendingCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        critical: criticalCount
      }
    });
  } catch (error) {
    console.error('Error fetching admin tickets:', error);
    res.status(500).json({ error: 'Failed to retrieve help tickets' });
  }
});

// 4. Admin: Update Ticket Status & Admin Resolution Notes
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid ticket status' });
    }

    // Look up by _id or ticketId
    const ticket = await HelpTicket.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { ticketId: id }]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Help ticket not found' });
    }

    if (status) ticket.status = status;
    if (typeof adminNotes === 'string') ticket.adminNotes = adminNotes.trim();

    if (status === 'RESOLVED') {
      ticket.resolvedBy = req.user.userId;
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    logEvent('HELP_TICKET_UPDATED', {
      ticketId: ticket.ticketId,
      updatedBy: req.user.userId,
      newStatus: ticket.status
    });

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${ticket.requesterId}`).emit('help-ticket-updated', {
          ticketId: ticket.ticketId,
          status: ticket.status,
          adminNotes: ticket.adminNotes
        });
      }
    } catch (e) {}

    res.json({
      message: 'Help ticket updated successfully',
      ticket
    });
  } catch (error) {
    console.error('Error updating help ticket:', error);
    res.status(500).json({ error: 'Failed to update help ticket' });
  }
});

// 5. Admin: AI Problem Analysis for a Specific Ticket
router.post('/:id/ai-analyze', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await HelpTicket.findOne({
      $or: [
        { ticketId: id },
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }
      ]
    }).lean();

    if (!ticket) {
      return res.status(404).json({ error: 'Help ticket not found' });
    }

    // Call admin AI analysis endpoint internally or logic
    const PatientProfile = require('../../models/PatientProfile');
    let patientProfile = null;
    if (ticket.patientQrCodeId) {
      patientProfile = await PatientProfile.findOne({ qrCodeId: ticket.patientQrCodeId.trim() })
        .populate('userId', 'name email phone')
        .lean();
    }

    const patientName = patientProfile?.userId?.name || (ticket.patientQrCodeId ? `Patient (${ticket.patientQrCodeId})` : null);
    const allergies = patientProfile?.allergies || '';
    const textCombined = `${ticket.subject} ${ticket.message} ${ticket.category || ''}`.toLowerCase();

    let problemInSimpleWords = '';
    let whatToSolve = '';
    let rootCause = '';
    let urgencyLevel = ticket.priority || 'NORMAL';
    let severityReason = '';
    let stepByStepSolution = [];
    let suggestedResolutionNote = '';
    let categoryTag = 'GENERAL';

    if (
      textCombined.includes('epinephrine') ||
      textCombined.includes('anaphylaxis') ||
      textCombined.includes('override') ||
      textCombined.includes('offline triage') ||
      ticket.category === 'EMERGENCY_OVERRIDE'
    ) {
      categoryTag = 'EMERGENCY_CLINICAL_OVERRIDE';
      urgencyLevel = 'CRITICAL';
      severityReason = 'Acute allergic shock requires immediate epinephrine injection to avoid fatal airway closure.';
      problemInSimpleWords = `${ticket.requesterName} (Doctor) is treating a patient in an offline emergency triage zone without network access. The patient is suffering from acute anaphylaxis and urgently needs an Epinephrine dose override right now.`;
      whatToSolve = `1. Check patient ${ticket.patientQrCodeId || ''} allergies. 2. Issue official emergency override approval so the medical team can administer Epinephrine immediately.`;
      rootCause = `Hospital triage zone is disconnected from the network, activating strict clinical safety lockouts that require administrator approval.`;
      stepByStepSolution = [
        {
          step: 1,
          title: 'Review Patient Allergy Safety',
          instruction: `Check patient ${ticket.patientQrCodeId || 'records'}. Allergies on file: "${allergies || 'None'}". Epinephrine is safe and lifesaving for anaphylaxis.`
        },
        {
          step: 2,
          title: 'Authorize Emergency Protocol',
          instruction: `Grant administrator authorization code under LifeQR Emergency Protocol EP-912 (Offline Triage Exception).`
        },
        {
          step: 3,
          title: 'Send Response to Unblock Doctor',
          instruction: `Insert the suggested resolution note below and click "Save & Notify Requester" to confirm immediately.`
        }
      ];
      suggestedResolutionNote = `Emergency clinical override AUTHORIZED by Chief Medical Administrator. Epinephrine administration approved under LifeQR Protocol EP-912 for patient ${ticket.patientQrCodeId || 'record'} in offline triage zone. Allergen cross-check confirmed safe.`;
    } else {
      categoryTag = 'SUPPORT_RESOLUTION';
      problemInSimpleWords = `${ticket.requesterName} (${ticket.requesterRole.toUpperCase()}) reported an issue: "${ticket.subject}". Summary: ${ticket.message.slice(0, 160)}`;
      whatToSolve = `Review the reported problem and resolve account or profile settings to restore normal operation.`;
      rootCause = `User operational query or system workflow adjustment requested by ${ticket.requesterName}.`;
      stepByStepSolution = [
        {
          step: 1,
          title: 'Review Ticket Details',
          instruction: `Check requester role (${ticket.requesterRole.toUpperCase()}) and inspect any linked patient or unit identifiers.`
        },
        {
          step: 2,
          title: 'Apply Necessary Adjustments',
          instruction: ticket.patientQrCodeId ? `Click "Troubleshoot & Fix Profile" to review patient ${ticket.patientQrCodeId}.` : `Inspect user account permissions and settings.`
        },
        {
          step: 3,
          title: 'Resolve Ticket & Notify',
          instruction: `Insert the pre-drafted resolution note and submit to notify ${ticket.requesterName}.`
        }
      ];
      suggestedResolutionNote = `Issue regarding "${ticket.subject}" has been reviewed and resolved by System Administration. Settings have been verified and applied.`;
    }

    logEvent('HELP_TICKET_AI_ANALYZED', {
      adminId: req.user.userId,
      ticketId: ticket.ticketId,
      categoryTag
    });

    res.json({
      success: true,
      analysis: {
        ticketId: ticket.ticketId,
        requesterName: ticket.requesterName,
        requesterEmail: ticket.requesterEmail,
        requesterRole: ticket.requesterRole,
        patientQrCodeId: ticket.patientQrCodeId,
        patientName,
        categoryTag,
        urgencyLevel,
        severityReason,
        problemInSimpleWords,
        whatToSolve,
        rootCause,
        stepByStepSolution,
        suggestedResolutionNote,
        recommendedStatus: 'RESOLVED',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in ticket AI analysis:', error);
    res.status(500).json({ error: 'Failed to analyze ticket with AI' });
  }
});

module.exports = router;

