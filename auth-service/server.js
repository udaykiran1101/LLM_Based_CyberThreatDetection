const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const app = express();
app.use(express.json());

const fs = require('fs');
let JWT_SECRET;

try {
    if (process.env.JWT_SECRET_FILE) {
        JWT_SECRET = fs.readFileSync(process.env.JWT_SECRET_FILE, 'utf8').trim();
        console.log('[AUTH-SERVICE] Loaded JWT secret from file');
    } else if (process.env.JWT_SECRET) {
        JWT_SECRET = process.env.JWT_SECRET;
        console.log('[AUTH-SERVICE] Using JWT secret from environment variable');
    } else {
        console.error('[AUTH-SERVICE] Neither JWT_SECRET_FILE nor JWT_SECRET environment variable is set');
        process.exit(1);
    }
} catch (error) {
    console.error('[AUTH-SERVICE] Failed to load JWT secret:', error);
    process.exit(1);
}
const users = []; // In-memory store for demo

// Health check
app.get('/health', (req, res) => {
    console.log('[AUTH-SERVICE] Health check requested');
    res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date() });
});

// Register user
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[AUTH-SERVICE] Registration attempt for: ${email}`);
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { id: Date.now(), email, password: hashedPassword };
        users.push(user);
        
        console.log(`[AUTH-SERVICE] User registered successfully: ${email}`);
        res.json({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
        console.error('[AUTH-SERVICE] Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[AUTH-SERVICE] Login attempt for: ${email}`);
        
        const user = users.find(u => u.email === email);
        if (!user || !await bcrypt.compare(password, user.password)) {
            console.log(`[AUTH-SERVICE] Login failed for: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '24h' });
        console.log(`[AUTH-SERVICE] Login successful for: ${email}`);
        res.json({ token, userId: user.id });
    } catch (error) {
        console.error('[AUTH-SERVICE] Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token
app.post('/verify', (req, res) => {
    try {
        console.log('[AUTH-SERVICE] Headers received:', JSON.stringify(req.headers, null, 2));
        console.log('[AUTH-SERVICE] Body received:', JSON.stringify(req.body, null, 2));
        console.log('[AUTH-SERVICE] Using JWT_SECRET:', JWT_SECRET);
        
        // Accept token from Authorization header or body
        const authHeader = req.headers.authorization;
        console.log('[AUTH-SERVICE] Authorization header:', authHeader);
        
        const token = authHeader?.split(' ')[1] || req.body.token;
        if (!token) {
            console.log('[AUTH-SERVICE] No token provided in request');
            return res.status(401).json({ valid: false, error: 'No token provided' });
        }

        console.log('[AUTH-SERVICE] Token to verify:', token);

        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('[AUTH-SERVICE] Token decoded:', JSON.stringify(decoded, null, 2));
        console.log(`[AUTH-SERVICE] Token verified for user: ${decoded.email}`);
        
        res.json({ valid: true, userId: decoded.userId, email: decoded.email });
    } catch (error) {
        console.error('[AUTH-SERVICE] Token verification failed');
        console.error('[AUTH-SERVICE] Error type:', error.name);
        console.error('[AUTH-SERVICE] Error message:', error.message);
        console.error('[AUTH-SERVICE] Stack trace:', error.stack);
        res.status(401).json({ valid: false, error: 'Invalid token', details: error.message });
    }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[AUTH-SERVICE] Server running on port ${PORT}`);
});
