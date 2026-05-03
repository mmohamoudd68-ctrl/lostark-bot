const { EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

const GOLD_IMAGE = 'https://cdn.bynogame.com/assets/pazarimg/1747296783460-4a139cfc-0f45-4811-bff2-daa9225c6eea.png';

function hasStaffPermission(member) {
  return (
    member.permissions.has('Administrator') ||
    member.roles.cache.has(config.roles.admin) ||
    member.roles.cache.has(config.roles.staff)
  );
}

function hasAdminPermission(member) {
  return (
    member.permissions.has('Administrator') ||
    member.roles.cache.has(config.roles.admin)
  );
}

function formatGold(amount) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('ar-EG')} مليون جولد`;
  if (amount >= 1_000) return `${(amount / 1_000).toLocaleString('ar-EG')} ألف جولد`;
  return `${amount.toLocaleString('ar-EG')} جولد`;
}

const statusLabel = {
  open: '🟢 مفتوح',
  partial: '🟡 جزئي',
  completed: '✅ مكتمل',
  cancelled: '❌ ملغي',
};

const typeLabel = {
  Gold: '💰 جولد',
  Gems: '💎 جيمز',
  Materials: '🧱 ماتريال',
};

function buildOrderEmbed(order) {
  let color, thumbnail, fields = [];

  if (order.type === 'Gold') {
    color = 0xFFD700;
    thumbnail = GOLD_IMAGE;
    fields = [
      { name: '💰 كمية الجولد', value: formatGold(order.goldQuantity), inline: true },
      { name: '💵 السعر لكل 100 ألف جولد', value: `${order.goldPrice} جنيه`, inline: true },
      { name: '💲 القيمة الإجمالية', value: `~${((order.goldQuantity / 100_000) * order.goldPrice).toFixed(0)} جنيه`, inline: true },
    ];
  } else if (order.type === 'Gems') {
    color = 0x9B59B6;
    thumbnail = order.gemImageUrl || null;
    fields = [
      { name: '💎 مستوى الجيم', value: `مستوى ${order.gemLevel}`, inline: true },
      { name: '💵 سعر الجيم الواحد', value: `${order.gemGoldPrice} جنيه`, inline: true },
      { name: '📦 الكمية الإجمالية', value: `${order.gemQuantity} جيم`, inline: true },
      { name: '💲 القيمة الإجمالية', value: `~${(order.gemQuantity * order.gemGoldPrice).toFixed(0)} جنيه`, inline: true },
    ];
  } else if (order.type === 'Materials') {
    color = 0x2ECC71;
    thumbnail = order.materialImageUrl || null;
    fields = [
      { name: '🧱 اسم الماتريال', value: order.materialName, inline: true },
      { name: '🪙 كمية الجولد المستخدمة', value: formatGold(order.materialGoldAmount), inline: true },
    ];
  }

  // Add claim limit if set
  if (order.maxClaimPerUser) {
    const limitDisplay = order.type === 'Gold' || order.type === 'Materials'
      ? formatGold(order.maxClaimPerUser)
      : `${order.maxClaimPerUser} جيم`;
    fields.push({ name: '🔒 الحد الأقصى للمستخدم', value: limitDisplay, inline: true });
  }

  // Remaining quantity display
  const remainingDisplay = order.type === 'Gems'
    ? `**${order.remainingQuantity}** / ${order.totalQuantity} جيم`
    : `**${formatGold(order.remainingQuantity)}** / ${formatGold(order.totalQuantity)}`;

  fields.push(
    { name: '📊 الكمية المتبقية', value: remainingDisplay, inline: true },
    { name: '📋 الحالة', value: statusLabel[order.status] || order.status, inline: true },
    { name: '🌍 السيرفر', value: order.server, inline: true },
  );

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${statusLabel[order.status]?.split(' ')[0] || '🟢'} أوردر ${typeLabel[order.type]} — ${order.orderCode}`)
    .addFields(fields)
    .setFooter({ text: `كود الأوردر: ${order.orderCode} • ${order.server}` })
    .setTimestamp(order.createdAt);

  if (thumbnail) embed.setThumbnail(thumbnail);

  return embed;
}

function buildTicketEmbed(order, ticket) {
  const claimedDisplay = order.type === 'Gems'
    ? `${ticket.claimedQuantity} جيم`
    : formatGold(ticket.claimedQuantity);

  const remainingDisplay = order.type === 'Gems'
    ? `${order.remainingQuantity} / ${order.totalQuantity} جيم`
    : `${formatGold(order.remainingQuantity)} / ${formatGold(order.totalQuantity)}`;

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🎫 تيكت — ${order.orderCode}`)
    .addFields(
      { name: '📋 نوع الأوردر', value: typeLabel[order.type] || order.type, inline: true },
      { name: '🌍 السيرفر', value: order.server, inline: true },
      { name: '👤 استلم بواسطة', value: `<@${ticket.claimedBy}>`, inline: true },
      { name: '📦 الكمية المستلمة', value: claimedDisplay, inline: true },
      { name: '📊 المتبقي من الأوردر', value: remainingDisplay, inline: true },
    )
    .setFooter({ text: `تم إنشاء التيكت • ${order.orderCode}` })
    .setTimestamp();

  return embed;
}

function buildLogEmbed(action, details, adminId) {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📝 سجل — ${action}`)
    .setDescription(details)
    .addFields({ name: 'بواسطة', value: `<@${adminId}>`, inline: true })
    .setTimestamp();
}

module.exports = { hasStaffPermission, hasAdminPermission, buildOrderEmbed, buildTicketEmbed, buildLogEmbed, formatGold };
