const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Centralized logger based on CSIC 2010 dataset format
const logEvent = (req, classification, event, details) => {
    const timestamp = new Date().toISOString();
    
    // Safely stringify the body
    const content = req.body ? JSON.stringify(req.body) : '';

    const logObject = {
        timestamp,
        // Map request details to the specified feature names
        'Method': req.method,
        'URL': req.originalUrl,
        'User-Agent': req.headers['user-agent'] || '-',
        'Pragma': req.headers['pragma'] || '-',
        'Cache-Control': req.headers['cache-control'] || '-',
        'Accept': req.headers['accept'] || '-',
        'Accept-encoding': req.headers['accept-encoding'] || '-',
        'Accept-charset': req.headers['accept-charset'] || '-',
        'language': req.headers['accept-language'] || '-',
        'host': req.headers['host'] || '-',
        'cookie': req.headers['cookie'] || '-',
        'content-type': req.headers['content-type'] || '-',
        'connection': req.headers['connection'] || '-',
        'lenght': req.headers['content-length'] || '0',
        'content': content,
        'classification': classification, // 'Normal' or 'Suspicious'
        'event': event, // Custom event name
        ...details, // Additional details
    };

    // Convert to key-value format for easy parsing
    const logString = Object.entries(logObject)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
    console.log(logString);
};

// In-memory store for demo
const notifications = [];

// Health check
app.get('/health', (req, res) => {
    logEvent(req, 'Normal', 'HealthCheck', { service: 'notification-service' });
    res.json({ status: 'healthy', service: 'notification-service', timestamp: new Date() });
});

// Send notification
app.post('/send', (req, res) => {
    const { userId, email, type } = req.body;
    logEvent(req, 'Normal', 'NotificationReceived', { userId, email, type });

    try {
        const notification = { 
            id: Date.now(), 
            userId, 
            email,
            type,
            message: req.body.message, 
            read: false,
            timestamp: new Date() 
        };
        notifications.push(notification);
        
        logEvent(req, 'Normal', 'NotificationStored', { notificationId: notification.id, userId });
        res.status(201).json({ message: 'Notification stored', notificationId: notification.id });
    } catch (error) {
        logEvent(req, 'Suspicious', 'NotificationStoreFailure', { userId, type, error: error.message });
        res.status(500).json({ error: 'Failed to store notification' });
    }
});

// Get user notifications
app.get('/notifications/:userId', (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    logEvent(req, 'Normal', 'NotificationRetrievalAttempt', { userId });

    const userNotifications = notifications.filter(n => n.userId === userId);
    res.json(userNotifications);
});

// Mark notification as read
app.put('/read/:id', (req, res) => {
    const notificationId = parseInt(req.params.id, 10);
    logEvent(req, 'Normal', 'NotificationMarkReadAttempt', { notificationId });

    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        logEvent(req, 'Normal', 'NotificationMarkReadSuccess', { notificationId });
        res.json({ message: 'Notification marked as read', notification });
    } else {
        logEvent(req, 'Suspicious', 'NotificationMarkReadFailure', { notificationId, reason: 'NotFound' });
        res.status(404).json({ error: 'Notification not found' });
    }
});

const PORT = 3003;
app.listen(PORT, () => {
    // For startup, we don't have a request object, so log a simple message
    console.log(`timestamp="${new Date().toISOString()}" classification="Normal" event="ServerStart" service="NOTIFICATION-SERVICE" port="${PORT}"`);
});
