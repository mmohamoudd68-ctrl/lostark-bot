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
const { buildOrderEmbed, buildTicketEmbed, buildLogEmbed, hasAdminPermission, formatGold } = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const msg = { content: '❌ حصل خطأ.', ephemeral: true };
        interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('order_modal_')) {
        await handleOrderModal(interaction, client);
        return;
      }
      if (interaction.customId.startsWith('complete_ticket_')) {
        await handleCompleteTicketModal(interaction, client);
        return;
      }
    }

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

// ── ORDER MODAL ──────────────────────────────────────────────────────────────
async function handleOrderModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const parts = interaction.customId.split('_');
  const type = parts[2];
  const server = parts[3];
  const orderCode = parts.slice(4).join('_');

  const existing = await Order.findOne({ orderCode });
  if (existing) return interaction.editReply(`❌ كود الأوردر \`${orderCode}\` موجود بالفعل.`);

  let orderData = { orderCode, type, server, createdBy: interaction.user.id };

  try {
    if (type === 'Gold') {
      const rawAmount = parseFloat(interaction.fields.getTextInputValue('gold_amount').replace(/,/g, ''));
      const unit = interaction.fields.getTextInputValue('gold_unit').trim();
      const price = parseFloat(interaction.fields.getTextInputValue('gold_price'));
      const maxClaim = interaction.fields.getTextInputValue('max_claim');

      if (isNaN(rawAmount) || isNaN(price)) throw new Error('أرقام غلط');

      let goldQuantity;
      if (unit === 'مليون') goldQuantity = rawAmount * 1_000_000;
      else goldQuantity = rawAmount * 1_000; // default ألف

      const maxClaimVal = maxClaim ? parseFloat(maxClaim.replace(/,/g, '')) : null;

      orderData = {
        ...orderData,
        goldQuantity,
        goldPrice: price,
        goldUnit: unit,
        totalQuantity: goldQuantity,
        remainingQuantity: goldQuantity,
        ...(maxClaimVal && !isNaN(maxClaimVal) ? { maxClaimPerUser: maxClaimVal } : {}),
      };

    } else if (type === 'Gems') {
      const level = parseInt(interaction.fields.getTextInputValue('gem_level'));
      const price = parseFloat(interaction.fields.getTextInputValue('gem_price'));
      const qty = parseInt(interaction.fields.getTextInputValue('gem_quantity'));
      const imageUrl = interaction.fields.getTextInputValue('gem_image');

      if ([level, price, qty].some(isNaN)) throw new Error('أرقام غلط');

      orderData = {
        ...orderData,
        gemLevel: level,
        gemGoldPrice: price,
        gemQuantity: qty,
        gemImageUrl: imageUrl,
        totalQuantity: qty,
        remainingQuantity: qty,
      };

    } else if (type === 'Materials') {
      const name = interaction.fields.getTextInputValue('material_name');
      const goldAmount = parseFloat(interaction.fields.getTextInputValue('material_gold').replace(/,/g, ''));
      const imageUrl = interaction.fields.getTextInputValue('material_image');
      const maxClaim = interaction.fields.getTextInputValue('max_claim');

      if (isNaN(goldAmount)) throw new Error('أرقام غلط');

      const maxClaimVal = maxClaim ? parseFloat(maxClaim.replace(/,/g, '')) : null;

      orderData = {
        ...orderData,
        materialName: name,
        materialGoldAmount: goldAmount,
        materialImageUrl: imageUrl,
        totalQuantity: goldAmount,
        remainingQuantity: goldAmount,
        ...(maxClaimVal && !isNaN(maxClaimVal) ? { maxClaimPerUser: maxClaimVal } : {}),
      };
    }
  } catch (e) {
    return interaction.editReply('❌ إدخال غلط. تأكد من الأرقام.');
  }

  const order = new Order(orderData);
  await order.save();

  const embed = buildOrderEmbed(order);
  const claimBtn = new ButtonBuilder()
    .setCustomId(`claim_order_${order._id}`)
    .setLabel('✋ استلم الأوردر')
    .setStyle(ButtonStyle.Primary);

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

  await sendDMNotifications(client, order);
  await interaction.editReply(`✅ تم نشر الأوردر \`${orderCode}\` بنجاح!`);

  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('إنشاء أوردر', `أوردر \`${orderCode}\` (${type} | ${server}) تم إنشاؤه.`, interaction.user.id)] });
  } catch (e) {}
}

// ── CLAIM BUTTON ─────────────────────────────────────────────────────────────
async function handleClaimButton(interaction, client) {
  const orderId = interaction.customId.replace('claim_order_', '');
  const order = await Order.findById(orderId);

  if (!order) return interaction.reply({ content: '❌ الأوردر مش موجود.', ephemeral: true });
  if (order.status === 'completed' || order.status === 'cancelled') {
    return interaction.reply({ content: `❌ الأوردر **${order.status === 'completed' ? 'مكتمل' : 'ملغي'}** بالفعل.`, ephemeral: true });
  }
  if (order.remainingQuantity <= 0) {
    return interaction.reply({ content: '❌ الأوردر ده اتاخد بالكامل.', ephemeral: true });
  }

  // Check if user already hit max claim
  if (order.maxClaimPerUser) {
    const userTotal = order.claims
      .filter(c => c.userId === interaction.user.id)
      .reduce((sum, c) => sum + c.quantity, 0);
    if (userTotal >= order.maxClaimPerUser) {
      const limitDisplay = order.type === 'Gems' ? `${order.maxClaimPerUser} جيم` : formatGold(order.maxClaimPerUser);
      return interaction.reply({ content: `❌ وصلت للحد الأقصى المسموح ليك: **${limitDisplay}**`, ephemeral: true });
    }
  }

  const isGoldBased = order.type === 'Gold' || order.type === 'Materials';
  const remainDisplay = isGoldBased ? formatGold(order.remainingQuantity) : `${order.remainingQuantity} جيم`;

  let userMax = order.remainingQuantity;
  if (order.maxClaimPerUser) {
    const userTotal = order.claims.filter(c => c.userId === interaction.user.id).reduce((sum, c) => sum + c.quantity, 0);
    userMax = Math.min(order.remainingQuantity, order.maxClaimPerUser - userTotal);
  }
  const userMaxDisplay = isGoldBased ? formatGold(userMax) : `${userMax} جيم`;

  const modal = new ModalBuilder()
    .setCustomId(`claim_modal_${orderId}`)
    .setTitle(`استلام أوردر ${order.orderCode}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('claim_qty')
          .setLabel(`الكمية اللي عندك (أقصى: ${userMaxDisplay})`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(isGoldBased ? 'مثال: 500000' : `1 - ${userMax}`)
      )
    );

  await interaction.showModal(modal);

  try {
    const submitted = await interaction.awaitModalSubmit({ time: 60000, filter: i => i.user.id === interaction.user.id });
    await handleClaimModal(submitted, client, order);
  } catch (e) {}
}

async function handleClaimModal(interaction, client, order) {
  await interaction.deferReply({ ephemeral: true });

  const qty = parseFloat(interaction.fields.getTextInputValue('claim_qty').replace(/,/g, ''));

  if (isNaN(qty) || qty <= 0) return interaction.editReply('❌ كمية غلط.');

  const freshOrder = await Order.findById(order._id);

  if (qty > freshOrder.remainingQuantity) {
    const display = order.type === 'Gems' ? `${freshOrder.remainingQuantity} جيم` : formatGold(freshOrder.remainingQuantity);
    return interaction.editReply(`❌ المتبقي بس **${display}**.`);
  }

  // Check max claim per user
  if (freshOrder.maxClaimPerUser) {
    const userTotal = freshOrder.claims.filter(c => c.userId === interaction.user.id).reduce((sum, c) => sum + c.quantity, 0);
    const remaining = freshOrder.maxClaimPerUser - userTotal;
    if (qty > remaining) {
      const display = order.type === 'Gems' ? `${remaining} جيم` : formatGold(remaining);
      return interaction.editReply(`❌ متعدرش تاخد أكتر من **${display}** (حسب الحد الأقصى).`);
    }
  }

  freshOrder.remainingQuantity -= qty;
  freshOrder.status = freshOrder.remainingQuantity === 0 ? 'completed' : 'partial';

  const claim = { userId: interaction.user.id, username: interaction.user.username, quantity: qty };
  freshOrder.claims.push(claim);
  await freshOrder.save();

  const claimId = freshOrder.claims[freshOrder.claims.length - 1]._id;

  // Create ticket channel
  const guild = interaction.guild;
  const category = config.channels.ticketsCategory
    ? await guild.channels.fetch(config.channels.ticketsCategory).catch(() => null)
    : null;

  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
  const channelName = `${freshOrder.orderCode.toLowerCase()}-${safeName}`;

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

  const claimObj = freshOrder.claims.id(claimId);
  if (claimObj) claimObj.ticketChannelId = ticketChannel.id;
  await freshOrder.save();

  const ticketEmbed = buildTicketEmbed(freshOrder, ticket);
  const completeBtn = new ButtonBuilder()
    .setCustomId(`complete_ticket_btn_${ticket._id}`)
    .setLabel('✅ إكمال التيكت')
    .setStyle(ButtonStyle.Success);
  const cancelBtn = new ButtonBuilder()
    .setCustomId(`cancel_ticket_btn_${ticket._id}`)
    .setLabel('❌ إلغاء التيكت')
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

  const qtyDisplay = order.type === 'Gems' ? `${qty} جيم` : formatGold(qty);
  await interaction.editReply(`✅ تم الاستلام **${qtyDisplay}**! التيكت: <#${ticketChannel.id}>`);

  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('استلام أوردر', `<@${interaction.user.id}> استلم **${qtyDisplay}** من \`${freshOrder.orderCode}\`. المتبقي: ${freshOrder.remainingQuantity}/${freshOrder.totalQuantity}`, interaction.user.id)] });
  } catch (e) {}
}

// ── COMPLETE TICKET ──────────────────────────────────────────────────────────
async function handleCompleteTicketBtn(interaction, client) {
  if (!hasAdminPermission(interaction.member)) {
    return interaction.reply({ content: '❌ الأدمن فقط.', ephemeral: true });
  }

  const ticketId = interaction.customId.replace('complete_ticket_btn_', '');

  const modal = new ModalBuilder()
    .setCustomId(`complete_ticket_${ticketId}`)
    .setTitle('إكمال التيكت — رقم التحويل')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('payment_ref')
          .setLabel('رقم التحويل / مرجع الدفع')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('مثال: 548721 / Binance Transfer ID')
      )
    );

  await interaction.showModal(modal);
}

async function handleCompleteTicketModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const ticketId = interaction.customId.replace('complete_ticket_', '');
  const paymentRef = interaction.fields.getTextInputValue('payment_ref');

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return interaction.editReply('❌ التيكت مش موجود.');
  if (ticket.status !== 'open') return interaction.editReply(`❌ التيكت حالته **${ticket.status}** بالفعل.`);

  ticket.status = 'completed';
  ticket.paymentReference = paymentRef;
  ticket.completedBy = interaction.user.id;
  ticket.completedAt = new Date();
  await ticket.save();

  const successEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ تم إكمال التيكت')
    .addFields(
      { name: '💳 رقم التحويل', value: paymentRef, inline: true },
      { name: '👤 أكمله', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [successEmbed] });
  await interaction.editReply('✅ تم تحديد التيكت كمكتمل.');

  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 20 });
    const botMsg = msgs.find(m => m.author.bot && m.components.length > 0);
    if (botMsg) await botMsg.edit({ components: [] });
  } catch (e) {}

  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('إكمال تيكت', `تيكت \`${ticket.orderCode}\` اكتمل. رقم التحويل: \`${paymentRef}\``, interaction.user.id)] });
  } catch (e) {}
}

// ── CANCEL TICKET ────────────────────────────────────────────────────────────
async function handleCancelTicketBtn(interaction, client) {
  if (!hasAdminPermission(interaction.member)) {
    return interaction.reply({ content: '❌ الأدمن فقط.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketId = interaction.customId.replace('cancel_ticket_btn_', '');
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return interaction.editReply('❌ التيكت مش موجود.');
  if (ticket.status !== 'open') return interaction.editReply(`❌ التيكت حالته **${ticket.status}** بالفعل.`);

  const order = await Order.findById(ticket.orderId);
  if (order) {
    order.remainingQuantity += ticket.claimedQuantity;
    if (order.status === 'completed' || order.status === 'partial') {
      order.status = order.remainingQuantity === order.totalQuantity ? 'open' : 'partial';
    }
    await order.save();

    try {
      const ordersChannel = await client.channels.fetch(config.channels.orders);
      const msg = await ordersChannel.messages.fetch(order.messageId);
      const updatedEmbed = buildOrderEmbed(order);
      const claimBtn = new ButtonBuilder()
        .setCustomId(`claim_order_${order._id}`)
        .setLabel('✋ استلم الأوردر')
        .setStyle(ButtonStyle.Primary);
      await msg.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(claimBtn)] });
    } catch (e) {}
  }

  ticket.status = 'cancelled';
  ticket.cancelledBy = interaction.user.id;
  ticket.cancelledAt = new Date();
  await ticket.save();

  const qtyDisplay = order?.type === 'Gems' ? `${ticket.claimedQuantity} جيم` : formatGold(ticket.claimedQuantity);

  const cancelEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('❌ تم إلغاء التيكت')
    .addFields(
      { name: '👤 ألغاه', value: `<@${interaction.user.id}>`, inline: true },
      { name: '🔄 الكمية المُرجعة', value: qtyDisplay, inline: true },
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [cancelEmbed] });
  await interaction.editReply('✅ تم إلغاء التيكت وإرجاع الكمية للأوردر.');

  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 20 });
    const botMsg = msgs.find(m => m.author.bot && m.components.length > 0);
    if (botMsg) await botMsg.edit({ components: [] });
  } catch (e) {}

  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('إلغاء تيكت', `تيكت \`${ticket.orderCode}\` اتلغى. الكمية المُرجعة: ${qtyDisplay}`, interaction.user.id)] });
  } catch (e) {}
}

// ── DM NOTIFICATIONS ─────────────────────────────────────────────────────────
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
      await user.send({ content: `🔔 أوردر **${order.type}** جديد على **${order.server}**!`, embeds: [embed] });
    } catch (e) {}
  }
}

async function handleToggleDM(interaction) {
  let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
  if (!prefs) prefs = new UserPrefs({ userId: interaction.user.id });
  prefs.dmEnabled = !prefs.dmEnabled;
  prefs.updatedAt = new Date();
  await prefs.save();
  await interaction.reply({ content: `✅ الإشعارات **${prefs.dmEnabled ? 'مفعلة' : 'متوقفة'}**.`, ephemeral: true });
}

async function handleNotifTypes(interaction) {
  let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
  if (!prefs) prefs = new UserPrefs({ userId: interaction.user.id });
  prefs.subscribedTypes = interaction.values;
  prefs.updatedAt = new Date();
  await prefs.save();
  await interaction.reply({ content: `✅ متابع أنواع: **${interaction.values.join(', ') || 'مفيش'}**`, ephemeral: true });
}

async function handleNotifServers(interaction) {
  let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
  if (!prefs) prefs = new UserPrefs({ userId: interaction.user.id });
  prefs.subscribedServers = interaction.values;
  prefs.updatedAt = new Date();
  await prefs.save();
  await interaction.reply({ content: `✅ متابع سيرفرات: **${interaction.values.join(', ') || 'الكل'}**`, ephemeral: true });
}
