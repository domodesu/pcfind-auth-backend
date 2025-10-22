const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const OTP_FILE = path.join(__dirname, 'otps.json');

// Initialize OTP storage
if (!fs.existsSync(OTP_FILE)) {
  fs.writeFileSync(OTP_FILE, JSON.stringify({}, null, 2));
}

// Email transporter (Brevo/Sendinblue)
const emailTransporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_PASS || ''
  }
});

// Twilio SMS (optional)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Middleware
app.use(cors()); // Allow requests from GitHub Pages
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize users.json if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Helper functions
function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readOTPs() {
  const data = fs.readFileSync(OTP_FILE, 'utf8');
  return JSON.parse(data);
}

function writeOTPs(otps) {
  fs.writeFileSync(OTP_FILE, JSON.stringify(otps, null, 2));
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailOTP(email, otp) {
  try {
    await emailTransporter.sendMail({
      from: process.env.BREVO_FROM_EMAIL || 'noreply@pcfind.com',
      to: email,
      subject: 'PCFind - Verification Code',
      html: `
        <h2>Welcome to PCFind!</h2>
        <p>Your verification code is: <strong style="font-size:24px">${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

async function sendSMSOTP(phone, otp) {
  if (!twilioClient) return false;
  try {
    await twilioClient.messages.create({
      body: `Your PCFind verification code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

// Routes
app.post('/send-otp', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone required' });
    }

    const identifier = email || phone;
    const otp = generateOTP();
    const otps = readOTPs();

    // Store OTP with 10 minute expiry
    otps[identifier] = {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false
    };
    writeOTPs(otps);

    // Send OTP
    let sent = false;
    if (email) {
      sent = await sendEmailOTP(email, otp);
      if (!sent && !process.env.BREVO_SMTP_USER) {
        // Development mode: return OTP in response
        console.log(`[DEV] OTP for ${email}: ${otp}`);
        return res.json({ success: true, message: 'OTP sent', devOTP: otp });
      }
    } else if (phone) {
      sent = await sendSMSOTP(phone, otp);
      if (!sent && !twilioClient) {
        // Development mode: return OTP in response
        console.log(`[DEV] OTP for ${phone}: ${otp}`);
        return res.json({ success: true, message: 'OTP sent', devOTP: otp });
      }
    }

    if (sent) {
      res.json({ success: true, message: 'OTP sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/verify-otp', async (req, res) => {
  try {
    const { email, phone, otp } = req.body;
    const identifier = email || phone;

    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Email/phone and OTP required' });
    }

    const otps = readOTPs();
    const storedOTP = otps[identifier];

    if (!storedOTP) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    }

    if (Date.now() > storedOTP.expiresAt) {
      delete otps[identifier];
      writeOTPs(otps);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (storedOTP.code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Mark as verified
    otps[identifier].verified = true;
    writeOTPs(otps);

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone required' });
    }

    // Check OTP verification
    const identifier = email || phone;
    const otps = readOTPs();
    const storedOTP = otps[identifier];

    if (!storedOTP || !storedOTP.verified) {
      return res.status(400).json({ error: 'Please verify your email/phone first' });
    }

    // Clean up OTP
    delete otps[identifier];
    writeOTPs(otps);

    const users = readUsers();

    // Check if user exists
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const newUser = {
      id: Date.now().toString(),
      username,
      email: email || '',
      phone: phone || '',
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    res.json({ success: true, message: 'Registration successful', username });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});

