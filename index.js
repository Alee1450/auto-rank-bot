const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const pendingTesters = new Set();
const BLOXLINK_API_KEY = process.env.BLOXLINK_KEY;
const GUILD_ID = "1098767779227770910";

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const testerRoleId = "1475180158989107516";
  if (!oldMember.roles.cache.has(testerRoleId) &&
       newMember.roles.cache.has(testerRoleId)) {

    const res = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${newMember.user.id}`, {
      headers: { "Authorization": BLOXLINK_API_KEY }
    });

    const data = await res.json();

    if (data.robloxID) {
      console.log(`${newMember.user.username} = Roblox ID ${data.robloxID}`);
      pendingTesters.add(JSON.stringify({
        discordId: newMember.user.id,
        robloxId: data.robloxID
      }));
    } else {
      console.log(`${newMember.user.username} is not verified on Bloxlink`);
    }
  }
});

app.get('/testers', (req, res) => {
  res.json({ testers: [...pendingTesters].map(t => JSON.parse(t)) });
  pendingTesters.clear();
});

app.listen(3000, () => console.log('Server running on port 3000'));
client.login(process.env.TOKEN);