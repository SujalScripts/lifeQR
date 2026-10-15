const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const User = require('../../models/User');
const PatientProfile = require('../../models/PatientProfile');
const EmergencyCredential = require('../../models/EmergencyCredential');
const { authenticateToken } = require('../../middleware/auth');
const { getFrontendUrl } = require('../../utils/frontendUrl');
const { logEvent } = require('../../services/securityLogger');
const { resolvePatientProfile } = require('../../utils/patientResolver');

const {
  buildOfflineEmergencyText
} = require('../../utils/offlineEmergencyQr');

const rateLimit = require('express-rate-limit');
const router = express.Router();

// Rate limiting for emergency token resolution (brute force protection)
const emergencyLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // allow up to 200 lookups per 15 minutes for rescuers & testing
  message: { error: "Too many emergency access attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildEmergencyUrl(token) {
  return `${getFrontendUrl()}/e/${token}`;
}

async function getPatientProfileWithUser(patientId) {
  return PatientProfile.findById(patientId).populate('userId', 'name gender phone address city state profilePhoto email');
}

async function buildEmergencyProfileDTO(profile, user) {
  let reports = [];
  try {
    if (Array.isArray(profile?.reports) && profile.reports.length > 0) {
      reports = profile.reports.map(r => ({
        id: r._id,
        title: r.originalName || r.filename || 'Medical Report',
        category: r.category || 'Diagnostic Report',
        recordDate: r.uploadedAt,
        fileUrl: r.url || `/uploads/${r.filename}`,
        description: r.description || ''
      }));
    }
    const MedicalRecord = require('../../models/MedicalRecord');
    const dbRecords = await MedicalRecord.find({
      $or: [{ userId: user?._id }, { patientProfileId: profile?._id }]
    }).sort({ recordDate: -1 }).limit(20).lean();
    if (dbRecords && dbRecords.length > 0) {
      const dbMapped = dbRecords.map(r => ({
        id: r._id,
        title: r.title,
        category: r.category,
        recordDate: r.recordDate,
        fileUrl: r.fileUrl,
        doctorOrHospital: r.doctorOrHospital,
        notes: r.notes
      }));
      reports = [...reports, ...dbMapped];
    }
  } catch (e) {
    console.warn('Could not populate medical records for emergency profile:', e.message);
  }

  const fullAddress = [user?.address, user?.city, user?.state].filter(Boolean).join(', ') || profile?.address || 'Address on file';

  return {
    photo: user?.profilePhoto || '',
    firstName: user?.name || '',
    name: user?.name || '',
    phone: user?.phone || profile?.phone || '',
    address: fullAddress,
    age: profile?.age || null,
    gender: user?.gender || '',
    bloodGroup: profile?.bloodGroup || '',
    allergies: Array.isArray(profile?.allergies) ? profile.allergies : (profile?.allergies ? String(profile.allergies).split(/,|\n/).map(x => x.trim()).filter(Boolean) : []),
    medicalConditions: Array.isArray(profile?.healthIssues) ? profile.healthIssues : (profile?.healthIssues ? String(profile.healthIssues).split(/,|\n/).map(x => x.trim()).filter(Boolean) : []),
    currentMedications: Array.isArray(profile?.medications) ? profile.medications : (profile?.medications ? String(profile.medications).split(/,|\n/).map(x => x.trim()).filter(Boolean) : []),
    emergencyContacts: (profile?.emergencyContacts || []).map(contact => ({
      name: contact?.name || '',
      phone: contact?.phone || '',
      relationship: contact?.relationship || ''
    })),
    qrCodeId: profile?.qrCodeId || '',
    patientId: profile?._id || '',
    medicalHistory: (profile?.medicalHistory || []).map(h => ({
      type: h.type || 'vital',
      title: h.title || '',
      description: h.description || '',
      timestamp: h.timestamp || h.createdAt || null,
      author: h.author?.name || 'Medical Responder'
    })),
    reports: reports,
    insuranceProvider: profile?.insuranceProvider || '',
    insurancePolicyNumber: profile?.insurancePolicyNumber || '',
    criticalWarnings: [],
    organDonor: profile?.emergencyViewSettings?.organDonor || profile?.organDonor || false,
    emergencyViewSettings: profile?.emergencyViewSettings || {
      themeColor: '#E11D2E',
      showAllergiesBanner: true,
      showBloodGroupLarge: true,
      showMedicationsPublicly: true,
      organDonor: profile?.organDonor || false,
      dnrDirective: 'FULL_CODE',
      emergencyBannerText: '',
      preferredLanguage: 'en',
      bystanderPhoneMasking: false
    },
    lastUpdatedAt: profile?.updatedAt || profile?.createdAt || null
  };
}

router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can manage emergency credentials' });
    }

    const patientProfile = await PatientProfile.findOne({ userId: user._id });
    if (!patientProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const rawToken = createToken();
    const tokenHash = hashToken(rawToken);
    const credential = await EmergencyCredential.create({
      patientId: patientProfile._id,
      credentialType: req.body?.credentialType || 'QR',
      tokenHash,
      tokenPrefix: 'EMG',
      status: 'ACTIVE',
      expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      metadata: {
        createdBy: user._id,
        label: req.body?.label || 'Primary Emergency Credential'
      }
    });

    const credentialUrl = buildEmergencyUrl(rawToken);
    // const qrCodeDataURL = await QRCode.toDataURL(credentialUrl, {
    //   errorCorrectionLevel: 'H',
    //   type: 'image/png',
    //   width: 300,
    //   margin: 2,
    //   color: { dark: '#000000', light: '#FFFFFF' }
    // });

    const offlineEmergencyText = buildOfflineEmergencyText({
      user,
      profile: patientProfile,
      qrCodeId: patientProfile.qrCodeId
    });

    const qrCodeDataURL = await QRCode.toDataURL(
      offlineEmergencyText,
      {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 600,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }
    );


    res.json({
      id: credential._id,
      credentialType: credential.credentialType,
      status: credential.status,
      token: rawToken,
      url: credentialUrl,
      qrCode: qrCodeDataURL,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt
    });
  } catch (error) {
    console.error('Error creating emergency credential:', error);
    res.status(500).json({ error: 'Failed to create emergency credential' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can view their emergency credentials' });
    }

    const patientProfile = await PatientProfile.findOne({ userId: user._id });
    if (!patientProfile) { 
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const credentials = await EmergencyCredential.find({ patientId: patientProfile._id }).sort({ createdAt: -1 });
    res.json(credentials);
  } catch (error) {
    console.error('Error listing emergency credentials:', error);
    res.status(500).json({ error: 'Failed to list emergency credentials' });
  }
});

router.post('/:id/revoke', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can manage emergency credentials' });
    }

    const patientProfile = await PatientProfile.findOne({ userId: user._id });
    const credential = await EmergencyCredential.findOne({ _id: req.params.id, patientId: patientProfile?._id });
    if (!credential) {
      return res.status(404).json({ error: 'Emergency credential not found' });
    }

    credential.status = 'REVOKED';
    credential.revokedAt = new Date();
    credential.revokedReason = req.body?.reason || 'Revoked by patient';
    await credential.save();

    res.json({ message: 'Emergency credential revoked', credential });
  } catch (error) {
    console.error('Error revoking emergency credential:', error);
    res.status(500).json({ error: 'Failed to revoke emergency credential' });
  }
});

router.post('/:id/report-lost', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can manage emergency credentials' });
    }

    const patientProfile = await PatientProfile.findOne({ userId: user._id });
    const credential = await EmergencyCredential.findOne({ _id: req.params.id, patientId: patientProfile?._id });
    if (!credential) {
      return res.status(404).json({ error: 'Emergency credential not found' });
    }

    credential.status = 'LOST';
    credential.revokedAt = new Date();
    credential.revokedReason = req.body?.reason || 'Reported lost';
    await credential.save();

    res.json({ message: 'Emergency credential marked as lost', credential });
  } catch (error) {
    console.error('Error reporting emergency credential lost:', error);
    res.status(500).json({ error: 'Failed to report credential as lost' });
  }
});

router.post('/:id/rotate', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can manage emergency credentials' });
    }

    const patientProfile = await PatientProfile.findOne({ userId: user._id });
    const credential = await EmergencyCredential.findOne({ _id: req.params.id, patientId: patientProfile?._id });
    if (!credential) {
      return res.status(404).json({ error: 'Emergency credential not found' });
    }

    const rawToken = createToken();
    credential.tokenHash = hashToken(rawToken);
    credential.status = 'ACTIVE';
    credential.revokedAt = null;
    credential.revokedReason = '';
    credential.expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    await credential.save();

    const credentialUrl = buildEmergencyUrl(rawToken);
    

    const offlineEmergencyText = buildOfflineEmergencyText({
      user,
      profile: patientProfile,
      qrCodeId: patientProfile.qrCodeId
    });

    const qrCodeDataURL = await QRCode.toDataURL(
      offlineEmergencyText,
      {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 600,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }
    );

    

    res.json({
      id: credential._id,
      credentialType: credential.credentialType,
      status: credential.status,
      token: rawToken,
      url: credentialUrl,
      qrCode: qrCodeDataURL,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt
    });
  } catch (error) {
    console.error('Error rotating emergency credential:', error);
    res.status(500).json({ error: 'Failed to rotate emergency credential' });
  }
});

router.get('/:token/photo', async (req, res) => {
  try {
    const token = req.params.token;
    const profile = await resolvePatientProfile(token, 'userId');
    if (!profile || !profile.userId) {
      return res.status(404).json({ error: 'Patient profile not found or emergency credential inactive' });
    }

    const photoUrl = profile.userId.profilePhoto || '';
    if (!photoUrl) {
      return res.status(404).json({ error: 'No emergency photo available' });
    }

    const securePhotoPath = path.join(__dirname, '../../uploads/photos', path.basename(photoUrl));
    if (!fs.existsSync(securePhotoPath)) {
      return res.status(404).json({ error: 'Emergency photo not found' });
    }

    res.sendFile(securePhotoPath);
  } catch (error) {
    console.error('Error serving emergency photo:', error);
    res.status(500).json({ error: 'Failed to serve emergency photo' });
  }
});

router.get('/:token', emergencyLookupLimiter, async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json({ error: 'Emergency token is required' });
    }

    const profile = await resolvePatientProfile(token, 'userId');
    if (!profile || !profile.userId) {
      return res.status(404).json({ error: 'Patient profile not found or emergency credential inactive' });
    }

    const credential = profile._matchedCredential || null;
    if (credential) {
      if (credential.expiresAt && new Date(credential.expiresAt) < new Date()) {
        credential.status = 'EXPIRED';
        await credential.save();
        return res.status(410).json({ error: 'Emergency credential has expired' });
      }
      credential.lastUsedAt = new Date();
      await credential.save();
    }

    const dto = await buildEmergencyProfileDTO(profile, profile.userId);
    logEvent('EMERGENCY_CREDENTIAL_ACCESS', {
      patientId: profile.userId._id || profile.userId,
      credentialId: credential?._id || profile.qrCodeId,
      credentialType: credential?.credentialType || 'QR',
      accessType: 'QR/NFC',
      timestamp: new Date().toISOString(),
      ipHash: crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex'),
      userAgent: req.get('user-agent') || '',
      authenticatedUserId: req.user?.userId || null,
      authenticatedRole: req.user?.role || null
    });

    res.json(dto);
  } catch (error) {
    console.error('Error resolving emergency access token:', error);
    res.status(500).json({ error: 'Failed to resolve emergency access token' });
  }
});

module.exports = router;
