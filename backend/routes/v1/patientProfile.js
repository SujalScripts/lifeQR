const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');
const User = require('../../models/User');
const PatientProfile = require('../../models/PatientProfile');
const DoctorProfile = require('../../models/DoctorProfile');
const EmergencyCredential = require('../../models/EmergencyCredential');
const CrewProfile = require('../../models/CrewProfile');
const { resolvePatientProfile } = require('../../utils/patientResolver');
const { authenticateToken } = require('../../middleware/auth');
const { getFrontendUrl } = require('../../utils/frontendUrl');
const { logEvent } = require('../../services/securityLogger');
const { sendEmail } = require('../../services/emailService');

const router = express.Router();

const photosDir = path.join(__dirname, '../../uploads/photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// Multer storage configuration for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, photosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.userId}_profile_${Date.now()}${ext}`);
  }
});

const uploadPhoto = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and JPG images are allowed.'), false);
    }
    cb(null, true);
  }
});

async function ensureEmergencyCredential(profile, req) {
  let credential = await EmergencyCredential.findOne({ patientId: profile._id, status: 'ACTIVE' }).sort({ createdAt: -1 });
  const frontendUrl = getFrontendUrl(req);

  if (!credential) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const credentialHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    credential = await EmergencyCredential.create({
      patientId: profile._id,
      credentialType: 'QR',
      tokenHash: credentialHash,
      tokenPrefix: 'EMG',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      metadata: { createdBy: profile.userId, label: 'Primary Emergency Credential' }
    });
  }

  // Ensure QR code is present and points to accessible emergency URL
  const qrUrl = `${frontendUrl}/emergency_access.html?id=${profile.qrCodeId}`;
  const qrCodeDataURL = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  profile.qrCode = qrCodeDataURL;
  await profile.save();
  if (profile.userId) {
    await User.findByIdAndUpdate(profile.userId, { qrCode: qrCodeDataURL, qrCodeId: profile.qrCodeId });
  }
  return credential;
}

// Authenticated photo access for the current patient
router.get('/photo', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.profilePhoto) {
      return res.status(404).json({ error: 'No profile photo available' });
    }

    const filename = path.basename(user.profilePhoto);
    const filePath = path.join(photosDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Profile photo not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving authenticated profile photo:', error);
    res.status(500).json({ error: 'Failed to serve profile photo' });
  }
});

// Get patient profile photo by qrCodeId for responders
router.get('/profile/:qrCodeId/photo', async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const profile = await resolvePatientProfile(qrCodeId, 'userId');
    if (!profile || !profile.userId) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const photoUrl = profile.userId.profilePhoto;
    if (!photoUrl) {
      return res.status(404).json({ error: 'No profile photo registered' });
    }

    const filename = path.basename(photoUrl);
    const filePath = path.join(photosDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Profile photo file not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving patient triage photo:', error);
    res.status(500).json({ error: 'Failed to serve photo' });
  }
});

// Get emergency profile access by qrCodeId (Used by rescuers - NO auth required)
router.get('/profile/:qrCodeId', async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    
    // Find patient profile and populate base user fields
    const patientProfile = await resolvePatientProfile(qrCodeId, 'userId');
    
    if (!patientProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const patient = patientProfile.userId;
    if (!patient) {
      return res.status(404).json({ error: 'Base user account not found for this profile' });
    }

    // Log anonymous scan event
    logEvent('EMERGENCY_QR_SCANNED', { qrCodeId: patientProfile.qrCodeId, patientId: patient._id });

    // Record activity in patient history
    patientProfile.activities.unshift({
      type: 'Anonymous Scan',
      title: 'Emergency Access Scanned',
      description: 'Your medical QR code was scanned by an emergency responder.',
      timestamp: new Date()
    });
    await patientProfile.save();

    // Trigger email alert to patient notifying them of a scan
    if (patient.email) {
      sendEmail({
        to: patient.email,
        subject: '⚠️ LifeQR Code Scanned!',
        text: `Hello ${patient.name},\n\nYour LifeQR medical profile was just accessed/scanned. If this was an emergency, responders now have access to your health details.\n\nIf you did not authorize this scan, please check your account dashboard activity log.`,
        html: `<p>Hello ${patient.name},</p><p>⚠️ <strong>Your LifeQR medical profile was just scanned.</strong></p><p>If this was an emergency, responders now have access to your critical medical details.</p><p>If this was not you, please log in to check your account activity log.</p>`
      }).catch(err => console.error('Failed to dispatch scan alert email:', err));
    }

    // Resolve most recent location (from lastLocation or latest SOS alert)
    const resolvedLocation = (patientProfile.lastLocation && typeof patientProfile.lastLocation.lat === 'number' && typeof patientProfile.lastLocation.lng === 'number' && (patientProfile.lastLocation.lat !== 0 || patientProfile.lastLocation.lng !== 0))
      ? patientProfile.lastLocation
      : (patientProfile.sosAlerts && patientProfile.sosAlerts.length > 0 && patientProfile.sosAlerts[0].location && typeof patientProfile.sosAlerts[0].location.lat === 'number')
        ? { lat: patientProfile.sosAlerts[0].location.lat, lng: patientProfile.sosAlerts[0].location.lng, updatedAt: patientProfile.sosAlerts[0].createdAt }
        : null;

    const patientAddress = patient.address || patientProfile.address || '';

    // If profile is set to private, restrict sensitive data fields
    if (!patientProfile.publicProfile) {
      return res.json({
        qrCodeId: patientProfile.qrCodeId,
        name: patient.name,
        gender: patient.gender,
        age: patientProfile.age,
        bloodGroup: patientProfile.bloodGroup,
        emergencyContacts: patientProfile.emergencyContacts,
        phone: patient.phone,
        profilePhoto: patient.profilePhoto,
        address: patientAddress,
        lastLocation: resolvedLocation,
        privateProfile: true,
        message: 'This profile is set to private. Only emergency details and contacts are visible.'
      });
    }

    // Return full public-safe fields
    res.json({
      qrCodeId: patientProfile.qrCodeId,
      name: patient.name,
      gender: patient.gender,
      age: patientProfile.age,
      bloodGroup: patientProfile.bloodGroup,
      allergies: patientProfile.allergies,
      healthIssues: patientProfile.healthIssues,
      medications: patientProfile.medications,
      emergencyContacts: patientProfile.emergencyContacts,
      phone: patient.phone,
      profilePhoto: patient.profilePhoto,
      address: patientAddress,
      lastLocation: resolvedLocation,
      reports: patientProfile.reports || [],
      medicalHistory: patientProfile.medicalHistory || [],
      privateProfile: false
    });
  } catch (error) {
    console.error('Error fetching emergency patient profile:', error);
    res.status(500).json({ error: 'Failed to fetch emergency profile data' });
  }
});

// Log scan event from triage search
router.post('/log-scan/:qrCodeId', async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const profile = await resolvePatientProfile(qrCodeId);
    if (profile) {
      const { lat, lng } = req.body || {};
      if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
        profile.lastLocation = {
          lat,
          lng,
          updatedAt: new Date()
        };
        await profile.save();
      }
      logEvent('PATIENT_QR_LOGGED_SCAN', { qrCodeId: profile.qrCodeId, patientId: profile.userId, lat, lng });
    }
    res.json({ message: 'Scan logged successfully', lastLocation: profile?.lastLocation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log scan event' });
  }
});

// Get currently logged-in user full profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let profileData = null;

    if (user.role === 'patient') {
      profileData = await PatientProfile.findOne({ userId: user._id });
      if (!profileData) {
        const rawUser = await mongoose.connection.collection('users').findOne({ _id: user._id });
        const contacts = [];
        if (rawUser && rawUser.emergencyContact && rawUser.emergencyContact.phone) {
          contacts.push({
            name: rawUser.emergencyContact.name || 'Emergency Contact',
            phone: rawUser.emergencyContact.phone,
            relationship: rawUser.emergencyContact.relationship || 'Next of Kin',
            priority: 1
          });
        }
        profileData = await PatientProfile.create({
          userId: user._id,
          qrCodeId: rawUser?.qrCodeId || user.qrCodeId || `PAT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          age: rawUser?.age || user.age || null,
          bloodGroup: rawUser?.bloodGroup || user.bloodGroup || '',
          healthIssues: rawUser?.healthIssues || user.healthIssues || '',
          allergies: rawUser?.allergies || user.allergies || '',
          medications: rawUser?.medications || user.medications || '',
          emergencyContacts: contacts,
          publicProfile: true
        });
      }
      if (profileData) {
        await ensureEmergencyCredential(profileData, req);
      }
    } else if (user.role === 'doctor') {
      profileData = await DoctorProfile.findOne({ userId: user._id });
    } else if (user.role === 'crew') {
      profileData = await CrewProfile.findOne({ userId: user._id });
    }

    let clientProfile = profileData ? (profileData.toObject ? profileData.toObject() : { ...profileData }) : null;
    // Security Access Audit Log / activities are strictly restricted to administrators
    if (clientProfile && user.role !== 'admin') {
      delete clientProfile.activities;
    }

    res.json({
      user,
      profile: clientProfile
    });
  } catch (error) {
    console.error('Error fetching current user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile data' });
  }
});

// Update profile details
router.put('/update', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const {
      name,
      gender,
      phone,
      address,
      city,
      state,
      // Patient fields
      age,
      bloodGroup,
      healthIssues,
      allergies,
      medications,
      emergencyContacts,
      // Doctor fields
      specialization,
      licenseNumber,
      hospital,
      // Crew fields
      vehicleNumber,
      crewType,
      station
    } = req.body;

    // Update common fields
    if (name) user.name = name;
    if (gender !== undefined) user.gender = gender;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (state !== undefined) user.state = state;

    await user.save();

    // Update role profiles
    if (user.role === 'patient') {
      let profile = await PatientProfile.findOne({ userId: user._id });
      if (!profile) {
        profile = new PatientProfile({
          userId: user._id,
          qrCodeId: user.qrCodeId || `PAT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          publicProfile: true
        });
      }
      if (age !== undefined) profile.age = age;
      if (bloodGroup !== undefined) profile.bloodGroup = bloodGroup;
      if (healthIssues !== undefined) profile.healthIssues = healthIssues;
      if (allergies !== undefined) profile.allergies = allergies;
      if (medications !== undefined) profile.medications = medications;

      if (Array.isArray(emergencyContacts)) {
        // Limit to max 3 contacts and assign priority sequence
        profile.emergencyContacts = emergencyContacts.slice(0, 3).map((c, idx) => ({
          name: c.name || '',
          phone: c.phone || '',
          relationship: c.relationship || '',
          priority: idx + 1
        }));
      }

      await ensureEmergencyCredential(profile, req);
      await profile.save();
    } else if (user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ userId: user._id });
      if (profile) {
        if (specialization !== undefined) profile.specialization = specialization;
        if (licenseNumber !== undefined) profile.licenseNumber = licenseNumber;
        if (hospital !== undefined) profile.hospital = hospital;
        await profile.save();
      }
    } else if (user.role === 'crew') {
      const profile = await CrewProfile.findOne({ userId: user._id });
      if (profile) {
        if (vehicleNumber !== undefined) profile.vehicleNumber = vehicleNumber;
        if (crewType !== undefined) profile.crewType = crewType;
        if (station !== undefined) profile.station = station;
        await profile.save();
      }
    }

    logEvent('PROFILE_UPDATED', { userId: user._id, role: user.role });

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Upload profile photo
router.post('/upload-photo', authenticateToken, (req, res) => {
  uploadPhoto.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a profile photo to upload' });
    }

    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Save filename/path in user schema
      const relativePath = `/uploads/photos/${req.file.filename}`;
      user.profilePhoto = relativePath;
      await user.save();

      logEvent('PROFILE_PHOTO_UPLOADED', { userId: user._id, path: relativePath });

      res.json({
        message: 'Profile photo uploaded successfully',
        profilePhoto: relativePath
      });
    } catch (error) {
      console.error('Profile photo database save error:', error);
      res.status(500).json({ error: 'Failed to save profile photo' });
    }
  });
});

// Update patient live location
router.put('/location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Latitude and longitude coordinates are required' });
    }

    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patient users can update live location' });
    }

    const profile = await PatientProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    profile.lastLocation = {
      lat,
      lng,
      updatedAt: new Date()
    };
    await profile.save();

    res.json({ message: 'Live location updated successfully', lastLocation: profile.lastLocation });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location coordinate' });
  }
});

// Toggle patient public vs private visibility setting
router.put('/visibility', authenticateToken, async (req, res) => {
  try {
    const { publicProfile } = req.body;
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profile = await PatientProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    profile.publicProfile = publicProfile === true;
    await profile.save();

    logEvent('PROFILE_VISIBILITY_CHANGED', { userId: req.user.userId, publicProfile: profile.publicProfile });

    res.json({ message: 'Profile visibility updated successfully', publicProfile: profile.publicProfile });
  } catch (error) {
    console.error('Error toggling profile visibility:', error);
    res.status(500).json({ error: 'Failed to update visibility settings' });
  }
});

// Regenerate QR Code
router.post('/regenerate-qr', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can regenerate their QR codes' });
    }

    const profile = await PatientProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const frontendUrl = getFrontendUrl(req);
    const qrUrl = `${frontendUrl}/emergency_access.html?id=${profile.qrCodeId}`;
    
    const qrCodeDataURL = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    profile.qrCode = qrCodeDataURL;
    await profile.save();

    res.json({
      message: 'QR code successfully regenerated',
      qrCode: profile.qrCode
    });
  } catch (error) {
    console.error('Error regenerating QR code:', error);
    res.status(500).json({ error: 'Failed to regenerate QR code' });
  }
});

module.exports = router;
