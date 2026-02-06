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
let serverPlayerData = {}; // Store players by server JobId

// How long commands stay in the queue so all servers can pick them up (60 seconds)
const COMMAND_EXPIRY_MS = 60000;

// Clean up expired commands from the queue every 30 seconds
setInterval(() => {
    const now = Date.now();
    const before = commandQueue.length;
    commandQueue = commandQueue.filter(cmd => now - cmd.timestamp < COMMAND_EXPIRY_MS);
    const removed = before - commandQueue.length;
    if (removed > 0) {
        console.log(`🗑️ Removed ${removed} expired command(s) from queue`);
    }
}, 30000);

// Clean up inactive servers (servers that haven't updated in 2 minutes)
setInterval(() => {
    const now = Date.now();
    const timeout = 120000; // 2 minutes
    
    for (const [jobId, serverData] of Object.entries(serverPlayerData)) {
        if (now - serverData.lastUpdate > timeout) {
            console.log(`🗑️ Removing inactive server: ${jobId}`);
            delete serverPlayerData[jobId];
        }
    }
}, 60000); // Run every minute

// ✅ ADDED: Cleanup expired temp bans from memory every 5 minutes
setInterval(() => {
    const now = Date.now();
    let removed = 0;
    
    for (const [userId, banData] of Object.entries(banDatabase)) {
        if (banData.expiresAt && now >= banData.expiresAt) {
            delete banDatabase[userId];
            removed++;
        }
    }
    
    if (removed > 0) {
        console.log(`🗑️ Removed ${removed} expired temp ban(s) from memory`);
    }
}, 300000); // Every 5 minutes

app.get('/', (req, res) => {
    // Count total players across all servers
    let totalPlayers = 0;
    for (const serverData of Object.values(serverPlayerData)) {
        totalPlayers += serverData.players.length;
    }
    
    res.json({ 
        status: 'online', 
        queueSize: commandQueue.length,
        totalBans: Object.keys(banDatabase).length,
        currentPlayers: totalPlayers,
        activeServers: Object.keys(serverPlayerData).length,
        message: 'Roblox Ban System API - Optimized (no polling)'
    });
});

// New endpoint to receive player list from Roblox (with JobId and PlaceId)
app.post('/updateplayers', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    if (!Array.isArray(req.body.players)) {
        return res.status(400).json({ error: 'Players must be an array' });
    }
    
    if (!req.body.jobId) {
        return res.status(400).json({ error: 'JobId required' });
    }
    
    const jobId = req.body.jobId;
    const placeId = req.body.placeId || 'Unknown';
    
    serverPlayerData[jobId] = {
        players: req.body.players,
        placeId: placeId,
        lastUpdate: Date.now()
    };
    
    // Count total players
    let totalPlayers = 0;
    for (const serverData of Object.values(serverPlayerData)) {
        totalPlayers += serverData.players.length;
    }
    
    console.log(`👥 Updated server ${jobId.substring(0, 8)}... (Place: ${placeId}) - ${req.body.players.length} players (Total: ${totalPlayers} across ${Object.keys(serverPlayerData).length} servers)`);
    
    res.json({ 
        success: true, 
        playerCount: req.body.players.length,
        totalPlayers: totalPlayers,
        activeServers: Object.keys(serverPlayerData).length
    });
});

// New endpoint to get current players from ALL servers
app.post('/getplayers', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    // Combine all players from all servers
    let allPlayers = [];
    let serverCount = 0;
    let placeMap = {}; // Track unique places
    
    for (const [jobId, serverData] of Object.entries(serverPlayerData)) {
        serverCount++;
        const placeId = serverData.placeId || 'Unknown';
        
        // Count places
        if (!placeMap[placeId]) {
            placeMap[placeId] = 0;
        }
        placeMap[placeId]++;
        
        for (const player of serverData.players) {
            // Add server info and place info to each player
            allPlayers.push({
                ...player,
                serverId: jobId.substring(0, 8), // Shortened JobId for display
                placeId: placeId
            });
        }
    }
    
    // Remove duplicates (in case a player appears in multiple servers somehow)
    const uniquePlayers = [];
    const seenUserIds = new Set();
    
    for (const player of allPlayers) {
        if (!seenUserIds.has(player.userId)) {
            seenUserIds.add(player.userId);
            uniquePlayers.push(player);
        }
    }
    
    console.log(`📋 Player list requested - ${uniquePlayers.length} unique players across ${serverCount} servers in ${Object.keys(placeMap).length} place(s)`);
    
    res.json({
        success: true,
        playerCount: uniquePlayers.length,
        serverCount: serverCount,
        placeCount: Object.keys(placeMap).length,
        players: uniquePlayers
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
        banDatabase = {};
        console.log('✅ Added unban all command and cleared ban database');
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

app.post('/banlist', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }
    
    const now = Date.now();
    const activeBans = [];
    
    // ✅ Auto-cleanup expired bans when banlist is requested
    for (const [userId, banData] of Object.entries(banDatabase)) {
        if (banData.expiresAt && now >= banData.expiresAt) {
            delete banDatabase[userId];
            console.log(`🗑️ Auto-removed expired tempban for user ${userId}`);
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

// Each server sends its own lastProcessed timestamp
// We only return commands newer than that timestamp
// This way ALL servers see ALL commands
app.post('/checkbans', (req, res) => {
    if (req.body.secret !== SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }

    const lastProcessed = req.body.lastProcessed || 0;

    // Return only commands that are newer than what this server has already seen
    const commands = commandQueue.filter(cmd => cmd.timestamp > lastProcessed);

    console.log(`✅ Sent ${commands.length} commands to server (lastProcessed: ${lastProcessed}, queue size: ${commandQueue.length})`);

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
    console.log(`💰 Optimized version - temp bans expire automatically in Roblox`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
