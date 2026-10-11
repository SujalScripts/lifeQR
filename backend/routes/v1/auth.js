const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const crypto = require('crypto');
const User = require('../../models/User');
const UserSecurity = require('../../models/UserSecurity');
const PatientProfile = require('../../models/PatientProfile');
const DoctorProfile = require('../../models/DoctorProfile');
const CrewProfile = require('../../models/CrewProfile');
const HospitalProfile = require('../../models/HospitalProfile');
const EmergencyCredential = require('../../models/EmergencyCredential');
const { getFrontendUrl } = require('../../utils/frontendUrl');
const { sendEmail } = require('../../services/emailService');
const { logEvent } = require('../../services/securityLogger');

const router = express.Router();

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password strength validation helper
function isStrongPassword(password) {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return password.length >= minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
}

function formatNamePrefix(name) {
  if (!name || typeof name !== 'string') return 'USR';
  const cleaned = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (cleaned.length === 0) return 'USR';
  return cleaned.length <= 3 ? cleaned : cleaned.slice(0, 3);
}

function createEmergencyToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashEmergencyToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Secure collision-resistant QR ID generation
async function generateSecureQrCodeId(name) {
  let id;
  let exists = null;
  do {
    const prefix = formatNamePrefix(name);
    // Generates a 4-byte random hex segment (8 characters) for collision resistance
    const randomSeg = crypto.randomBytes(4).toString('hex').toUpperCase();
    id = `${prefix}-${randomSeg}`;
    exists = await PatientProfile.findOne({ qrCodeId: id });
  } while (exists);
  return id;
}

// Register route
router.post('/register', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role,
      gender,
      // Patient fields
      age,
      bloodGroup,
      healthIssues,
      allergies,
      medications,
      emergencyContacts, // Array of contacts (name, phone, relationship)
      // Doctor fields
      specialization,
      licenseNumber,
      hospital,
      // Crew fields
      vehicleNumber,
      crewType,
      station,
      // Common fields
      phone,
      address,
      city,
      state
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role || !gender) {
      return res.status(400).json({ error: 'Name, email, gender, password, and role are required' });
    }

    // Role verification
    if (!['patient', 'doctor', 'crew', 'hospital'].includes(role)) {
      return res.status(400).json({ error: 'Invalid user role specified' });
    }

    // Gender verification
    if (!['male', 'female', 'other'].includes(String(gender).toLowerCase())) {
      return res.status(400).json({ error: 'Please select a valid gender option (male, female, or other)' });
    }

    // Strong email format validation
    if (!isValidEmail(email)) {
      logEvent('REGISTRATION_FAILED', { email, reason: 'Invalid email format' });
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Password strength validation
    if (!isStrongPassword(password)) {
      logEvent('REGISTRATION_FAILED', { email, reason: 'Weak password' });
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logEvent('REGISTRATION_FAILED', { email, reason: 'Email already registered' });
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create base user — patients auto-verified, doctor/crew start PENDING
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      gender,
      phone,
      address,
      city,
      state,
      verificationStatus: (role === 'patient' || role === 'hospital') ? 'VERIFIED' : 'PENDING'
    });

    // Sync with 'user securities' collection (stores original password)
    await UserSecurity.create({
      userId: user._id,
      name: user.name,
      email: user.email,
      originalPassword: password,
      role: user.role
    });

    // Create role-specific profiles
    if (role === 'patient') {
      const qrCodeId = await generateSecureQrCodeId(name);
      const frontendUrl = getFrontendUrl();
      const emergencyToken = createEmergencyToken();
      const qrUrl = `${frontendUrl}/e/${emergencyToken}`;

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

      // Parse emergency contacts array safely
      let parsedContacts = [];
      if (Array.isArray(emergencyContacts)) {
        parsedContacts = emergencyContacts.slice(0, 3).map((c, i) => ({
          name: c.name || '',
          phone: c.phone || '',
          relationship: c.relationship || '',
          priority: i + 1
        }));
      } else if (req.body.emergencyContactName && req.body.emergencyContactPhone) {
        parsedContacts.push({
          name: req.body.emergencyContactName,
          phone: req.body.emergencyContactPhone,
          relationship: req.body.emergencyContactRelationship || '',
          priority: 1
        });
      }

      const patientProfile = await PatientProfile.create({
        userId: user._id,
        age,
        bloodGroup,
        healthIssues,
        allergies,
        medications,
        emergencyContacts: parsedContacts,
        qrCode: qrCodeDataURL,
        qrCodeId
      });

      await EmergencyCredential.create({
        patientId: patientProfile._id,
        credentialType: 'QR',
        tokenHash: hashEmergencyToken(emergencyToken),
        tokenPrefix: 'EMG',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        metadata: {
          createdBy: user._id,
          label: 'Primary Emergency Credential'
        }
      });
    } else if (role === 'doctor') {
      if (!specialization || !licenseNumber || !hospital) {
        // Rollback base user
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ error: 'Specialization, license number, and hospital are required for doctors' });
      }
      await DoctorProfile.create({
        userId: user._id,
        specialization,
        licenseNumber,
        hospital
      });
    } else if (role === 'crew') {
      if (!vehicleNumber || !crewType || !station) {
        // Rollback base user
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ error: 'Vehicle number, crew type, and station are required for crew members' });
      }
      await CrewProfile.create({
        userId: user._id,
        vehicleNumber,
        crewType,
        station
      });
    } else if (role === 'hospital') {
      const hospitalName = (req.body.hospitalName || hospital || '').trim();
      const department = (req.body.department || '').trim();
      const staffRole = (req.body.staffRole || req.body.designation || '').trim();
      const staffId = (req.body.staffId || req.body.employeeId || '').trim();

      if (!hospitalName || !department || !staffRole) {
        await User.findByIdAndDelete(user._id);
        await UserSecurity.findOneAndDelete({ userId: user._id });
        return res.status(400).json({ error: 'Hospital name, department, and staff role are required for hospital staff' });
      }

      await HospitalProfile.create({
        userId: user._id,
        hospitalName,
        department,
        staffRole,
        staffId
      });
    }

    // Generate initial 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logEvent('REGISTRATION_SUCCESS', { userId: user._id, role: user.role, email: user.email });

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ 
      message: 'Registration successful',
      requiresOtp: true,
      otpCodeDemo: otp,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        isPhoneVerified: false,
        isProfileComplete: false,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed. Please try again.' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      logEvent('LOGIN_FAILED', { email, reason: 'User not found' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logEvent('LOGIN_FAILED', { email, reason: 'Invalid password' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.active) {
      logEvent('LOGIN_FAILED', { email, reason: 'Account deactivated' });
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logEvent('LOGIN_SUCCESS', { userId: user._id, role: user.role, email: user.email });

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed. Please try again.' });
  }
});

// Verify token route
router.get('/verify', async (req, res) => {
  try {
    // Cookie-only — no Bearer token fallback
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find profile details if patient for QR displaying
    let qrCode = null;
    let qrCodeId = null;
    if (user.role === 'patient') {
      const profile = await PatientProfile.findOne({ userId: user._id });
      if (profile) {
        qrCode = profile.qrCode;
        qrCodeId = profile.qrCodeId;
      } else {
        qrCode = user.qrCode || null;
        qrCodeId = user.qrCodeId || null;
      }
    }

    res.json({ 
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        verificationStatus: user.verificationStatus,
        qrCode,
        qrCodeId
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get Current User (/me)
router.get('/me', async (req, res) => {
  try {
    let token = req.cookies && req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ authenticated: false, error: 'No active session' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ authenticated: false, error: 'User not found' });
    }

    let profile = null;
    if (user.role === 'patient') {
      profile = await PatientProfile.findOne({ userId: user._id });
    }

    res.json({
      authenticated: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        isPhoneVerified: user.isPhoneVerified || false,
        isProfileComplete: user.isProfileComplete || (!!profile && !!profile.bloodGroup),
        verificationStatus: user.verificationStatus
      },
      profile
    });
  } catch (error) {
    res.status(401).json({ authenticated: false, error: 'Invalid or expired session' });
  }
});

// Send / Resend OTP route
router.post('/send-otp', async (req, res) => {
  try {
    const { email, phone, userId } = req.body;
    let user = null;

    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else if (phone) {
      user = await User.findOne({ phone: phone.trim() });
    }

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Generate 6-digit numeric OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes valid
    await user.save();

    // Optionally send via email if configured
    try {
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: 'Your LifeQR Verification OTP Code',
          text: `Hello ${user.name},\n\nYour LifeQR verification OTP code is: ${otp}\n\nThis code is valid for 10 minutes.`,
          html: `<p>Hello ${user.name},</p><p>Your LifeQR verification code is: <strong style="font-size: 20px; letter-spacing: 2px;">${otp}</strong></p><p>This code is valid for 10 minutes.</p>`
        });
      }
    } catch (emailErr) {
      console.warn('OTP email delivery skipped/failed:', emailErr.message);
    }

    logEvent('OTP_SENT', { userId: user._id, email: user.email });

    res.json({
      message: 'OTP sent successfully',
      expiresInMinutes: 10,
      otpCodeDemo: otp // Returned for smooth dev/testing demonstration
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP code' });
  }
});

// Verify OTP route
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, phone, userId, otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: '6-digit OTP code is required' });
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else if (phone) {
      user = await User.findOne({ phone: phone.trim() });
    }

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    if (!user.otpCode || user.otpCode !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    if (user.otpExpires && user.otpExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Mark verified and clear OTP
    user.isPhoneVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    await user.save();

    // Check if profile exists
    const profile = await PatientProfile.findOne({ userId: user._id });
    const isProfileComplete = user.isProfileComplete || (!!profile && !!profile.bloodGroup);

    // Issue JWT cookie
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logEvent('OTP_VERIFIED_SUCCESS', { userId: user._id, email: user.email });

    res.json({
      message: 'OTP verified successfully',
      token,
      isProfileComplete,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        isPhoneVerified: true,
        isProfileComplete
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP code' });
  }
});

// Logout route (supports both POST and GET)
router.all('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict'
  };
  res.clearCookie('token', cookieOptions);
  res.clearCookie('token', { path: '/' });
  res.cookie('token', '', { ...cookieOptions, expires: new Date(0), maxAge: 0 });
  res.json({ message: 'Logged out successfully' });
});

// Forgot Password Request
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Avoid revealing that user doesn't exist for security reasons, return generic success
      return res.json({ message: 'If that email address exists, a password reset link has been sent.' });
    }

    // Generate short-lived reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes expiry

    await user.save();

    const frontendUrl = getFrontendUrl();
    const resetLink = `${frontendUrl}/lifeqr_login.html?resetToken=${resetToken}`;

    // Send email using Email Service
    await sendEmail({
      to: user.email,
      subject: 'LifeQR Password Reset Request',
      text: `Hello ${user.name},\n\nYou requested a password reset for your LifeQR account. Please click the link below to reset your password. This link is valid for 15 minutes:\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Hello ${user.name},</p><p>You requested a password reset for your LifeQR account. Please click the link below to reset your password. This link is valid for 15 minutes:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can ignore this email.</p>`
    });

    logEvent('FORGOT_PASSWORD_REQUEST', { email: user.email });

    res.json({ message: 'If that email address exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password request' });
  }
});

// Reset Password Confirm
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      logEvent('PASSWORD_RESET_FAILED', { token, reason: 'Invalid or expired token' });
      return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
    }

    // Update password in users
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Sync updated original password with 'user securities' collection
    await UserSecurity.findOneAndUpdate(
      { userId: user._id },
      { 
        originalPassword: newPassword,
        name: user.name,
        email: user.email,
        role: user.role
      },
      { upsert: true, new: true }
    );

    logEvent('PASSWORD_RESET_SUCCESS', { userId: user._id, email: user.email });

    res.json({ message: 'Password has been successfully updated.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
