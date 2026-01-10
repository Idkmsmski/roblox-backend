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
let banDatabase = {};

app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        queueSize: commandQueue.length,
        totalBans: Object.keys(banDatabase).length,
        message: 'Roblox Ban System API'
    });
});

app.post('/ban', (req, res) => {
    console.log('Received ban request:', req.body);
    
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    if (!req.body.action) {
        return res.status(400).json({ error: 'Missing action' });
    }
    
    if (req.body.action === 'unbanall') {
        commandQueue.push({
            action: 'unbanall',
            timestamp: Date.now()
        });
        // Don't clear banDatabase here - wait for Roblox confirmation
        console.log('✅ Added unban all command');
        return res.json({ success: true, message: 'Unban all command queued' });
    }
    
    if (!req.body.userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    if (!['ban', 'tempban', 'unban'].includes(req.body.action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    const command = {
        action: req.body.action,
        userId: req.body.userId,
        reason: req.body.reason || 'No reason provided',
        timestamp: Date.now()
    };
    
    if (req.body.action === 'tempban') {
        command.duration = req.body.duration;
        command.expiresAt = Date.now() + req.body.duration;
        
        banDatabase[req.body.userId] = {
            userId: req.body.userId,
            reason: command.reason,
            expiresAt: command.expiresAt,
            bannedAt: Date.now()
        };
    } else if (req.body.action === 'ban') {
        banDatabase[req.body.userId] = {
            userId: req.body.userId,
            reason: command.reason,
            bannedAt: Date.now()
        };
    } else if (req.body.action === 'unban') {
        delete banDatabase[req.body.userId];
    }
    
    commandQueue.push(command);
    
    console.log(`✅ Added ${req.body.action} command for user ${req.body.userId}`);
    console.log(`📊 Queue size: ${commandQueue.length}`);
    
    res.json({ 
        success: true, 
        message: `User ${req.body.userId} ${req.body.action}ned successfully`
    });
});

app.post('/confirm-unbanall', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    banDatabase = {};
    console.log('✅ Confirmed unbanall - cleared ban database');
    
    res.json({ success: true });
});

app.post('/banlist', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    const now = Date.now();
    const activeBans = [];
    
    for (const [userId, banData] of Object.entries(banDatabase)) {
        if (banData.expiresAt && now >= banData.expiresAt) {
            delete banDatabase[userId];
            continue;
        }
        activeBans.push(banData);
    }
    
    console.log(`📋 Banlist requested - ${activeBans.length} active bans`);
    
    res.json({
        success: true,
        totalBans: activeBans.length,
        bans: activeBans
    });
});

app.post('/checkbans', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    const commands = [...commandQueue];
    commandQueue = [];
    
    console.log(`✅ Sent ${commands.length} commands to Roblox`);
    
    res.json(commands);
});

app.get('/queue', (req, res) => {
    res.json({
        queueSize: commandQueue.length,
        commands: commandQueue
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
