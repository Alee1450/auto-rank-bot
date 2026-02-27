const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const BLOXLINK_API_KEY = process.env.BLOXLINK_KEY;
const GUILD_ID = process.env.GUILD_ID;
const WATCHED_ROLES = {
  "1164224293530521704": "Tester",
};

let cachedUsers = [];
let isRefreshing = false;

async function refreshUsers() {
  isRefreshing = true;
  const guild = client.guilds.cache.get(GUILD_ID);
  const members = await guild.members.fetch();
  const result = [];
  for (const [roleId, roleName] of Object.entries(WATCHED_ROLES)) {
    const roleMembers = members.filter(m => m.roles.cache.has(roleId));
    for (const [, member] of roleMembers) {
      const bloxRes = await fetch(https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${member.user.id}, {
        headers: { "Authorization": BLOXLINK_API_KEY }
      });
      const data = await bloxRes.json();
      if (data.robloxID) {
        result.push({
          discordId: member.user.id,
          robloxId: data.robloxID,
          role: roleName
        });
      }
    }
  }
  cachedUsers = result;
  isRefreshing = false;
  console.log(Cached ${cachedUsers.length} users);
}

client.on('clientReady', async () => {
  console.log(Logged in as ${client.user.tag});
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

app.listen(3000, () => console.log('Server running on port 3000'));
client.login(process.env.TOKEN);