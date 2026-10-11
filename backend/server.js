const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const { getFrontendUrl, isSecureUrl, getLocalIpAddress } = require("./utils/frontendUrl");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'", "*"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://cdn.onesignal.com", "https://onesignal.com", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.material.com", "https://fonts.googleapis.com/css2", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' && isSecureUrl(getFrontendUrl()) ? [] : null
    }
  }
}));

// CORS Configuration - Allow local network IPs, localhost, and production domains
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
}));

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again after 15 minutes"
});
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);

// Payload limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '50kb', extended: true }));
app.use(cookieParser());

// Live Reload Clients list for local development
let devClients = [];




// Serve static files with no-cache for HTML to prevent stale browser caches
const staticOptions = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
};

app.get(['/', '/index.html', '/landingpage.html', '/website', '/website/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../website/index.html'));
});

// Mobile Application root endpoint
app.get(['/app', '/app/', '/app/index.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../app/patient_app.html'));
});

app.use('/website', express.static(path.join(__dirname, '../website'), staticOptions));
app.use('/app', express.static(path.join(__dirname, '../app'), staticOptions));
app.use(express.static(path.join(__dirname, '../website'), staticOptions));
app.use(express.static(path.join(__dirname, '../app'), staticOptions));
app.use('/uploads/photos', (req, res) => {
  res.status(404).json({ error: 'Photo access is restricted and not publicly available' });
});

// Development Live Reload endpoint (Event Stream)
app.get('/api/v1/dev-live-reload', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  devClients.push(res);

  req.on('close', () => {
    devClients = devClients.filter(c => c !== res);
  });
});

// API Version 1 Routes
const authRoutes = require("./routes/v1/auth");
const patientProfileRoutes = require("./routes/v1/patientProfile");
const sosRoutes = require("./routes/v1/sos");
const reportsRoutes = require("./routes/v1/reports");
const medicalHistoryRoutes = require("./routes/v1/medicalHistory");
const doctorAccessRoutes = require("./routes/v1/doctorAccess");
const adminRoutes = require("./routes/v1/admin");
const verificationRoutes = require("./routes/v1/verification");
const emergencyCredentialRoutes = require("./routes/v1/emergencyCredentials");
const erHandoverRoutes = require("./routes/v1/erHandover");
const patientAppRoutes = require("./routes/v1/patientApp");
const aiClinicalRoutes = require("./routes/v1/aiClinical");
const doctorDecisionTreeRoutes = require("./routes/v1/doctorDecisionTree");
const hospitalRoutes = require("./routes/v1/hospitals");
const helpTicketsRoutes = require("./routes/v1/helpTickets");

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/patient", patientProfileRoutes);
app.use("/api/v1/patient-app", patientAppRoutes);
app.use("/api/v1/sos", sosRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/history", medicalHistoryRoutes);
app.use("/api/v1/doctor-access", doctorAccessRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/verification", verificationRoutes);
app.use("/api/v1/emergency-credentials", emergencyCredentialRoutes);
app.use("/api/v1/emergency-access", emergencyCredentialRoutes);
app.use("/api/v1/er", erHandoverRoutes);
app.use("/api/v1/ai-clinical", aiClinicalRoutes);
app.use("/api/v1/doctor-decision-tree", doctorDecisionTreeRoutes);
app.use("/api/v1/hospitals", hospitalRoutes);
app.use("/api/v1/help-tickets", helpTicketsRoutes);

// Public configuration endpoint for frontend (OneSignal, etc)
app.get("/api/v1/config", (req, res) => {
  res.json({
    oneSignalAppId: process.env.ONESIGNAL_APP_ID || null,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/e/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../app/emergency_access.html'));
});

app.get('/patient-app', (req, res) => {
  res.sendFile(path.join(__dirname, '../app/patient_app.html'));
});

// Health check route
app.get("/api/v1/health", (req, res) => {
  res.json({ 
    status: "healthy",
    message: "LifeQR API v1 is fully operational 🚑",
    timestamp: new Date().toISOString()
  });
});

// API error handler to return generic JSON error to clients
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (req.originalUrl.startsWith('/api')) {
    const isProd = process.env.NODE_ENV === 'production';
    return res.status(500).json({ 
      error: isProd ? 'An internal server error occurred' : err.message,
      correlationId: req.headers['x-request-id'] || 'N/A'
    });
  }
  next(err);
});

// Serve website index for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../website/index.html'));
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Fail fast if critical environment variables are missing
    if (!process.env.MONGO_URI) {
      console.error('❌ Error: MONGO_URI is required in all environments. Please set it in your environment variables or .env file.');
      process.exit(1);
    }
    if (!process.env.JWT_SECRET) {
      console.error('❌ Error: JWT_SECRET is required. Please set it in your environment variables or .env file.');
      process.exit(1);
    }

    const mongoURI = process.env.MONGO_URI;

    if (mongoURI.startsWith('mongodb+srv://')) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      console.log('🌐 DNS Resolver : Configured public DNS (8.8.8.8, 1.1.1.1) for Atlas SRV resolution');
    }

    // Connect to MongoDB
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });
    
    console.log("🍃 Database     : MongoDB Atlas connected successfully");

    // Start server - listen on all network interfaces
    const frontendUrl = getFrontendUrl();
    const useHttps = false; // Force HTTP locally and let proxies (Render, etc.) handle SSL

    let server;
    if (useHttps) {
      // Check if HTTPS certificates exist locally
      const certPath = path.join(__dirname, 'certs', 'server.crt');
      const keyPath = path.join(__dirname, 'certs', 'server.key');
      const secureConfig = fs.existsSync(certPath) && fs.existsSync(keyPath);

      if (secureConfig) {
        const options = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        };
        server = https.createServer(options, app);
      } else {
        server = http.createServer(app);
      }
    } else {
      server = http.createServer(app);
    }

    // Integrate Socket.IO with server instance
    const io = socketIo(server, {
      cors: {
        origin: (origin, callback) => { callback(null, true); },
        credentials: true
      }
    });

    // Make Socket.IO available to routes
    app.set('io', io);

    // Socket.IO authentication middleware — verify JWT from cookie
    io.use((socket, next) => {
      try {
        let token = socket.handshake.auth?.token || socket.handshake.query?.token;

        if (!token && socket.handshake.headers.cookie) {
          const cookieHeader = socket.handshake.headers.cookie;
          const tokenMatch = cookieHeader.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('token='));
          if (tokenMatch) {
            token = tokenMatch.split('=')[1];
          }
        }

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded; // { userId, role }
        next();
      } catch (err) {
        next(new Error('Invalid or expired session'));
      }
    });

    // Server-assigned rooms based on verified user role
    io.on('connection', (socket) => {
      const { userId, role } = socket.user;
      console.log(`🔌 Authenticated client connected: ${socket.id} (${role}:${userId})`);

      // Assign rooms based on verified role — client cannot choose rooms
      if (role === 'patient') {
        socket.join(`patient:${userId}`);
      } else if (role === 'doctor') {
        socket.join(`doctor:${userId}`);
        socket.join('hospital:er');
      } else if (role === 'crew') {
        socket.join('crew:all');
        socket.join('hospital:er');
      } else if (role === 'admin') {
        socket.join('admin:all');
        socket.join('hospital:er');
      }

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });

    server.listen(PORT, '0.0.0.0', () => {
      const localIp = getLocalIpAddress();
      const isHttps = useHttps;
      const protocol = isHttps ? 'https' : 'http';
      const localUrl = `${protocol}://localhost:${PORT}`;
      const networkUrl = localIp && localIp !== 'localhost' ? `${protocol}://${localIp}:${PORT}` : null;
      const envName = process.env.NODE_ENV || 'development';

      console.log('\n┌─────────────────────────────────────────────────────────────┐');
      console.log('│          🚑  LifeQR Emergency Medical Platform  🚑          │');
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log(`  🚀 Server Status : Operational in [${envName}] mode`);
      console.log(`  🚪 Server Port   : ${PORT}`);
      if (localIp && localIp !== 'localhost') {
        console.log(`  📡 Network IP    : ${localIp}`);
      }

      console.log('\n  🌐 Public Marketing Website & Auth:');
      console.log(`  ➜ Local Website       : ${localUrl}/`);
      if (networkUrl) {
        console.log(`  ➜ Network Website     : ${networkUrl}/`);
      }
      console.log(`  ➜ Sign In Portal      : ${localUrl}/lifeqr_login.html`);
      console.log(`  ➜ Registration Portal : ${localUrl}/lifeqr_signup.html`);

      console.log('\n  📲 Patient Mobile App (PWA & Android):');
      console.log(`  ➜ Local Mobile App    : ${localUrl}/app`);
      console.log(`  ➜ Direct App View     : ${localUrl}/patient_app.html`);
      if (networkUrl) {
        console.log(`  ➜ Network Mobile App  : ${networkUrl}/app  (Open on Phone)`);
      }
      console.log(`  ➜ App Splash Screen   : ${localUrl}/splash.html`);

      console.log('\n  🏥 Clinical, EMS & Hospital Command Portals:');
      console.log(`  ➜ Patient Health Vault: ${localUrl}/patient_dashboard.html`);
      console.log(`  ➜ Doctor Portal       : ${localUrl}/doctor_dashboard.html`);
      console.log(`  ➜ Ambulance Crew HUD  : ${localUrl}/CrewAmbulance_dashboard.html`);
      console.log(`  ➜ Hospital Command    : ${localUrl}/hospital_dashboard.html`);
      console.log(`  ➜ ER Trauma Bay       : ${localUrl}/er_dashboard.html`);
      console.log(`  ➜ Admin Console       : ${localUrl}/admin_dashboard.html`);
      console.log(`  ➜ Emergency Scanner   : ${localUrl}/emergency_access.html`);
      console.log(`  ➜ Demo Emergency Pass : ${localUrl}/emergency_access.html?id=RAH-D3200470`);

      console.log('\n  ⚡ Developer & API Endpoints:');
      console.log(`  ➜ API Health Status   : ${localUrl}/api/v1/health`);
      console.log(`  ➜ System Config       : ${localUrl}/api/v1/config`);
      console.log('───────────────────────────────────────────────────────────────\n');
    });

    server.on('error', (listenErr) => {
      if (listenErr.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
      } else {
        console.error('❌ Server listen failed:', listenErr);
      }
      process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing server gracefully...');
      await mongoose.connection.close();
      process.exit(0);
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
};

startServer();
