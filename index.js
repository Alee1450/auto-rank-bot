const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});
const BLOXLINK_API_KEY = process.env.BLOXLINK_KEY;
const GUILD_ID = "1114960603262496869";
const WATCHED_ROLES = {
  "1164224293530521704": "Tester",
};
let cachedUsers = [];
let isRefreshing = false;

async function refreshUsers() {
  isRefreshing = true;
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    const members = await guild.members.fetch();
    const result = [];
    for (const [roleId, roleName] of Object.entries(WATCHED_ROLES)) {
      const testerRole = guild.roles.cache.get(roleId);
      if (!testerRole) continue;
      const roleMembers = members.filter(m => {
        if (!m.roles.cache.has(roleId)) return false;
        const hasHigherRole = m.roles.cache.some(r => r.position > testerRole.position);
        return !hasHigherRole;
      });
      for (const [, member] of roleMembers) {
        const bloxRes = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${member.user.id}`, {
          headers: { "Authorization": BLOXLINK_API_KEY }
        });
        const data = await bloxRes.json();
        if (data.robloxID) {
          result.push({
            discordId: member.user.id,
            userId: data.robloxID,
            role: roleName
          });
        }
      }
    }
    cachedUsers = result;
    console.log(`Cached ${cachedUsers.length} users`);
  } catch (e) {
    console.error("refreshUsers failed:", e);
  } finally {
    isRefreshing = false;
  }
}

client.on('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await refreshUsers();
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  for (const roleId of Object.keys(WATCHED_ROLES)) {
    if (oldMember.roles.cache.has(roleId) !== newMember.roles.cache.has(roleId)) {
      await refreshUsers();
      break;
    }
  }
});

app.get('/users', async (req, res) => {
  if (isRefreshing) {
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (!isRefreshing) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
  res.json({ users: cachedUsers });
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