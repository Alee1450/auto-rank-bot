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
  console.log("Refreshing users...");
  let guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    try {
      guild = await client.guilds.fetch(GUILD_ID);
    } catch (err) {
      console.log("Could not fetch guild:", err);
      isRefreshing = false;
      return;
    }
  }
  const members = await guild.members.fetch();
  console.log("Total members fetched:", members.size);
  const result = [];

  for (const [roleId, roleName] of Object.entries(WATCHED_ROLES)) {
    const roleMembers = members.filter(m => m.roles.cache.has(roleId));
    console.log(`Members with ${roleName}:`, roleMembers.size);
    for (const [, member] of roleMembers) {
      const bloxRes = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${member.user.id}`, {
        headers: { "Authorization": BLOXLINK_API_KEY }
      });
      const data = await bloxRes.json();
      console.log("Bloxlink:", member.user.username, JSON.stringify(data));
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
  console.log(`Cached ${cachedUsers.length} users`);
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await refreshUsers();
  } catch (err) {
    console.error("refreshUsers error:", err);
  }
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