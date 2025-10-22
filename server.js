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
      from: `${process.env.BREVO_FROM_NAME || 'PCFind'} <${process.env.BREVO_FROM_EMAIL || 'noreply@pcfind.com'}>`,
      to: email,
      subject: '🔐 Your PCFind Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 40px 30px; }
            .otp-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
            .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }
            .info { color: #666; font-size: 14px; margin: 20px 0; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 20px 0; border-radius: 4px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e9ecef; }
            .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
            @media only screen and (max-width: 600px) {
              .container { margin: 0; border-radius: 0; }
              .content { padding: 30px 20px; }
              .otp-code { font-size: 28px; letter-spacing: 4px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🖥️ PCFind</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">PC Builder & Price Comparison</p>
            </div>
            <div class="content">
              <h2 style="color: #333; margin-top: 0;">Welcome to PCFind! 👋</h2>
              <p>You're almost there! Use the verification code below to complete your registration:</p>
              
              <div class="otp-box">
                <div style="color: #666; font-size: 14px; margin-bottom: 10px;">Your Verification Code</div>
                <div class="otp-code">${otp}</div>
              </div>
              
              <p class="info">
                ⏱️ <strong>This code expires in 10 minutes</strong><br>
                🔒 For your security, never share this code with anyone
              </p>
              
              <div class="warning">
                <strong>⚠️ Didn't request this?</strong><br>
                If you didn't try to register for PCFind, you can safely ignore this email.
              </div>
              
              <p style="margin-top: 30px;">
                Happy building!<br>
                <strong>The PCFind Team</strong>
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0 0 10px;">PCFind - Your Ultimate PC Building Companion</p>
              <p style="margin: 0; opacity: 0.7;">This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to PCFind!\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\n- The PCFind Team`
    });
    console.log(`✉️ OTP sent to email: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Email send error:', error.message || error);
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

