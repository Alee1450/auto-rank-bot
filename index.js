const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const pendingUsers = new Set();
const BLOXLINK_API_KEY = process.env.BLOXLINK_KEY;
const GUILD_ID = "1098767779227770910";

// add as many roles as you want here
const WATCHED_ROLES = {
  "1475214818263961701": "Tester",
};

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  for (const [roleId, roleName] of Object.entries(WATCHED_ROLES)) {
    if (!oldMember.roles.cache.has(roleId) &&
         newMember.roles.cache.has(roleId)) {

      const res = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${newMember.user.id}`, {
        headers: { "Authorization": BLOXLINK_API_KEY }
      });

      const data = await res.json();

      if (data.robloxID) {
        console.log(`${newMember.user.username} got ${roleName} = Roblox ID ${data.robloxID}`);
        pendingUsers.add(JSON.stringify({
          discordId: newMember.user.id,
          robloxId: data.robloxID,
          role: roleName
        }));
      } else {
        console.log(`${newMember.user.username} is not verified on Bloxlink`);
      }
    }
  }
});

app.get('/users', (req, res) => {
  res.json({ users: [...pendingUsers].map(u => JSON.parse(u)) });
  pendingUsers.clear();
});

app.listen(3000, () => console.log('Server running on port 3000'));
client.login(process.env.TOKEN);