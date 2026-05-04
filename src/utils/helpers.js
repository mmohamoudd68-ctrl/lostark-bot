const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { generateOrderImage } = require('./imageGen');
const config = require('../../config/config');

const GOLD_IMAGE = 'https://cdn.bynogame.com/assets/pazarimg/1747296783460-4a139cfc-0f45-4811-bff2-daa9225c6eea.png';

function hasStaffPermission(member) {
  return member.permissions.has('Administrator') ||
    member.roles.cache.has(config.roles.admin) ||
    member.roles.cache.has(config.roles.staff);
}
function hasAdminPermission(member) {
  return member.permissions.has('Administrator') ||
    member.roles.cache.has(config.roles.admin);
}

function formatGold(amount) {
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) { const v = amount/1_000_000; return `${v%1===0?v:v.toFixed(2)}M Gold`; }
  if (amount >= 1_000) { const v = amount/1_000; return `${v%1===0?v:v.toFixed(1)}K Gold`; }
  return `${amount} Gold`;
}
function formatGoldAr(amount) {
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) { const v = amount/1_000_000; return `${v%1===0?v:v.toFixed(2)} مليون جولد`; }
  if (amount >= 1_000) { const v = amount/1_000; return `${v%1===0?v:v.toFixed(1)} ألف جولد`; }
  return `${amount} جولد`;
}

async function buildOrderMessage(order) {
  const imgBuffer = await generateOrderImage(order);
  const attachment = new AttachmentBuilder(imgBuffer, { name: `order-${order.orderCode}.png` });
  return { attachment, imageUrl: `attachment://order-${order.orderCode}.png` };
}

function buildTicketEmbed(order, ticket) {
  const TYPE_CONFIG = {
    Gold: { emoji: '💰', label: 'Gold Order', color: 0xFFD700 },
    Gems: { emoji: '💎', label: 'Gems Order', color: 0xA855F7 },
    Materials: { emoji: '🧱', label: 'Materials Order', color: 0x22C55E },
  };
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };
  const claimedDisplay = order.type === 'Gems' ? `${ticket.claimedQuantity} Gems` : formatGold(ticket.claimedQuantity);
  const remainingDisplay = order.type === 'Gems'
    ? `${order.remainingQuantity} / ${order.totalQuantity} Gems`
    : `${formatGold(order.remainingQuantity)} / ${formatGold(order.totalQuantity)}`;

  return new EmbedBuilder()
    .setColor(typeConf.color)
    .setAuthor({ name: `🎫  Ticket  •  ${order.orderCode}` })
    .setTitle(`${typeConf.emoji}  ${typeConf.label}  —  ${order.server}`)
    .addFields(
      { name: '👤  Claimed By', value: `<@${ticket.claimedBy}>`, inline: true },
      { name: '📦  Claimed Amount', value: claimedDisplay, inline: true },
      { name: '📊  Order Remaining', value: remainingDisplay, inline: true },
      { name: '🌍  Server', value: order.server, inline: true },
      { name: '📋  Type', value: `${typeConf.emoji} ${typeConf.label}`, inline: true },
    )
    .setFooter({ text: `Ticket  •  ${order.orderCode}  •  Lost Hub` })
    .setTimestamp();
}

function buildDMEmbed(order) {
  const TYPE_CONFIG = {
    Gold: { emoji: '💰', label: 'Gold Order', color: 0xFFD700 },
    Gems: { emoji: '💎', label: 'Gems Order', color: 0xA855F7 },
    Materials: { emoji: '🧱', label: 'Materials Order', color: 0x22C55E },
  };
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };
  const thumbnail = order.type === 'Gold' ? GOLD_IMAGE : order.type === 'Gems' ? order.gemImageUrl : order.materialImageUrl;
  let detailValue = '';
  if (order.type === 'Gold') detailValue = `> 💰 \`${formatGold(order.goldQuantity)}\`\n> 💵 \`${order.goldPrice} EGP / 100K\``;
  else if (order.type === 'Gems') detailValue = `> 💎 Level ${order.gemLevel} — ${order.gemQuantity} Gems\n> 💵 \`${order.gemGoldPrice} EGP / Gem\``;
  else detailValue = `> 🧱 ${order.materialName}\n> 🪙 \`${formatGold(order.materialGoldAmount)}\``;

  const embed = new EmbedBuilder()
    .setColor(typeConf.color)
    .setTitle(`🔔  New ${typeConf.label}!`)
    .setDescription(`A new order has been posted on **${order.server}**`)
    .addFields(
      { name: `${typeConf.emoji}  Order Details`, value: detailValue },
      { name: '🌍  Server', value: order.server, inline: true },
      { name: '🆔  Order Code', value: `\`${order.orderCode}\``, inline: true },
    )
    .setFooter({ text: 'Lost Hub  •  Click below to disable notifications' })
    .setTimestamp();
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

function buildLogEmbed(action, details, adminId) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📝  Log — ${action}`)
    .setDescription(details)
    .addFields({ name: 'By', value: `<@${adminId}>`, inline: true })
    .setTimestamp();
}

module.exports = {
  hasStaffPermission, hasAdminPermission,
  buildOrderMessage, buildTicketEmbed, buildDMEmbed, buildLogEmbed,
  formatGold, formatGoldAr,
};
