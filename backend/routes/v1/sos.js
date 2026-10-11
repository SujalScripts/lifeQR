const express = require('express');
const User = require('../../models/User');
const PatientProfile = require('../../models/PatientProfile');
const CrewProfile = require('../../models/CrewProfile');
const AmbulanceCrew = require('../../models/AmbulanceCrew');
const { authenticateToken } = require('../../middleware/auth');
const { logEvent } = require('../../services/securityLogger');
const { sendEmail } = require('../../services/emailService');
const { sendNotification } = require('../../services/notificationService');

const router = express.Router();

// Trigger SOS
router.post('/sos', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, message } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Latitude and longitude coordinates are required' });
    }

    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patient users can trigger an SOS' });
    }

    const patient = await User.findById(req.user.userId);
    const profile = await PatientProfile.findOne({ userId: req.user.userId });
    if (!profile || !patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const emailList = profile.emergencyContacts.map(c => c.phone).filter(Boolean);

    const sosAlert = {
      status: 'sent',
      location: { lat, lng },
      message: message || 'Emergency SOS Alert triggered!',
      sentTo: emailList,
      createdAt: new Date()
    };

    profile.sosAlerts.unshift(sosAlert);
    if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
      profile.lastLocation = {
        lat,
        lng,
        updatedAt: new Date()
      };
    }
    profile.activities.unshift({
      type: 'SOS Triggered',
      title: 'SOS Emergency Broadcasted',
      description: sosAlert.message,
      metadata: { location: sosAlert.location },
      timestamp: new Date()
    });
    
    await profile.save();

    // 1. Real-time Socket Broadcast (Crew Dashboards)
    const io = req.app.get('io');
    if (io) {
      io.to('crew:all').emit('sos-alert', {
        sosId: profile.sosAlerts[0]._id,
        patientId: patient._id,
        name: patient.name,
        age: profile.age,
        bloodGroup: profile.bloodGroup,
        allergies: profile.allergies,
        medications: profile.medications,
        location: { lat, lng },
        message: sosAlert.message,
        emergencyContacts: profile.emergencyContacts,
        timestamp: new Date()
      });
    }

    // 2. Multi-Channel Free Alerts (Telegram & OneSignal Push)
    sendNotification({
      type: 'SOS',
      payload: {
        name: patient.name,
        message: sosAlert.message,
        location: { lat, lng },
        contacts: profile.emergencyContacts,
        patientId: patient._id
      }
    });

    // 3. Email Backup
    profile.emergencyContacts.forEach(contact => {
      // If contact has email details (for simplicity we check phone or assume mock notification flow)
      // Here we simulate alert dispatch using their phone or email if stored.
      // Let's print out notification in logs and email patient + family
      sendEmail({
        to: patient.email, // Notify the patient's own registered email as confirmation
        subject: '🚨 EMERGENCY ALERT: LifeQR SOS Triggered',
        text: `Hello,\n\nAn SOS alert was triggered for ${patient.name}. \nLocation: Latitude ${lat}, Longitude ${lng}.\nMessage: ${sosAlert.message}\nEmergency responders have been notified.`,
        html: `<p>🚨 <strong>EMERGENCY ALERT: LifeQR SOS Triggered</strong></p><p>An SOS alert was triggered for patient <strong>${patient.name}</strong>.</p><p>Location coordinates: <a href="https://maps.google.com/?q=${lat},${lng}">${lat}, ${lng}</a></p><p>Message: ${sosAlert.message}</p>`
      }).catch(err => console.error('Failed to send SOS notification:', err));
    });

    logEvent('SOS_TRIGGERED', { userId: patient._id, location: { lat, lng } });

    res.json({ message: 'SOS alert broadcasted successfully', sosAlert: profile.sosAlerts[0] });
  } catch (error) {
    console.error('Error triggering SOS:', error);
    res.status(500).json({ error: 'Failed to trigger emergency SOS alert' });
  }
});

// Acknowledge SOS alert (by Crew/Doctor)
router.post(['/acknowledge', '/acknowledge/:qrCodeId/:sosId'], authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'crew' && req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Only ambulance crew or medical staff can acknowledge SOS alerts' });
    }

    const qrCodeId = req.params.qrCodeId || req.body.qrCodeId;
    const sosId = req.params.sosId || req.body.sosId;

    if (!sosId) {
      return res.status(400).json({ error: 'SOS Alert ID is required' });
    }

    let profile = null;
    if (qrCodeId) {
      profile = await PatientProfile.findOne({ qrCodeId });
    } else {
      profile = await PatientProfile.findOne({ 'sosAlerts._id': sosId });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Patient profile or associated SOS alert not found' });
    }

    const alert = profile.sosAlerts.id(sosId);
    if (!alert) {
      return res.status(404).json({ error: 'SOS alert event not found' });
    }

    const responder = await User.findById(req.user.userId).select('name role');

    alert.status = 'acknowledged';
    alert.acknowledgedBy = {
      userId: req.user.userId,
      name: responder.name,
      timestamp: new Date()
    };

    profile.activities.unshift({
      type: 'SOS Acknowledged',
      title: 'SOS Acknowledged',
      description: `SOS alert was acknowledged by ${responder.name} (${responder.role}).`,
      timestamp: new Date()
    });

    await profile.save();

    // Emit targeted socket events to specific rooms
    const io = req.app.get('io');
    if (io) {
      // Notify the patient that their SOS was acknowledged
      io.to(`patient:${profile.userId}`).emit('sos-acknowledged', {
        sosId,
        responderName: responder.name,
        responderRole: responder.role
      });
      // Notify other crew members about the acknowledgement
      io.to('crew:all').emit('sos-acknowledged', {
        sosId,
        responderName: responder.name,
        responderRole: responder.role
      });
    }

    logEvent('SOS_ACKNOWLEDGED', { sosId, responderId: req.user.userId });

    res.json({ message: 'SOS alert acknowledged successfully', alert });
  } catch (error) {
    console.error('Error acknowledging SOS alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge SOS alert' });
  }
});

// Get active unresolved SOS alerts (for Crew / Doctor / Admin radar)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    if (!['crew', 'doctor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Responder role required' });
    }

    const profiles = await PatientProfile.find({
      'sosAlerts.status': { $in: ['sent', 'acknowledged', 'dispatched'] }
    }).populate('userId', 'name phone email');

    const activeAlerts = [];
    profiles.forEach(profile => {
      if (profile.sosAlerts && profile.sosAlerts.length > 0) {
        profile.sosAlerts.forEach(alert => {
          if (['sent', 'acknowledged', 'dispatched'].includes(alert.status)) {
            activeAlerts.push({
              sosId: alert._id,
              patientId: profile.userId?._id || profile.userId,
              name: profile.name || profile.userId?.name || 'Emergency Patient',
              age: profile.age,
              bloodGroup: profile.bloodGroup,
              allergies: profile.allergies,
              medications: profile.medications,
              emergencyContacts: profile.emergencyContacts,
              qrCodeId: profile.qrCodeId,
              location: alert.location,
              message: alert.message,
              status: alert.status,
              acknowledgedBy: alert.acknowledgedBy,
              createdAt: alert.createdAt
            });
          }
        });
      }
    });

    activeAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, alerts: activeAlerts });
  } catch (error) {
    console.error('Error fetching active SOS alerts:', error);
    res.status(500).json({ error: 'Failed to fetch active SOS alerts' });
  }
});

// Get crew duty status
router.get('/crew/duty-status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'crew') {
      return res.status(403).json({ error: 'Only ambulance crew can query duty status' });
    }

    const crewProfile = await CrewProfile.findOne({ userId: req.user.userId });
    const status = crewProfile?.status || 'on_duty';
    const isOffDuty = status === 'off_duty';

    res.json({
      success: true,
      status: isOffDuty ? 'off_duty' : (status === 'dispatched' ? 'dispatched' : 'on_duty'),
      rawStatus: status,
      isOffDuty,
      vehicleNumber: crewProfile?.vehicleNumber || 'MED-UNIT-108',
      station: crewProfile?.station || 'Central Emergency Station',
      updatedAt: crewProfile?.updatedAt
    });
  } catch (error) {
    console.error('Error fetching crew duty status:', error);
    res.status(500).json({ error: 'Failed to fetch crew duty status' });
  }
});

// Update crew duty status (Toggle ON-DUTY / OFF-DUTY)
router.post('/crew/duty-status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'crew') {
      return res.status(403).json({ error: 'Only ambulance crew can update duty status' });
    }

    const { status } = req.body;
    if (!['on_duty', 'off_duty', 'available'].includes(status)) {
      return res.status(400).json({ error: 'Status must be on_duty, off_duty, or available' });
    }

    const targetStatus = status === 'off_duty' ? 'off_duty' : 'on_duty';

    const crewUser = await User.findById(req.user.userId).select('name phone email');
    let crewProfile = await CrewProfile.findOne({ userId: req.user.userId });

    if (!crewProfile) {
      crewProfile = await CrewProfile.create({
        userId: req.user.userId,
        vehicleNumber: 'KA-01-EQ-9110',
        crewType: 'ambulance',
        station: 'Station 12 — Central Trauma Sub-station',
        organization: 'Metro City Emergency Medical Services (EMS)',
        status: targetStatus
      });
    } else {
      crewProfile.status = targetStatus;
      await crewProfile.save();
    }

    await AmbulanceCrew.findOneAndUpdate(
      { userId: req.user.userId },
      { status: targetStatus }
    ).catch(() => {});

    // Broadcast real-time duty state to all crews and administrative fleet observers
    const io = req.app.get('io');
    if (io) {
      io.to('crew:all').emit('crew-duty-updated', {
        crewId: req.user.userId,
        name: crewUser?.name || 'Ambulance Crew Lead',
        vehicleNumber: crewProfile.vehicleNumber,
        status: targetStatus,
        isOffDuty: targetStatus === 'off_duty',
        timestamp: new Date()
      });
      io.to('admin:all').emit('crew-duty-updated', {
        crewId: req.user.userId,
        name: crewUser?.name || 'Ambulance Crew Lead',
        vehicleNumber: crewProfile.vehicleNumber,
        status: targetStatus,
        isOffDuty: targetStatus === 'off_duty',
        timestamp: new Date()
      });
    }

    logEvent(targetStatus === 'off_duty' ? 'CREW_OFF_DUTY' : 'CREW_ON_DUTY', {
      crewId: req.user.userId,
      vehicleNumber: crewProfile.vehicleNumber,
      status: targetStatus
    });

    res.json({
      success: true,
      message: targetStatus === 'off_duty' 
        ? `Unit ${crewProfile.vehicleNumber} is now OFF-DUTY. Alarms muted.` 
        : `Unit ${crewProfile.vehicleNumber} is now ON-DUTY. Tactical radar active.`,
      status: targetStatus,
      isOffDuty: targetStatus === 'off_duty',
      vehicleNumber: crewProfile.vehicleNumber
    });
  } catch (error) {
    console.error('Error updating crew duty status:', error);
    res.status(500).json({ error: 'Failed to update crew duty status' });
  }
});

// Update ambulance crew live GPS location
router.post('/crew/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'crew') {
      return res.status(403).json({ error: 'Only ambulance crew can update tactical location' });
    }

    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Valid latitude and longitude coordinates are required' });
    }

    const crewProfile = await CrewProfile.findOneAndUpdate(
      { userId: req.user.userId },
      { currentLocation: { lat, lng, updatedAt: new Date() } },
      { new: true, upsert: true }
    );

    await AmbulanceCrew.findOneAndUpdate(
      { userId: req.user.userId },
      { currentLocation: { lat, lng, updatedAt: new Date() } }
    ).catch(() => {});

    res.json({
      success: true,
      currentLocation: crewProfile.currentLocation
    });
  } catch (error) {
    console.error('Error updating crew location:', error);
    res.status(500).json({ error: 'Failed to update crew location' });
  }
});

// Accept emergency SOS dispatch (by Ambulance Crew)
router.post('/accept', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'crew') {
      return res.status(403).json({ error: 'Only ambulance crew members can accept emergency dispatch' });
    }

    const { sosId, etaMinutes, crewLocation } = req.body;
    if (!sosId) {
      return res.status(400).json({ error: 'SOS Alert ID is required' });
    }

    const crewUser = await User.findById(req.user.userId).select('name phone email role');
    if (!crewUser) {
      return res.status(404).json({ error: 'Ambulance crew user record not found' });
    }

    const crewProfile = await CrewProfile.findOne({ userId: req.user.userId });
    if (crewProfile && crewProfile.status === 'off_duty') {
      return res.status(400).json({
        error: `Unit ${crewProfile.vehicleNumber} is currently OFF-DUTY. Please switch to ON-DUTY before accepting emergency dispatch.`
      });
    }

    const vehicleNumber = crewProfile?.vehicleNumber || 'MED-UNIT-108';
    const station = crewProfile?.station || 'Central Emergency Station';
    const organization = crewProfile?.organization || 'LifeQR Emergency Fleet';
    const crewPhone = crewUser.phone || '+91 98201 10800';

    const profile = await PatientProfile.findOne({ 'sosAlerts._id': sosId });
    if (!profile) {
      return res.status(404).json({ error: 'Active SOS alert not found' });
    }

    const alert = profile.sosAlerts.id(sosId);
    if (!alert) {
      return res.status(404).json({ error: 'SOS alert event not found' });
    }

    alert.status = 'dispatched';
    alert.acknowledgedBy = {
      userId: crewUser._id,
      name: crewUser.name,
      phone: crewPhone,
      vehicleNumber: vehicleNumber,
      station: station,
      timestamp: new Date()
    };

    if (crewProfile) {
      crewProfile.status = 'dispatched';
      if (crewLocation && typeof crewLocation.lat === 'number' && typeof crewLocation.lng === 'number') {
        crewProfile.currentLocation = {
          lat: crewLocation.lat,
          lng: crewLocation.lng,
          updatedAt: new Date()
        };
      }
      await crewProfile.save();
    }

    profile.activities.unshift({
      type: 'Ambulance Dispatched',
      title: 'Ambulance Unit En Route',
      description: `Unit ${vehicleNumber} crewed by ${crewUser.name} (${crewPhone}) accepted dispatch and is en route.`,
      metadata: {
        crewName: crewUser.name,
        crewPhone: crewPhone,
        vehicleNumber: vehicleNumber,
        station: station,
        etaMinutes: etaMinutes || 4
      },
      timestamp: new Date()
    });

    await profile.save();

    const calculatedEta = etaMinutes || 4;

    const dispatchPayload = {
      sosId,
      status: 'dispatched',
      crewName: crewUser.name,
      crewPhone: crewPhone,
      vehicleNumber: vehicleNumber,
      station: station,
      organization: organization,
      etaMinutes: calculatedEta,
      patientId: profile.userId,
      patientName: profile.name,
      location: alert.location,
      timestamp: new Date()
    };

    const io = req.app.get('io');
    if (io) {
      // 1. Directly notify the patient in room patient:<userId>
      io.to(`patient:${profile.userId}`).emit('sos-dispatch-accepted', dispatchPayload);

      io.to(`patient:${profile.userId}`).emit('sos-acknowledged', {
        sosId,
        responderName: crewUser.name,
        responderRole: 'Ambulance Crew Lead',
        crewPhone: crewPhone,
        vehicleNumber: vehicleNumber,
        station: station
      });

      // 2. Broadcast to all crew members that this SOS is claimed
      io.to('crew:all').emit('sos-dispatch-accepted', dispatchPayload);
      io.to('crew:all').emit('sos-claimed', {
        sosId,
        claimedBy: {
          name: crewUser.name,
          phone: crewPhone,
          vehicleNumber: vehicleNumber
        }
      });
    }

    logEvent('SOS_DISPATCH_ACCEPTED', {
      sosId,
      crewId: crewUser._id,
      crewName: crewUser.name,
      vehicleNumber,
      patientId: profile.userId
    });

    res.json({
      success: true,
      message: `Emergency dispatch accepted. Unit ${vehicleNumber} dispatched.`,
      dispatch: dispatchPayload,
      alert
    });
  } catch (error) {
    console.error('Error accepting emergency dispatch:', error);
    res.status(500).json({ error: 'Failed to accept emergency dispatch' });
  }
});

module.exports = router;
