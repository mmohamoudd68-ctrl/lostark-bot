require('dotenv').config();
const { REST, Routes } = require('discord.js');
const config = require('../config/config');

const neworderCmd = require('./commands/neworder');
const notificationsCmd = require('./commands/notifications');
const { cancelorder, closealltickets, vieworders } = require('./commands/adminCommands');

const commands = [
  neworderCmd.data.toJSON(),
  notificationsCmd.data.toJSON(),
  cancelorder.data.toJSON(),
  closealltickets.data.toJSON(),
  vieworders.data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log('✅ Slash commands registered successfully!');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();
