const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const BLOXLINK_API_KEY = process.env.BLOXLINK_KEY;
const GUILD_ID = "1114960603262496869";

let cachedUsers = {};
let refreshingRoles = new Set();

async function refreshRole(roleName) {
  if (refreshingRoles.has(roleName)) {
    // Wait for it to finish
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (!refreshingRoles.has(roleName)) { clearInterval(check); resolve(); }
      }, 100);
    });
    return;
  }

  refreshingRoles.add(roleName);
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    const members = await guild.members.fetch();
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) return;

    const roleMembers = members.filter(m => m.roles.cache.has(role.id));
    const result = [];

for (const [, member] of roleMembers) {
  const bloxRes = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${member.user.id}`, {
    headers: { "Authorization": BLOXLINK_API_KEY }
  });
  const data = await bloxRes.json();
  if (!data.robloxID) continue;
  result.push({
    discordId: member.user.id,
    userId: data.robloxID,
    role: role.name
  });
  await new Promise(r => setTimeout(r, 1000)); // 1 second between calls = max 60/min
}

    cachedUsers[role.name] = result;
    console.log(`Cached ${result.length} users for role: ${role.name}`);
  } catch (e) {
    console.error("refreshRole failed:", e);
  } finally {
    refreshingRoles.delete(roleName);
  }
}

client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // Find roles that changed and invalidate only those
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
  for (const [, role] of [...added, ...removed]) {
    delete cachedUsers[role.name]; // invalidate so next request refreshes it
  }
});

app.get('/users', async (req, res) => {
  const roleName = req.query.role;
  if (!roleName) return res.status(400).json({ error: 'Missing ?role= query param' });

  const guild = client.guilds.cache.get(GUILD_ID);
  const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
  if (!role) return res.status(404).json({ error: `Role "${roleName}" not found` });

  // If not cached, fetch it now
  if (!cachedUsers[role.name]) {
    await refreshRole(role.name);
  }

  res.json({ users: cachedUsers[role.name] || [] });
});

app.get('/roles', (req, res) => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return res.status(500).json({ error: 'Guild not found' });
  const roles = guild.roles.cache
    .map(r => ({ id: r.id, name: r.name, position: r.position }))
    .sort((a, b) => b.position - a.position);
  res.json({ roles });
});

app.listen(3000, () => console.log('Server running on port 3000'));
client.login(process.env.TOKEN);