const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config/config');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { hasAdminPermission, hasStaffPermission, buildLogEmbed } = require('../utils/helpers');

const cancelorder = {
  data: new SlashCommandBuilder()
    .setName('cancelorder')
    .setDescription('Cancel an existing order')
    .addStringOption(opt =>
      opt.setName('order_code')
        .setDescription('Order code to cancel')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!hasAdminPermission(interaction.member)) {
      return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    }

    const code = interaction.options.getString('order_code').toUpperCase();
    const order = await Order.findOne({ orderCode: code });

    if (!order) return interaction.reply({ content: `❌ Order \`${code}\` not found.`, ephemeral: true });
    if (order.status === 'cancelled') return interaction.reply({ content: `❌ Order \`${code}\` is already cancelled.`, ephemeral: true });

    order.status = 'cancelled';
    await order.save();

    // Update the order message
    try {
      const channel = await interaction.client.channels.fetch(config.channels.orders);
      const msg = await channel.messages.fetch(order.messageId);
      const { buildOrderEmbed } = require('../utils/helpers');
      await msg.edit({ embeds: [buildOrderEmbed(order)], components: [] });
    } catch (e) { /* message may be deleted */ }

    await interaction.reply({ content: `✅ Order \`${code}\` has been cancelled.`, ephemeral: true });

    // Log
    try {
      const logChannel = await interaction.client.channels.fetch(config.channels.logs);
      await logChannel.send({ embeds: [buildLogEmbed('Order Cancelled', `Order \`${code}\` was cancelled.`, interaction.user.id)] });
    } catch (e) {}
  },
};

const closealltickets = {
  data: new SlashCommandBuilder()
    .setName('close-all-tickets')
    .setDescription('Mark all completed tickets as Paid and archive them'),

  async execute(interaction) {
    if (!hasAdminPermission(interaction.member)) {
      return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tickets = await Ticket.find({ status: 'completed' });

    if (tickets.length === 0) {
      return interaction.editReply('ℹ️ No completed tickets to close.');
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
          await channel.send('💰 **This ticket has been marked as PAID and will be archived.**');
          await channel.setName(`paid-${ticket.channelName}`);
          // Optionally lock the channel
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        }
      } catch (e) {}

      closed++;
    }

    await interaction.editReply(`✅ Marked **${closed}** ticket(s) as Paid and archived.`);

    try {
      const logChannel = await interaction.client.channels.fetch(config.channels.logs);
      await logChannel.send({ embeds: [buildLogEmbed('Bulk Tickets Closed', `${closed} completed tickets marked as Paid.`, interaction.user.id)] });
    } catch (e) {}
  },
};

const vieworders = {
  data: new SlashCommandBuilder()
    .setName('vieworders')
    .setDescription('View all open/partial orders'),

  async execute(interaction) {
    if (!hasStaffPermission(interaction.member)) {
      return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    }

    const orders = await Order.find({ status: { $in: ['open', 'partial'] } }).sort({ createdAt: -1 }).limit(10);

    if (orders.length === 0) {
      return interaction.reply({ content: 'ℹ️ No open orders at the moment.', ephemeral: true });
    }

    const lines = orders.map(o =>
      `\`${o.orderCode}\` | ${o.type} | ${o.server} | Remaining: **${o.remainingQuantity}/${o.totalQuantity}** | ${o.status}`
    );

    await interaction.reply({ content: `📋 **Open Orders:**\n${lines.join('\n')}`, ephemeral: true });
  },
};

module.exports = { cancelorder, closealltickets, vieworders };
