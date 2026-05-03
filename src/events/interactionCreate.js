const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const config = require('../../config/config');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const UserPrefs = require('../models/UserPrefs');
const { buildOrderEmbed, buildTicketEmbed, buildLogEmbed, hasAdminPermission } = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    // ── SLASH COMMANDS ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const msg = { content: '❌ An error occurred.', ephemeral: true };
        interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
      }
      return;
    }

    // ── MODAL SUBMISSIONS ───────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      // Order creation modal
      if (interaction.customId.startsWith('order_modal_')) {
        await handleOrderModal(interaction, client);
        return;
      }

      // Complete ticket modal (payment reference)
      if (interaction.customId.startsWith('complete_ticket_')) {
        await handleCompleteTicketModal(interaction, client);
        return;
      }
    }

    // ── BUTTONS ─────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('claim_order_')) {
        await handleClaimButton(interaction, client);
        return;
      }
      if (interaction.customId.startsWith('complete_ticket_btn_')) {
        await handleCompleteTicketBtn(interaction, client);
        return;
      }
      if (interaction.customId.startsWith('cancel_ticket_btn_')) {
        await handleCancelTicketBtn(interaction, client);
        return;
      }
      if (interaction.customId === 'notif_toggle_dm') {
        await handleToggleDM(interaction);
        return;
      }
    }

    // ── SELECT MENUS ────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'notif_types') {
        await handleNotifTypes(interaction);
        return;
      }
      if (interaction.customId === 'notif_servers') {
        await handleNotifServers(interaction);
        return;
      }
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDER MODAL HANDLER
// ─────────────────────────────────────────────────────────────────────────────
async function handleOrderModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const parts = interaction.customId.split('_');
  // order_modal_{type}_{server}_{orderCode}
  const type = parts[2];
  const server = parts[3];
  const orderCode = parts.slice(4).join('_');

  // Check for duplicate order code
  const existing = await Order.findOne({ orderCode });
  if (existing) {
    return interaction.editReply(`❌ Order code \`${orderCode}\` already exists.`);
  }

  let orderData = {
    orderCode,
    type,
    server,
    createdBy: interaction.user.id,
  };

  try {
    if (type === 'Gold') {
      const qty = parseFloat(interaction.fields.getTextInputValue('gold_quantity').replace(/,/g, ''));
      const price = parseFloat(interaction.fields.getTextInputValue('gold_price'));
      if (isNaN(qty) || isNaN(price)) throw new Error('Invalid numbers');
      orderData = { ...orderData, goldQuantity: qty, goldPrice: price, totalQuantity: qty, remainingQuantity: qty };

    } else if (type === 'Gems') {
      const level = parseInt(interaction.fields.getTextInputValue('gem_level'));
      const value = parseFloat(interaction.fields.getTextInputValue('gem_value').replace(/,/g, ''));
      const goldPrice = parseFloat(interaction.fields.getTextInputValue('gem_gold_price'));
      const qty = parseInt(interaction.fields.getTextInputValue('gem_quantity'));
      if ([level, value, goldPrice, qty].some(isNaN)) throw new Error('Invalid numbers');
      orderData = { ...orderData, gemLevel: level, gemValueInGold: value, gemGoldPrice: goldPrice, gemQuantity: qty, totalQuantity: qty, remainingQuantity: qty };

    } else if (type === 'Materials') {
      const name = interaction.fields.getTextInputValue('material_name');
      const value = parseFloat(interaction.fields.getTextInputValue('material_value').replace(/,/g, ''));
      const qty = parseInt(interaction.fields.getTextInputValue('material_quantity'));
      if (isNaN(value) || isNaN(qty)) throw new Error('Invalid numbers');
      orderData = { ...orderData, materialName: name, materialValueInGold: value, materialQuantity: qty, totalQuantity: qty, remainingQuantity: qty };
    }
  } catch (e) {
    return interaction.editReply('❌ Invalid input. Please enter valid numbers.');
  }

  const order = new Order(orderData);
  await order.save();

  // Build order embed + claim button
  const embed = buildOrderEmbed(order);
  const claimBtn = new ButtonBuilder()
    .setCustomId(`claim_order_${order._id}`)
    .setLabel('✋ Claim This Order')
    .setStyle(ButtonStyle.Primary);

  // Build mentions
  const serverRoleId = config.roles.servers[server];
  let mentions = serverRoleId ? `<@&${serverRoleId}>` : `**${server}**`;
  if (type === 'Gold' && config.roles.mailGold) {
    mentions += ` <@&${config.roles.mailGold}>`;
  }

  const ordersChannel = await client.channels.fetch(config.channels.orders);
  const msg = await ordersChannel.send({
    content: mentions,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(claimBtn)],
  });

  order.messageId = msg.id;
  order.channelId = msg.channelId;
  await order.save();

  // Send DMs to subscribed users
  await sendDMNotifications(client, order);

  await interaction.editReply(`✅ Order \`${orderCode}\` posted successfully!`);

  // Log
  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('Order Created', `Order \`${orderCode}\` (${type} | ${server}) created.`, interaction.user.id)] });
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM BUTTON HANDLER
// ─────────────────────────────────────────────────────────────────────────────
async function handleClaimButton(interaction, client) {
  const orderId = interaction.customId.replace('claim_order_', '');
  const order = await Order.findById(orderId);

  if (!order) return interaction.reply({ content: '❌ Order not found.', ephemeral: true });
  if (order.status === 'completed' || order.status === 'cancelled') {
    return interaction.reply({ content: `❌ This order is already **${order.status}**.`, ephemeral: true });
  }
  if (order.remainingQuantity <= 0) {
    return interaction.reply({ content: '❌ This order is fully claimed.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`claim_modal_${orderId}`)
    .setTitle(`Claim Order ${order.orderCode}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('claim_qty')
          .setLabel(`How many can you provide? (Max: ${order.remainingQuantity})`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(`1 - ${order.remainingQuantity}`)
      )
    );

  await interaction.showModal(modal);

  // Wait for modal submit
  try {
    const submitted = await interaction.awaitModalSubmit({ time: 60000, filter: i => i.user.id === interaction.user.id });
    await handleClaimModal(submitted, client, order);
  } catch (e) {
    // Timed out
  }
}

async function handleClaimModal(interaction, client, order) {
  await interaction.deferReply({ ephemeral: true });

  const qty = parseInt(interaction.fields.getTextInputValue('claim_qty'));

  if (isNaN(qty) || qty <= 0) return interaction.editReply('❌ Invalid quantity.');
  if (qty > order.remainingQuantity) {
    return interaction.editReply(`❌ You cannot claim more than **${order.remainingQuantity}**.`);
  }

  // Re-fetch to avoid race conditions
  const freshOrder = await Order.findById(order._id);
  if (qty > freshOrder.remainingQuantity) {
    return interaction.editReply(`❌ Only **${freshOrder.remainingQuantity}** remaining now.`);
  }

  freshOrder.remainingQuantity -= qty;
  freshOrder.status = freshOrder.remainingQuantity === 0 ? 'completed' : 'partial';

  const claim = {
    userId: interaction.user.id,
    username: interaction.user.username,
    quantity: qty,
  };
  freshOrder.claims.push(claim);
  await freshOrder.save();

  const claimId = freshOrder.claims[freshOrder.claims.length - 1]._id;

  // Create ticket channel
  const guild = interaction.guild;
  const category = config.channels.ticketsCategory ? await guild.channels.fetch(config.channels.ticketsCategory).catch(() => null) : null;

  const channelName = `${freshOrder.orderCode.toLowerCase()}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category || undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ...(config.roles.admin ? [{ id: config.roles.admin, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
      ...(config.roles.staff ? [{ id: config.roles.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
    ],
  });

  const ticket = new Ticket({
    orderId: freshOrder._id,
    orderCode: freshOrder.orderCode,
    claimId,
    channelId: ticketChannel.id,
    channelName,
    claimedBy: interaction.user.id,
    claimedByUsername: interaction.user.username,
    claimedQuantity: qty,
  });
  await ticket.save();

  // Update claim with ticket channel
  const claimObj = freshOrder.claims.id(claimId);
  if (claimObj) claimObj.ticketChannelId = ticketChannel.id;
  await freshOrder.save();

  // Send ticket embed with admin buttons
  const ticketEmbed = buildTicketEmbed(freshOrder, ticket);
  const completeBtn = new ButtonBuilder()
    .setCustomId(`complete_ticket_btn_${ticket._id}`)
    .setLabel('✅ Complete Ticket')
    .setStyle(ButtonStyle.Success);
  const cancelBtn = new ButtonBuilder()
    .setCustomId(`cancel_ticket_btn_${ticket._id}`)
    .setLabel('❌ Cancel Ticket')
    .setStyle(ButtonStyle.Danger);

  await ticketChannel.send({
    content: `<@${interaction.user.id}> ${config.roles.admin ? `<@&${config.roles.admin}>` : ''}`,
    embeds: [ticketEmbed],
    components: [new ActionRowBuilder().addComponents(completeBtn, cancelBtn)],
  });

  // Update order message
  try {
    const ordersChannel = await client.channels.fetch(config.channels.orders);
    const msg = await ordersChannel.messages.fetch(freshOrder.messageId);
    const updatedEmbed = buildOrderEmbed(freshOrder);
    const components = freshOrder.status === 'completed' ? [] : msg.components;
    await msg.edit({ embeds: [updatedEmbed], components });
  } catch (e) {}

  await interaction.editReply(`✅ Claimed **${qty}** units! Ticket created: <#${ticketChannel.id}>`);

  // Log
  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('Order Claimed', `<@${interaction.user.id}> claimed **${qty}** from \`${freshOrder.orderCode}\`. Remaining: ${freshOrder.remainingQuantity}/${freshOrder.totalQuantity}`, interaction.user.id)] });
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE TICKET BUTTON → shows payment modal
// ─────────────────────────────────────────────────────────────────────────────
async function handleCompleteTicketBtn(interaction, client) {
  if (!hasAdminPermission(interaction.member)) {
    return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
  }

  const ticketId = interaction.customId.replace('complete_ticket_btn_', '');

  const modal = new ModalBuilder()
    .setCustomId(`complete_ticket_${ticketId}`)
    .setTitle('Complete Ticket — Enter Payment Reference')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('payment_ref')
          .setLabel('Payment Reference / Transfer ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 548721 / Binance Transfer ID')
      )
    );

  await interaction.showModal(modal);
}

async function handleCompleteTicketModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const ticketId = interaction.customId.replace('complete_ticket_', '');
  const paymentRef = interaction.fields.getTextInputValue('payment_ref');

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return interaction.editReply('❌ Ticket not found.');
  if (ticket.status !== 'open') return interaction.editReply(`❌ Ticket is already **${ticket.status}**.`);

  ticket.status = 'completed';
  ticket.paymentReference = paymentRef;
  ticket.completedBy = interaction.user.id;
  ticket.completedAt = new Date();
  await ticket.save();

  const successEmbed = new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle('✅ Ticket Completed')
    .addFields(
      { name: 'Payment Reference', value: paymentRef, inline: true },
      { name: 'Completed By', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [successEmbed] });
  await interaction.editReply('✅ Ticket marked as completed.');

  // Disable buttons
  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 20 });
    const botMsg = msgs.find(m => m.author.bot && m.components.length > 0);
    if (botMsg) await botMsg.edit({ components: [] });
  } catch (e) {}

  // Log
  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('Ticket Completed', `Ticket \`${ticket.orderCode}\` completed. Payment ref: \`${paymentRef}\``, interaction.user.id)] });
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL TICKET BUTTON
// ─────────────────────────────────────────────────────────────────────────────
async function handleCancelTicketBtn(interaction, client) {
  if (!hasAdminPermission(interaction.member)) {
    return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketId = interaction.customId.replace('cancel_ticket_btn_', '');
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return interaction.editReply('❌ Ticket not found.');
  if (ticket.status !== 'open') return interaction.editReply(`❌ Ticket is already **${ticket.status}**.`);

  // Return quantity to order
  const order = await Order.findById(ticket.orderId);
  if (order) {
    order.remainingQuantity += ticket.claimedQuantity;
    if (order.status === 'completed' || order.status === 'partial') {
      order.status = order.remainingQuantity === order.totalQuantity ? 'open' : 'partial';
    }
    await order.save();

    // Update order message
    try {
      const ordersChannel = await client.channels.fetch(config.channels.orders);
      const msg = await ordersChannel.messages.fetch(order.messageId);
      const updatedEmbed = buildOrderEmbed(order);
      const claimBtn = new ButtonBuilder()
        .setCustomId(`claim_order_${order._id}`)
        .setLabel('✋ Claim This Order')
        .setStyle(ButtonStyle.Primary);
      await msg.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(claimBtn)] });
    } catch (e) {}
  }

  ticket.status = 'cancelled';
  ticket.cancelledBy = interaction.user.id;
  ticket.cancelledAt = new Date();
  await ticket.save();

  const cancelEmbed = new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle('❌ Ticket Cancelled')
    .addFields(
      { name: 'Cancelled By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Quantity Returned', value: `${ticket.claimedQuantity}`, inline: true },
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [cancelEmbed] });
  await interaction.editReply('✅ Ticket cancelled. Quantity returned to order.');

  // Disable buttons
  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 20 });
    const botMsg = msgs.find(m => m.author.bot && m.components.length > 0);
    if (botMsg) await botMsg.edit({ components: [] });
  } catch (e) {}

  // Log
  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('Ticket Cancelled', `Ticket \`${ticket.orderCode}\` cancelled. ${ticket.claimedQuantity} returned to order.`, interaction.user.id)] });
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// DM NOTIFICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function sendDMNotifications(client, order) {
  const subs = await UserPrefs.find({
    dmEnabled: true,
    subscribedTypes: order.type,
    $or: [
      { subscribedServers: order.server },
      { subscribedServers: { $size: 0 } },
    ],
  });

  for (const sub of subs) {
    try {
      const user = await client.users.fetch(sub.userId);
      const embed = buildOrderEmbed(order);
      await user.send({ content: `🔔 New **${order.type}** order posted on **${order.server}**!`, embeds: [embed] });
    } catch (e) { /* User may have DMs disabled */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PREFERENCE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
async function handleToggleDM(interaction) {
  let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
  if (!prefs) prefs = new UserPrefs({ userId: interaction.user.id });

  prefs.dmEnabled = !prefs.dmEnabled;
  prefs.updatedAt = new Date();
  await prefs.save();

  await interaction.reply({
    content: `✅ DM notifications **${prefs.dmEnabled ? 'enabled' : 'disabled'}**.`,
    ephemeral: true,
  });
}

async function handleNotifTypes(interaction) {
  let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
  if (!prefs) prefs = new UserPrefs({ userId: interaction.user.id });

  prefs.subscribedTypes = interaction.values;
  prefs.updatedAt = new Date();
  await prefs.save();

  await interaction.reply({
    content: `✅ Subscribed to order types: **${interaction.values.join(', ') || 'None'}**`,
    ephemeral: true,
  });
}

async function handleNotifServers(interaction) {
  let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
  if (!prefs) prefs = new UserPrefs({ userId: interaction.user.id });

  prefs.subscribedServers = interaction.values;
  prefs.updatedAt = new Date();
  await prefs.save();

  await interaction.reply({
    content: `✅ Subscribed to servers: **${interaction.values.join(', ') || 'All'}**`,
    ephemeral: true,
  });
}
