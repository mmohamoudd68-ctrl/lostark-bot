const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config/config');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { hasAdminPermission, hasStaffPermission, buildLogEmbed, buildOrderEmbed } = require('../utils/helpers');

const cancelorder = {
  data: new SlashCommandBuilder()
    .setName('cancelorder')
    .setDescription('إلغاء أوردر موجود')
    .addStringOption(opt =>
      opt.setName('order_code')
        .setDescription('كود الأوردر')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!hasAdminPermission(interaction.member)) {
      return interaction.reply({ content: '❌ الأدمن فقط.', ephemeral: true });
    }

    const code = interaction.options.getString('order_code').toUpperCase();
    const order = await Order.findOne({ orderCode: code });

    if (!order) return interaction.reply({ content: `❌ الأوردر \`${code}\` مش موجود.`, ephemeral: true });
    if (order.status === 'cancelled') return interaction.reply({ content: `❌ الأوردر \`${code}\` ملغي بالفعل.`, ephemeral: true });

    order.status = 'cancelled';
    await order.save();

    try {
      const channel = await interaction.client.channels.fetch(config.channels.orders);
      const msg = await channel.messages.fetch(order.messageId);
      await msg.edit({ embeds: [buildOrderEmbed(order)], components: [] });
    } catch (e) {}

    await interaction.reply({ content: `✅ تم إلغاء الأوردر \`${code}\`.`, ephemeral: true });

    try {
      const logChannel = await interaction.client.channels.fetch(config.channels.logs);
      await logChannel.send({ embeds: [buildLogEmbed('إلغاء أوردر', `تم إلغاء الأوردر \`${code}\`.`, interaction.user.id)] });
    } catch (e) {}
  },
};

const closealltickets = {
  data: new SlashCommandBuilder()
    .setName('close-all-tickets')
    .setDescription('إغلاق جميع التيكتات المكتملة وتحديدها كمدفوعة'),

  async execute(interaction) {
    if (!hasAdminPermission(interaction.member)) {
      return interaction.reply({ content: '❌ الأدمن فقط.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tickets = await Ticket.find({ status: 'completed' });

    if (tickets.length === 0) {
      return interaction.editReply('ℹ️ مفيش تيكتات مكتملة للإغلاق.');
    }

    let closed = 0;
    for (const ticket of tickets) {
      ticket.status = 'paid';
      ticket.paidAt = new Date();
      ticket.paidBy = interaction.user.id;
      await ticket.save();

      try {
        const channel = await interaction.client.channels.fetch(ticket.channelId);
        if (channel) {
          await channel.send('💰 **تم تحديد هذا التيكت كمدفوع وسيتم أرشفته.**');
          await channel.setName(`مدفوع-${ticket.channelName}`);
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        }
      } catch (e) {}

      closed++;
    }

    await interaction.editReply(`✅ تم إغلاق **${closed}** تيكت وتحديدها كمدفوعة.`);

    try {
      const logChannel = await interaction.client.channels.fetch(config.channels.logs);
      await logChannel.send({ embeds: [buildLogEmbed('إغلاق جماعي للتيكتات', `تم إغلاق ${closed} تيكت مكتمل.`, interaction.user.id)] });
    } catch (e) {}
  },
};

const vieworders = {
  data: new SlashCommandBuilder()
    .setName('vieworders')
    .setDescription('عرض جميع الأوردرات المفتوحة'),

  async execute(interaction) {
    if (!hasStaffPermission(interaction.member)) {
      return interaction.reply({ content: '❌ الستاف فقط.', ephemeral: true });
    }

    const orders = await Order.find({ status: { $in: ['open', 'partial'] } }).sort({ createdAt: -1 }).limit(10);

    if (orders.length === 0) {
      return interaction.reply({ content: 'ℹ️ مفيش أوردرات مفتوحة حالياً.', ephemeral: true });
    }

    const lines = orders.map(o =>
      `\`${o.orderCode}\` | ${o.type} | ${o.server} | المتبقي: **${o.remainingQuantity}/${o.totalQuantity}** | ${o.status}`
    );

    await interaction.reply({ content: `📋 **الأوردرات المفتوحة:**\n${lines.join('\n')}`, ephemeral: true });
  },
};

module.exports = { cancelorder, closealltickets, vieworders };
