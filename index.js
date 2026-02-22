const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const pendingTesters = new Set();

client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  const testerRoleId = "1475180158989107516";
  if (!oldMember.roles.cache.has(testerRoleId) &&
       newMember.roles.cache.has(testerRoleId)) {
    console.log(`${newMember.user.username} was given Tester role`);
    pendingTesters.add(newMember.user.id);
  }
});

app.get('/testers', (req, res) => {
  res.json({ testers: [...pendingTesters] });
  pendingTesters.clear();
});
app.listen(3000, () => console.log('Server running on port 3000'));
client.login(process.env.TOKEN);
