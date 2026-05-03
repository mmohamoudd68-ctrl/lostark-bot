const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserPrefs = require('../models/UserPrefs');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notifications')
    .setDescription('Manage your DM notification preferences for orders'),

  async execute(interaction) {
    let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
    if (!prefs) {
      prefs = new UserPrefs({ userId: interaction.user.id, username: interaction.user.username });
      await prefs.save();
    }

    const typeMenu = new StringSelectMenuBuilder()
      .setCustomId('notif_types')
      .setPlaceholder('Select order types to subscribe to')
      .setMinValues(0)
      .setMaxValues(3)
      .addOptions([
        { label: '💰 Gold Orders', value: 'Gold', default: prefs.subscribedTypes.includes('Gold') },
        { label: '💎 Gems Orders', value: 'Gems', default: prefs.subscribedTypes.includes('Gems') },
        { label: '🧱 Materials Orders', value: 'Materials', default: prefs.subscribedTypes.includes('Materials') },
      ]);

    const serverMenu = new StringSelectMenuBuilder()
      .setCustomId('notif_servers')
      .setPlaceholder('Select servers to subscribe to')
      .setMinValues(0)
      .setMaxValues(5)
      .addOptions(config.servers.map(s => ({
        label: s,
        value: s,
        default: prefs.subscribedServers.includes(s),
      })));

    const toggleBtn = new ButtonBuilder()
      .setCustomId('notif_toggle_dm')
      .setLabel(prefs.dmEnabled ? '🔔 DMs ON — Click to Disable' : '🔕 DMs OFF — Click to Enable')
      .setStyle(prefs.dmEnabled ? ButtonStyle.Success : ButtonStyle.Secondary);

    await interaction.reply({
      content: `**📬 Notification Settings**\nCurrent DM status: **${prefs.dmEnabled ? 'Enabled ✅' : 'Disabled ❌'}**\n\nSelect your preferences below:`,
      components: [
        new ActionRowBuilder().addComponents(typeMenu),
        new ActionRowBuilder().addComponents(serverMenu),
        new ActionRowBuilder().addComponents(toggleBtn),
      ],
      ephemeral: true,
    });
  },
};
