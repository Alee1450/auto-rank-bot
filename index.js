const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const BLOXLINK_API_KEY = process.env.BLOXLINK_KEY;
const GUILD_ID = "1114960603262496869";

let cachedUsers = {};
let isRefreshing = false;

async function refreshCache() {
  isRefreshing = true;
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    const members = await guild.members.fetch();
    const newCache = {};

    for (const [, member] of members) {
      const bloxRes = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${member.user.id}`, {
        headers: { "Authorization": BLOXLINK_API_KEY }
      });
      const data = await bloxRes.json();
      if (!data.robloxID) continue;

      for (const [, role] of member.roles.cache) {
        if (role.name === '@everyone') continue;
        if (!newCache[role.name]) newCache[role.name] = [];
        newCache[role.name].push({
          discordId: member.user.id,
          userId: data.robloxID,
          role: role.name
        });
      }
    }

    cachedUsers = newCache;
    console.log(`Cache refreshed for ${Object.keys(cachedUsers).length} roles`);
  } catch (e) {
    console.error("refreshCache failed:", e);
  } finally {
    isRefreshing = false;
  }
}

async function waitForRefresh() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (!isRefreshing) { clearInterval(check); resolve(); }
    }, 100);
  });
}

client.on('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await refreshCache();
});

client.on('guildMemberUpdate', async () => {
  await refreshCache();
});

app.get('/users', async (req, res) => {
  if (isRefreshing) await waitForRefresh();

  const roleName = req.query.role;
  if (!roleName) return res.status(400).json({ error: 'Missing ?role= query param' });

  const users = cachedUsers[roleName] || [];
  res.json({ users });
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