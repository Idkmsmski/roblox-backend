// index.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const SECRET = "ZpwHC?h!ZL09n8&_g-3$P32u£o";

let commandQueue = [];

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

app.post('/ban', (req, res) => {
    console.log('Received ban request:', req.body);
    
    if (req.body.secret !== SECRET) {
        console.log('❌ Invalid secret provided');
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    if (!req.body.action || !req.body.userId) {
        console.log('❌ Missing action or userId');
        return res.status(400).json({ error: 'Missing action or userId' });
    }
    
    if (!['ban', 'unban'].includes(req.body.action)) {
        console.log('❌ Invalid action:', req.body.action);
        return res.status(400).json({ error: 'Invalid action. Must be "ban" or "unban"' });
    }
    
    commandQueue.push({
        action: req.body.action,
        userId: req.body.userId,
        reason: req.body.reason || 'No reason provided',
        timestamp: Date.now()
    });
    
    console.log(`✅ Added ${req.body.action} command for user ${req.body.userId}`);
    console.log(`   Reason: ${req.body.reason || 'No reason provided'}`);
    console.log(`📊 Queue size: ${commandQueue.length}`);
    
    res.json({ 
        success: true, 
        message: `User ${req.body.userId} ${req.body.action}ned successfully`,
        queueSize: commandQueue.length
    });
});

app.post('/checkbans', (req, res) => {
    console.log('🎮 Roblox server checking for commands...');
    
    if (req.body.secret !== SECRET) {
        console.log('❌ Invalid secret provided from Roblox');
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    const commands = [...commandQueue];
    
    commandQueue = [];
    
    console.log(`✅ Sent ${commands.length} commands to Roblox server`);
    if (commands.length > 0) {
        console.log('Commands:', commands);
    }
    
    res.json(commands);
});

app.get('/queue', (req, res) => {
    res.json({
        queueSize: commandQueue.length,
        commands: commandQueue
    });
});

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

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔑 Secret key: ${SECRET}`);
    console.log(`📡 Endpoints ready:`);
    console.log(`   GET  / - Health check`);
    console.log(`   POST /ban - Discord bot commands`);
    console.log(`   POST /checkbans - Roblox polling`);
    console.log(`   GET  /queue - View queue`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
