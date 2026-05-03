const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserPrefs = require('../models/UserPrefs');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notifications')
    .setDescription('إدارة إشعارات الأوردرات عبر DM'),

  async execute(interaction) {
    let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
    if (!prefs) {
      prefs = new UserPrefs({ userId: interaction.user.id, username: interaction.user.username });
      await prefs.save();
    }

    const typeMenu = new StringSelectMenuBuilder()
      .setCustomId('notif_types')
      .setPlaceholder('اختار أنواع الأوردرات اللي تتابعها')
      .setMinValues(0)
      .setMaxValues(3)
      .addOptions([
        { label: '💰 أوردرات الجولد', value: 'Gold', default: prefs.subscribedTypes.includes('Gold') },
        { label: '💎 أوردرات الجيمز', value: 'Gems', default: prefs.subscribedTypes.includes('Gems') },
        { label: '🧱 أوردرات الماتريال', value: 'Materials', default: prefs.subscribedTypes.includes('Materials') },
      ]);

    const serverMenu = new StringSelectMenuBuilder()
      .setCustomId('notif_servers')
      .setPlaceholder('اختار السيرفرات اللي تتابعها')
      .setMinValues(0)
      .setMaxValues(5)
      .addOptions(config.servers.map(s => ({
        label: s,
        value: s,
        default: prefs.subscribedServers.includes(s),
      })));

    const toggleBtn = new ButtonBuilder()
      .setCustomId('notif_toggle_dm')
      .setLabel(prefs.dmEnabled ? '🔔 الإشعارات شغالة — اضغط للإيقاف' : '🔕 الإشعارات متوقفة — اضغط للتفعيل')
      .setStyle(prefs.dmEnabled ? ButtonStyle.Success : ButtonStyle.Secondary);

    await interaction.reply({
      content: `**📬 إعدادات الإشعارات**\nحالة الـ DM: **${prefs.dmEnabled ? 'مفعل ✅' : 'متوقف ❌'}**\n\nاختار تفضيلاتك:`,
      components: [
        new ActionRowBuilder().addComponents(typeMenu),
        new ActionRowBuilder().addComponents(serverMenu),
        new ActionRowBuilder().addComponents(toggleBtn),
      ],
      ephemeral: true,
    });
  },
};
