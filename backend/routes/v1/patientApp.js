const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const User = require('../../models/User');
const PatientProfile = require('../../models/PatientProfile');
const EmergencyContact = require('../../models/EmergencyContact');
const QRProfile = require('../../models/QRProfile');
const MedicalRecord = require('../../models/MedicalRecord');
const EmergencyCredential = require('../../models/EmergencyCredential');
const { authenticateToken } = require('../../middleware/auth');
const { getFrontendUrl } = require('../../utils/frontendUrl');
const { logEvent } = require('../../services/securityLogger');

const {
  buildOfflineEmergencyText
} = require('../../utils/offlineEmergencyQr');
const router = express.Router();

// Helper to generate a clean, secure QR code identifier
async function generateSecureQrCodeId(name) {
  let prefix = (name && typeof name === 'string') 
    ? name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) 
    : 'LQR';
  if (!prefix) prefix = 'LQR';

  let id;
  let exists = null;
  do {
    const randomSeg = crypto.randomBytes(4).toString('hex').toUpperCase();
    id = `${prefix}-${randomSeg}`;
    exists = await PatientProfile.findOne({ qrCodeId: id });
    if (!exists) {
      exists = await QRProfile.findOne({ qrCodeId: id });
    }
  } while (exists);
  return id;
}

// 1. GET Full Patient Profile & App State
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let profile = await PatientProfile.findOne({ userId: user._id });
    
    // Get emergency contacts from standalone model
    let contacts = await EmergencyContact.find({ userId: user._id }).sort({ priority: 1, createdAt: 1 });
    
    // Fallback sync if contacts only existed in legacy array
    if (contacts.length === 0 && profile && profile.emergencyContacts && profile.emergencyContacts.length > 0) {
      for (const c of profile.emergencyContacts) {
        if (c.name && c.phone) {
          const newC = await EmergencyContact.create({
            userId: user._id,
            patientProfileId: profile._id,
            name: c.name,
            phone: c.phone,
            relationship: c.relationship || 'Other',
            isPrimary: c.priority === 1
          });
          contacts.push(newC);
        }
      }
    }

    // Get QR profile
    let qrProfile = await QRProfile.findOne({ userId: user._id });
    
    // If QRProfile doesn't exist yet, create or sync it
    if (!qrProfile) {
      let qrCodeId = profile ? profile.qrCodeId : null;
      if (!qrCodeId) {
        qrCodeId = await generateSecureQrCodeId(user.name);
      }
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Create EmergencyCredential
      await EmergencyCredential.create({
        tokenHash,
        patientId: user._id,
        qrCodeId,
        status: 'ACTIVE'
      });

      const frontendUrl = getFrontendUrl();
      const emergencyUrl = `${frontendUrl}/e/${rawToken}`;
      const qrDataUrl = await QRCode.toDataURL(emergencyUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 400,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });

      qrProfile = await QRProfile.create({
        userId: user._id,
        patientProfileId: profile ? profile._id : null,
        qrCodeId,
        qrToken: rawToken,
        qrImageUrl: qrDataUrl,
        publicFields: {
          showBloodGroup: true,
          showAllergies: true,
          showMedications: true,
          showConditions: true,
          showContacts: true,
          showDoctorNotes: false
        }
      });

      if (profile && !profile.qrCodeId) {
        profile.qrCodeId = qrCodeId;
        profile.qrCode = qrDataUrl;
        await profile.save();
      }
    }


    // PHASE 1: Generate an offline-readable emergency QR snapshot.
    const offlineEmergencyText = buildOfflineEmergencyText({
      user,
      profile,
      contacts,
      qrCodeId: qrProfile.qrCodeId
    });

    const offlineQrDataUrl = await QRCode.toDataURL(
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

    // Store the latest generated QR image.
    qrProfile.qrImageUrl = offlineQrDataUrl;
    await qrProfile.save();

    // Keep the legacy patient-profile QR field in sync.
    // if (profile) {
    //   profile.qrCode = offlineQrDataUrl;
    //   await profile.save();
    // }
    

    // Get medical records
    const records = await MedicalRecord.find({ userId: user._id }).sort({ recordDate: -1, createdAt: -1 });

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        isPhoneVerified: user.isPhoneVerified || false,
        isProfileComplete: user.isProfileComplete || (!!profile && !!profile.bloodGroup)
      },
      profile: profile || {},
      contacts,
      qrProfile: {
        qrCodeId: qrProfile.qrCodeId,
        qrImageUrl: qrProfile.qrImageUrl,
        publicFields: qrProfile.publicFields,
        scanCount: qrProfile.scanCount,
        lastScannedAt: qrProfile.lastScannedAt,
        emergencyAccessUrl: `${getFrontendUrl()}/e/${qrProfile.qrToken}`
      },
      records
    });
  } catch (error) {
    console.error('Fetch patient profile error:', error);
    res.status(500).json({ error: 'Failed to load profile data' });
  }
});

// 2. POST Save / Update Medical Profile
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const {
      age,
      bloodGroup,
      allergies,
      medications,
      healthIssues,
      gender,
      phone
    } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (gender) user.gender = gender.toLowerCase();
    if (phone) user.phone = phone.trim();

    let profile = await PatientProfile.findOne({ userId: user._id });
    let qrProfile = await QRProfile.findOne({ userId: user._id });

    if (!profile) {
      const qrCodeId = qrProfile ? qrProfile.qrCodeId : await generateSecureQrCodeId(user.name);
      const rawToken = qrProfile ? qrProfile.qrToken : crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      if (!qrProfile) {
        await EmergencyCredential.create({
          tokenHash,
          patientId: user._id,
          qrCodeId,
          status: 'ACTIVE'
        });

        const frontendUrl = getFrontendUrl();
        const emergencyUrl = `${frontendUrl}/e/${rawToken}`;
        const qrDataUrl = await QRCode.toDataURL(emergencyUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 400,
          color: { dark: '#0f172a', light: '#ffffff' }
        });

        qrProfile = await QRProfile.create({
          userId: user._id,
          qrCodeId,
          qrToken: rawToken,
          qrImageUrl: qrDataUrl
        });
      }

      profile = new PatientProfile({
        userId: user._id,
        age: age ? Number(age) : undefined,
        bloodGroup: bloodGroup || '',
        allergies: allergies || '',
        medications: medications || '',
        healthIssues: healthIssues || '',
        qrCodeId,
        qrCode: qrProfile.qrImageUrl
      });
    } else {
      if (age !== undefined) profile.age = Number(age);
      if (bloodGroup !== undefined) profile.bloodGroup = bloodGroup;
      if (allergies !== undefined) profile.allergies = allergies;
      if (medications !== undefined) profile.medications = medications;
      if (healthIssues !== undefined) profile.healthIssues = healthIssues;
    }

    await profile.save();

    user.isProfileComplete = true;
    await user.save();

    if (qrProfile && !qrProfile.patientProfileId) {
      qrProfile.patientProfileId = profile._id;
      await qrProfile.save();
    }

    logEvent('PROFILE_UPDATED', { userId: user._id });

    res.json({
      success: true,
      message: 'Medical profile saved successfully',
      profile,
      isProfileComplete: true
    });
  } catch (error) {
    console.error('Save medical profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to save profile' });
  }
});

// 3. GET / QR Code Badge & Scan Stats
router.get('/qr', authenticateToken, async (req, res) => {
  try {
    let qrProfile = await QRProfile.findOne({ userId: req.user.userId });
    const user = await User.findById(req.user.userId);
    const profile = await PatientProfile.findOne({ userId: req.user.userId });

    if (!qrProfile) {
      const qrCodeId = profile && profile.qrCodeId ? profile.qrCodeId : await generateSecureQrCodeId(user.name);
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await EmergencyCredential.create({
        tokenHash,
        patientId: user._id,
        qrCodeId,
        status: 'ACTIVE'
      });

      const frontendUrl = getFrontendUrl();
      const emergencyUrl = `${frontendUrl}/e/${rawToken}`;
      const qrDataUrl = await QRCode.toDataURL(emergencyUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 400,
        color: { dark: '#0f172a', light: '#ffffff' }
      });

      qrProfile = await QRProfile.create({
        userId: user._id,
        patientProfileId: profile ? profile._id : null,
        qrCodeId,
        qrToken: rawToken,
        qrImageUrl: qrDataUrl
      });
    }


    // PHASE 1: Refresh the offline QR using the latest profile.
    const emergencyContacts = await EmergencyContact.find({
      userId: user._id
    }).sort({ priority: 1, createdAt: 1 });

    const offlineEmergencyText = buildOfflineEmergencyText({
      user,
      profile,
      contacts: emergencyContacts,
      qrCodeId: qrProfile.qrCodeId
    });

    const offlineQrDataUrl = await QRCode.toDataURL(
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

    qrProfile.qrImageUrl = offlineQrDataUrl;
    await qrProfile.save();

    // if (profile) {
    //   profile.qrCode = offlineQrDataUrl;
    //   await profile.save();
    // }
  

    res.json({
      success: true,
      qrProfile: {
        qrCodeId: qrProfile.qrCodeId,
        qrImageUrl: qrProfile.qrImageUrl,
        emergencyAccessUrl: `${getFrontendUrl()}/e/${qrProfile.qrToken}`,
        publicFields: qrProfile.publicFields,
        scanCount: qrProfile.scanCount,
        lastScannedAt: qrProfile.lastScannedAt
      },
      patient: {
        name: user.name,
        bloodGroup: profile ? profile.bloodGroup : 'N/A',
        allergies: profile ? profile.allergies : 'None recorded'
      }
    });
  } catch (error) {
    console.error('Get QR profile error:', error);
    res.status(500).json({ error: 'Failed to load QR badge details' });
  }
});

// 4. Contacts CRUD
router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const contacts = await EmergencyContact.find({ userId: req.user.userId }).sort({ priority: 1, createdAt: 1 });
    res.json({ success: true, contacts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load contacts' });
  }
});

router.post('/contacts', authenticateToken, async (req, res) => {
  try {
    const { name, phone, relationship, isPrimary } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    if (isPrimary) {
      // Unset previous primary contact
      await EmergencyContact.updateMany({ userId: req.user.userId }, { isPrimary: false });
    }

    const contactCount = await EmergencyContact.countDocuments({ userId: req.user.userId });

    const contact = await EmergencyContact.create({
      userId: req.user.userId,
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship || 'Other',
      isPrimary: isPrimary || contactCount === 0,
      priority: isPrimary ? 1 : contactCount + 1
    });

    logEvent('CONTACT_ADDED', { userId: req.user.userId, contactId: contact._id });

    res.status(201).json({ success: true, message: 'Emergency contact added', contact });
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'Failed to add emergency contact' });
  }
});

router.put('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const { name, phone, relationship, isPrimary } = req.body;
    const contact = await EmergencyContact.findOne({ _id: req.params.id, userId: req.user.userId });
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (isPrimary) {
      await EmergencyContact.updateMany({ userId: req.user.userId }, { isPrimary: false });
      contact.isPrimary = true;
      contact.priority = 1;
    }

    if (name) contact.name = name.trim();
    if (phone) contact.phone = phone.trim();
    if (relationship) contact.relationship = relationship;

    await contact.save();

    res.json({ success: true, message: 'Emergency contact updated', contact });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const contact = await EmergencyContact.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true, message: 'Emergency contact removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// 5. Medical Records CRUD
router.get('/records', authenticateToken, async (req, res) => {
  try {
    const records = await MedicalRecord.find({ userId: req.user.userId }).sort({ recordDate: -1, createdAt: -1 });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch medical records' });
  }
});

router.post('/records', authenticateToken, async (req, res) => {
  try {
    const { title, category, doctorOrHospital, recordDate, notes, fileUrl } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required for medical record' });
    }

    const record = await MedicalRecord.create({
      userId: req.user.userId,
      title: title.trim(),
      category: category || 'Lab Report',
      doctorOrHospital: doctorOrHospital ? doctorOrHospital.trim() : '',
      recordDate: recordDate ? new Date(recordDate) : new Date(),
      notes: notes ? notes.trim() : '',
      fileUrl: fileUrl || ''
    });

    logEvent('MEDICAL_RECORD_ADDED', { userId: req.user.userId, recordId: record._id });

    res.status(201).json({ success: true, message: 'Medical record added', record });
  } catch (error) {
    console.error('Add medical record error:', error);
    res.status(500).json({ error: 'Failed to add medical record' });
  }
});

router.delete('/records/:id', authenticateToken, async (req, res) => {
  try {
    const record = await MedicalRecord.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ success: true, message: 'Medical record removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// 6. Settings & Privacy update
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { publicProfile, publicFields } = req.body;

    let profile = await PatientProfile.findOne({ userId: req.user.userId });
    if (profile && typeof publicProfile === 'boolean') {
      profile.publicProfile = publicProfile;
      await profile.save();
    }

    let qrProfile = await QRProfile.findOne({ userId: req.user.userId });
    if (qrProfile && publicFields) {
      qrProfile.publicFields = {
        ...qrProfile.publicFields,
        ...publicFields
      };
      await qrProfile.save();
    }

    logEvent('SETTINGS_UPDATED', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        publicProfile: profile ? profile.publicProfile : true,
        publicFields: qrProfile ? qrProfile.publicFields : {}
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
