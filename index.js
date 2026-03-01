const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const BLOXLINK_API_KEY = process.env.BLOXLINK_KEY;
const GUILD_ID = "1114960603262496869";

let cachedMembers = null;

async function fetchMembers() {
  const guild = client.guilds.cache.get(GUILD_ID);
  cachedMembers = await guild.members.fetch();
}

client.on('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await fetchMembers();
});

client.on('guildMemberUpdate', async () => {
  await fetchMembers();
});

app.get('/users', async (req, res) => {
  const roleName = req.query.role;
  if (!roleName) return res.status(400).json({ error: 'Missing ?role= query param' });

  const guild = client.guilds.cache.get(GUILD_ID);
  const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
  if (!role) return res.status(404).json({ error: `Role "${roleName}" not found` });

  const members = cachedMembers || await guild.members.fetch();
  const roleMembers = members.filter(m => m.roles.cache.has(role.id));

  const result = [];
  for (const [, member] of roleMembers) {
    const bloxRes = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${member.user.id}`, {
      headers: { "Authorization": BLOXLINK_API_KEY }
    });
    const data = await bloxRes.json();
    if (data.robloxID) {
      result.push({
        discordId: member.user.id,
        userId: data.robloxID,
        role: role.name
      });
    }
  }

  res.json({ users: result });
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