const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const config = require('../../config/config');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const UserPrefs = require('../models/UserPrefs');
const {
  buildOrderMessage, buildTicketEmbed, buildDMEmbed,
  buildLogEmbed, hasAdminPermission, formatGold, formatGoldAr,
} = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try { await command.execute(interaction); }
      catch (err) {
        console.error(err);
        const msg = { content: '❌ حصل خطأ.', ephemeral: true };
        interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('order_modal_')) { await handleOrderModal(interaction, client); return; }
      if (interaction.customId.startsWith('complete_ticket_')) { await handleCompleteTicketModal(interaction, client); return; }
      if (interaction.customId.startsWith('claim_qty_modal_')) { await handleClaimQtyModal(interaction, client); return; }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('claim_order_')) { await handleClaimButton(interaction, client); return; }
      if (interaction.customId.startsWith('complete_ticket_btn_')) { await handleCompleteTicketBtn(interaction, client); return; }
      if (interaction.customId.startsWith('cancel_ticket_btn_')) { await handleCancelTicketBtn(interaction, client); return; }
      if (interaction.customId === 'notif_toggle_dm') { await handleToggleDM(interaction); return; }
      if (interaction.customId === 'disable_notif_dm') { await handleDisableNotifDM(interaction); return; }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('claim_unit_')) { await handleClaimUnitSelect(interaction, client); return; }
      if (interaction.customId === 'notif_types') { await handleNotifTypes(interaction); return; }
      if (interaction.customId === 'notif_servers') { await handleNotifServers(interaction); return; }
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
      if (isNaN(rawAmount) || isNaN(price)) throw new Error();
      const goldQuantity = unit === 'مليون' ? rawAmount * 1_000_000 : rawAmount * 1_000;
      const maxClaimVal = maxClaim ? parseFloat(maxClaim.replace(/,/g, '')) : null;
      orderData = { ...orderData, goldQuantity, goldPrice: price, goldUnit: unit, totalQuantity: goldQuantity, remainingQuantity: goldQuantity, ...(maxClaimVal && !isNaN(maxClaimVal) ? { maxClaimPerUser: maxClaimVal } : {}) };
    } else if (type === 'Gems') {
      const level = parseInt(interaction.fields.getTextInputValue('gem_level'));
      const price = parseFloat(interaction.fields.getTextInputValue('gem_price'));
      const qty = parseInt(interaction.fields.getTextInputValue('gem_quantity'));
      const imageUrl = interaction.fields.getTextInputValue('gem_image');
      if ([level, price, qty].some(isNaN)) throw new Error();
      orderData = { ...orderData, gemLevel: level, gemGoldPrice: price, gemQuantity: qty, gemImageUrl: imageUrl, totalQuantity: qty, remainingQuantity: qty };
    } else if (type === 'Materials') {
      const name = interaction.fields.getTextInputValue('material_name');
      const goldAmount = parseFloat(interaction.fields.getTextInputValue('material_gold').replace(/,/g, ''));
      const imageUrl = interaction.fields.getTextInputValue('material_image');
      const maxClaim = interaction.fields.getTextInputValue('max_claim');
      if (isNaN(goldAmount)) throw new Error();
      const maxClaimVal = maxClaim ? parseFloat(maxClaim.replace(/,/g, '')) : null;
      orderData = { ...orderData, materialName: name, materialGoldAmount: goldAmount, materialImageUrl: imageUrl, totalQuantity: goldAmount, remainingQuantity: goldAmount, ...(maxClaimVal && !isNaN(maxClaimVal) ? { maxClaimPerUser: maxClaimVal } : {}) };
    }
  } catch (e) {
    return interaction.editReply('❌ إدخال غلط. تأكد من الأرقام.');
  }

  const order = new Order(orderData);
  await order.save();

  const { attachment } = await buildOrderMessage(order);
  const claimBtn = new ButtonBuilder()
    .setCustomId(`claim_order_${order._id}`)
    .setLabel('✋  Claim Order')
    .setStyle(ButtonStyle.Primary);

  const serverRoleId = config.roles.servers[server];
  let mentions = serverRoleId ? `<@&${serverRoleId}>` : `**${server}**`;
  if (type === 'Gold' && config.roles.mailGold) mentions += ` <@&${config.roles.mailGold}>`;

  const ordersChannel = await client.channels.fetch(config.channels.orders);
  const msg = await ordersChannel.send({
    content: mentions,
    files: [attachment],
    components: [new ActionRowBuilder().addComponents(claimBtn)],
  });

  order.messageId = msg.id;
  order.channelId = msg.channelId;
  await order.save();

  await sendDMNotifications(client, order, interaction.guild);
  await interaction.editReply(`✅ تم نشر الأوردر \`${orderCode}\` بنجاح!`);

  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('إنشاء أوردر', `أوردر \`${orderCode}\` (${type} | ${server}) تم إنشاؤه.`, interaction.user.id)] });
  } catch (e) {}
}

// ── CLAIM BUTTON → show unit selector ───────────────────────────────────────
async function handleClaimButton(interaction, client) {
  const orderId = interaction.customId.replace('claim_order_', '');
  const order = await Order.findById(orderId);

  if (!order) return interaction.reply({ content: '❌ الأوردر مش موجود.', ephemeral: true });
  if (order.status === 'completed' || order.status === 'cancelled') {
    return interaction.reply({ content: `❌ الأوردر ${order.status === 'completed' ? 'مكتمل' : 'ملغي'} بالفعل.`, ephemeral: true });
  }
  if (order.remainingQuantity <= 0) return interaction.reply({ content: '❌ الأوردر ده اتاخد بالكامل.', ephemeral: true });

  // Check user max
  if (order.maxClaimPerUser) {
    const userTotal = order.claims.filter(c => c.userId === interaction.user.id).reduce((s, c) => s + c.quantity, 0);
    if (userTotal >= order.maxClaimPerUser) {
      const limitDisplay = order.type === 'Gems' ? `${order.maxClaimPerUser} جيم` : formatGoldAr(order.maxClaimPerUser);
      return interaction.reply({ content: `❌ وصلت للحد الأقصى: **${limitDisplay}**`, ephemeral: true });
    }
  }

  // For Gems → go directly to modal
  if (order.type === 'Gems') {
    const userMax = getUserMax(order, interaction.user.id);
    const modal = new ModalBuilder()
      .setCustomId(`claim_qty_modal_${orderId}_none`)
      .setTitle(`Claim Order ${order.orderCode}`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('claim_value')
            .setLabel(`عدد الجيمات (أقصى: ${userMax})`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(`1 - ${userMax}`)
        )
      );
    return interaction.showModal(modal);
  }

  // For Gold/Materials → show unit selector first
  const remainDisplay = formatGoldAr(order.remainingQuantity);
  const unitSelect = new StringSelectMenuBuilder()
    .setCustomId(`claim_unit_${orderId}`)
    .setPlaceholder('اختار الوحدة')
    .addOptions([
      { label: 'ألف (K)', value: 'ألف', description: 'مثال: 500 = 500,000 جولد', emoji: '🔢' },
      { label: 'مليون (M)', value: 'مليون', description: 'مثال: 1 = 1,000,000 جولد', emoji: '💎' },
    ]);

  await interaction.reply({
    content: `**✋ استلام أوردر \`${order.orderCode}\`**\n> 📊 المتبقي: **${remainDisplay}**\n\nاختار وحدة الكمية:`,
    components: [new ActionRowBuilder().addComponents(unitSelect)],
    ephemeral: true,
  });
}

// ── UNIT SELECT → show qty modal ─────────────────────────────────────────────
async function handleClaimUnitSelect(interaction, client) {
  const orderId = interaction.customId.replace('claim_unit_', '');
  const unit = interaction.values[0]; // 'ألف' or 'مليون'
  const order = await Order.findById(orderId);
  if (!order) return interaction.update({ content: '❌ الأوردر مش موجود.', components: [] });

  const userMax = getUserMax(order, interaction.user.id);
  const userMaxDisplay = unit === 'مليون'
    ? `${(userMax / 1_000_000).toFixed(2)} مليون`
    : `${(userMax / 1_000).toFixed(0)} ألف`;

  const modal = new ModalBuilder()
    .setCustomId(`claim_qty_modal_${orderId}_${unit}`)
    .setTitle(`Claim Order ${order.orderCode}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('claim_value')
          .setLabel(`الكمية بـ${unit} (أقصى: ${userMaxDisplay})`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(unit === 'مليون' ? 'مثال: 1' : 'مثال: 500')
      )
    );

  await interaction.showModal(modal);
}

// ── CLAIM QTY MODAL SUBMIT ───────────────────────────────────────────────────
async function handleClaimQtyModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const parts = interaction.customId.replace('claim_qty_modal_', '').split('_');
  const unit = parts[parts.length - 1];
  const orderId = parts.slice(0, -1).join('_');

  const order = await Order.findById(orderId);
  if (!order) return interaction.editReply('❌ الأوردر مش موجود.');

  const rawValue = parseFloat(interaction.fields.getTextInputValue('claim_value').replace(/,/g, ''));
  if (isNaN(rawValue) || rawValue <= 0) return interaction.editReply('❌ كمية غلط.');

  let qty;
  if (order.type === 'Gems') {
    qty = rawValue;
  } else if (unit === 'مليون') {
    qty = rawValue * 1_000_000;
  } else {
    qty = rawValue * 1_000;
  }

  const freshOrder = await Order.findById(orderId);

  if (qty > freshOrder.remainingQuantity) {
    const display = order.type === 'Gems' ? `${freshOrder.remainingQuantity} جيم` : formatGoldAr(freshOrder.remainingQuantity);
    return interaction.editReply(`❌ المتبقي بس **${display}**.`);
  }

  if (freshOrder.maxClaimPerUser) {
    const userTotal = freshOrder.claims.filter(c => c.userId === interaction.user.id).reduce((s, c) => s + c.quantity, 0);
    const remaining = freshOrder.maxClaimPerUser - userTotal;
    if (qty > remaining) {
      const display = order.type === 'Gems' ? `${remaining} جيم` : formatGoldAr(remaining);
      return interaction.editReply(`❌ متعدرش تاخد أكتر من **${display}** (الحد الأقصى).`);
    }
  }

  freshOrder.remainingQuantity -= qty;
  freshOrder.status = freshOrder.remainingQuantity === 0 ? 'completed' : 'partial';
  freshOrder.claims.push({ userId: interaction.user.id, username: interaction.user.username, quantity: qty });
  await freshOrder.save();

  const claimId = freshOrder.claims[freshOrder.claims.length - 1]._id;

  // Create ticket channel
  const guild = interaction.guild;
  const category = config.channels.ticketsCategory
    ? await guild.channels.fetch(config.channels.ticketsCategory).catch(() => null) : null;
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
    orderId: freshOrder._id, orderCode: freshOrder.orderCode, claimId,
    channelId: ticketChannel.id, channelName,
    claimedBy: interaction.user.id, claimedByUsername: interaction.user.username,
    claimedQuantity: qty,
  });
  await ticket.save();

  const claimObj = freshOrder.claims.id(claimId);
  if (claimObj) claimObj.ticketChannelId = ticketChannel.id;
  await freshOrder.save();

  const ticketEmbed = buildTicketEmbed(freshOrder, ticket);
  const completeBtn = new ButtonBuilder().setCustomId(`complete_ticket_btn_${ticket._id}`).setLabel('✅  Complete Ticket').setStyle(ButtonStyle.Success);
  const cancelBtn = new ButtonBuilder().setCustomId(`cancel_ticket_btn_${ticket._id}`).setLabel('❌  Cancel Ticket').setStyle(ButtonStyle.Danger);

  await ticketChannel.send({
    content: `<@${interaction.user.id}> ${config.roles.admin ? `<@&${config.roles.admin}>` : ''}`,
    embeds: [ticketEmbed],
    components: [new ActionRowBuilder().addComponents(completeBtn, cancelBtn)],
  });

  // Update order message
  try {
    const ordersChannel = await client.channels.fetch(config.channels.orders);
    const msg = await ordersChannel.messages.fetch(freshOrder.messageId);
    const { attachment: updatedAttachment } = await buildOrderMessage(freshOrder);
    const components = freshOrder.status === 'completed' ? [] : msg.components;
    await msg.edit({ files: [updatedAttachment], components, attachments: [] });
  } catch (e) {}

  const qtyDisplay = order.type === 'Gems' ? `${qty} جيم` : formatGoldAr(qty);
  await interaction.editReply(`✅ تم استلام **${qtyDisplay}** بنجاح!\n🎫 التيكت: <#${ticketChannel.id}>`);

  try {
    const logChannel = await client.channels.fetch(config.channels.logs);
    await logChannel.send({ embeds: [buildLogEmbed('استلام أوردر', `<@${interaction.user.id}> استلم **${qtyDisplay}** من \`${freshOrder.orderCode}\`. المتبقي: ${freshOrder.remainingQuantity}/${freshOrder.totalQuantity}`, interaction.user.id)] });
  } catch (e) {}
}

// ── COMPLETE TICKET ──────────────────────────────────────────────────────────
async function handleCompleteTicketBtn(interaction, client) {
  if (!hasAdminPermission(interaction.member)) return interaction.reply({ content: '❌ الأدمن فقط.', ephemeral: true });
  const ticketId = interaction.customId.replace('complete_ticket_btn_', '');
  const modal = new ModalBuilder()
    .setCustomId(`complete_ticket_${ticketId}`)
    .setTitle('Complete Ticket — Payment Reference')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('payment_ref').setLabel('رقم التحويل / مرجع الدفع').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('مثال: 548721 / Binance ID')
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

  ticket.status = 'completed'; ticket.paymentReference = paymentRef;
  ticket.completedBy = interaction.user.id; ticket.completedAt = new Date();
  await ticket.save();

  const successEmbed = new EmbedBuilder().setColor(0x00FF88).setTitle('✅  Ticket Completed')
    .addFields(
      { name: '💳  Payment Reference', value: `\`${paymentRef}\``, inline: true },
      { name: '👤  Completed By', value: `<@${interaction.user.id}>`, inline: true },
    ).setTimestamp();

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
  if (!hasAdminPermission(interaction.member)) return interaction.reply({ content: '❌ الأدمن فقط.', ephemeral: true });
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
      const claimBtn = new ButtonBuilder().setCustomId(`claim_order_${order._id}`).setLabel('✋  Claim Order').setStyle(ButtonStyle.Primary);
      const { attachment: cancelAttachment } = await buildOrderMessage(order);
      await msg.edit({ files: [cancelAttachment], attachments: [], components: [new ActionRowBuilder().addComponents(claimBtn)] });
    } catch (e) {}
  }

  ticket.status = 'cancelled'; ticket.cancelledBy = interaction.user.id; ticket.cancelledAt = new Date();
  await ticket.save();

  const qtyDisplay = order?.type === 'Gems' ? `${ticket.claimedQuantity} Gems` : formatGold(ticket.claimedQuantity);
  const cancelEmbed = new EmbedBuilder().setColor(0xFF4444).setTitle('❌  Ticket Cancelled')
    .addFields(
      { name: '👤  Cancelled By', value: `<@${interaction.user.id}>`, inline: true },
      { name: '🔄  Quantity Returned', value: qtyDisplay, inline: true },
    ).setTimestamp();

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
async function sendDMNotifications(client, order, guild) {
  // Get all members with any server role
  const serverRoleIds = Object.values(config.roles.servers).filter(Boolean);
  if (!serverRoleIds.length) return;

  try {
    await guild.members.fetch();
  } catch (e) {}

  const sentTo = new Set();

  for (const roleId of serverRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;

    for (const [memberId, member] of role.members) {
      if (sentTo.has(memberId) || member.user.bot) continue;
      sentTo.add(memberId);

      // Check if user has disabled DMs
      const prefs = await UserPrefs.findOne({ userId: memberId });
      if (prefs && prefs.dmEnabled === false) continue;

      try {
        const dmEmbed = buildDMEmbed(order);
        const disableBtn = new ButtonBuilder()
          .setCustomId('disable_notif_dm')
          .setLabel('🔕  إيقاف الإشعارات')
          .setStyle(ButtonStyle.Secondary);

        await member.user.send({
          embeds: [dmEmbed],
          components: [new ActionRowBuilder().addComponents(disableBtn)],
        });
      } catch (e) { /* DMs disabled by user */ }
    }
  }
}

async function handleDisableNotifDM(interaction) {
  let prefs = await UserPrefs.findOne({ userId: interaction.user.id });
  if (!prefs) prefs = new UserPrefs({ userId: interaction.user.id });
  prefs.dmEnabled = false;
  prefs.updatedAt = new Date();
  await prefs.save();

  await interaction.reply({
    content: '🔕 **تم إيقاف الإشعارات.**\nمش هتوصلك تنبيهات جديدة.\nعشان تفعلها تاني استخدم `/notifications` في السيرفر.',
    ephemeral: true,
  });

  // Remove the disable button from the DM message
  try {
    await interaction.message.edit({ components: [] });
  } catch (e) {}
}

// ── NOTIFICATION PREFS ───────────────────────────────────────────────────────
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

// ── HELPER ───────────────────────────────────────────────────────────────────
function getUserMax(order, userId) {
  let userMax = order.remainingQuantity;
  if (order.maxClaimPerUser) {
    const userTotal = order.claims.filter(c => c.userId === userId).reduce((s, c) => s + c.quantity, 0);
    userMax = Math.min(order.remainingQuantity, order.maxClaimPerUser - userTotal);
  }
  return userMax;
}
