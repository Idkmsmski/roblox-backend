// index.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS headers - allow requests from any origin
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Secret key - must match Discord bot and Roblox script
const SECRET = "ZpwHC?h!ZL09n8&_g-3$P32u£o";

// In-memory queue for ban/unban commands
let commandQueue = [];

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        queueSize: commandQueue.length,
        message: 'Roblox Ban System API',
        endpoints: {
            ban: 'POST /ban',
            checkbans: 'POST /checkbans',
            queue: 'GET /queue'
        }
    });
});

// Discord bot posts ban/unban commands here
app.post('/ban', (req, res) => {
    console.log('Received ban request:', req.body);
    
    // Validate secret
    if (req.body.secret !== SECRET) {
        console.log('❌ Invalid secret provided');
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    // Validate action and userId
    if (!req.body.action || !req.body.userId) {
        console.log('❌ Missing action or userId');
        return res.status(400).json({ error: 'Missing action or userId' });
    }
    
    if (!['ban', 'unban'].includes(req.body.action)) {
        console.log('❌ Invalid action:', req.body.action);
        return res.status(400).json({ error: 'Invalid action. Must be "ban" or "unban"' });
    }
    
    // Add command to queue
    commandQueue.push({
        action: req.body.action,
        userId: req.body.userId,
        timestamp: Date.now()
    });
    
    console.log(`✅ Added ${req.body.action} command for user ${req.body.userId}`);
    console.log(`📊 Queue size: ${commandQueue.length}`);
    
    res.json({ 
        success: true, 
        message: `User ${req.body.userId} ${req.body.action}ned successfully`,
        queueSize: commandQueue.length
    });
});

// Roblox server polls this endpoint for pending commands
app.post('/checkbans', (req, res) => {
    console.log('🎮 Roblox server checking for commands...');
    
    // Validate secret
    if (req.body.secret !== SECRET) {
        console.log('❌ Invalid secret provided from Roblox');
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    // Return all queued commands
    const commands = [...commandQueue];
    
    // Clear the queue after sending
    commandQueue = [];
    
    console.log(`✅ Sent ${commands.length} commands to Roblox server`);
    
    res.json(commands);
});

// View current queue (for debugging)
app.get('/queue', (req, res) => {
    res.json({
        queueSize: commandQueue.length,
        commands: commandQueue
    });
});

// Clear queue manually (for debugging)
app.post('/clear-queue', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    const clearedCount = commandQueue.length;
    commandQueue = [];
    
    console.log(`🗑️ Cleared ${clearedCount} commands from queue`);
    
    res.json({ 
        success: true, 
        message: `Cleared ${clearedCount} commands from queue` 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔑 Secret key: ${SECRET}`);
    console.log(`📡 Endpoints ready:`);
    console.log(`   GET  / - Health check`);
    console.log(`   POST /ban - Discord bot commands`);
    console.log(`   POST /checkbans - Roblox polling`);
    console.log(`   GET  /queue - View queue`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
