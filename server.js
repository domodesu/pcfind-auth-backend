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

// AI Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Using Groq (FREE alternative to OpenAI!) - no API key needed for basic use
    const fetch = (await import('node-fetch')).default;
    const systemPrompt = `You are a helpful PC building assistant for PCFind, a Philippines-based PC parts website. You help users with:
- PC component recommendations and compatibility
- Budget build suggestions (prices in Philippine Pesos ₱)
- Performance comparisons
- Upgrade advice
- Troubleshooting

Be friendly, concise, and practical. When discussing prices, use Philippine Pesos (₱). Recommend parts available in the Philippines (Lazada, Shopee, PC Express, EasyPC). Keep responses under 200 words unless detailed explanations are needed.`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (last 10 messages)
    if (history && Array.isArray(history)) {
      history.slice(-10).forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Get Groq API key (free to get at https://console.groq.com)
    const groqKey = process.env.GROQ_API_KEY || '';
    
    if (!groqKey) {
      return res.json({
        success: true,
        reply: `🤖 **PCFind AI Assistant**\n\nI can help you with PC building questions, but I need to be configured first!\n\n**Quick Setup:**\n1. Get a FREE API key: https://console.groq.com/keys\n2. Add to Render: Environment → GROQ_API_KEY\n3. Chat away for free!\n\nYou asked: "${message}"\n\n💡 Groq is 100% FREE with generous limits!`
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile', // Free, fast, and excellent quality!
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Groq API error:', response.status, errorData);
      
      // Return detailed error for debugging
      let errorMsg = 'Sorry, I encountered an error with the AI service.';
      if (response.status === 401) {
        errorMsg = '⚠️ Groq API key is invalid. Please check your GROQ_API_KEY on Render or get a new one at https://console.groq.com/keys';
      } else if (response.status === 429) {
        errorMsg = '⚠️ Groq rate limit exceeded. Wait a moment and try again. (Free tier: 30 requests/minute)';
      } else if (response.status === 400) {
        errorMsg = `⚠️ Invalid request to Groq: ${errorData.error?.message || 'Unknown error'}`;
      }
      
      return res.json({
        success: false,
        reply: errorMsg,
        debug: { status: response.status, error: errorData }
      });
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    console.log('✅ Groq AI response successful');
    res.json({
      success: true,
      reply: reply.trim()
    });

  } catch (error) {
    console.error('❌ Chat error:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Chat service error',
      reply: `⚠️ Error: ${error.message || 'Unknown error'}. The backend is running but the AI call failed. Check Render logs for details.`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});

