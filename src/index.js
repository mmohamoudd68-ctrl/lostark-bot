require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const config = require('../config/config');

// Commands
const neworderCmd = require('./commands/neworder');
const notificationsCmd = require('./commands/notifications');
const { cancelorder, closealltickets, vieworders } = require('./commands/adminCommands');

// Events
const interactionCreate = require('./events/interactionCreate');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// Register commands
[neworderCmd, notificationsCmd, cancelorder, closealltickets, vieworders].forEach(cmd => {
  client.commands.set(cmd.data.name, cmd);
});

// Register events
client.on(interactionCreate.name, (interaction) => interactionCreate.execute(interaction, client));

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📋 Commands loaded: ${client.commands.size}`);
});

// Connect to MongoDB then start bot
mongoose.connect(config.mongoUri)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    return client.login(config.token);
  })
  .catch(err => {
    console.error('❌ Startup error:', err);
    process.exit(1);
  });
