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
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) return `${(amount / 1_000_000 % 1 === 0 ? amount / 1_000_000 : (amount / 1_000_000).toFixed(2))}M Gold`;
  if (amount >= 1_000) return `${(amount / 1_000 % 1 === 0 ? amount / 1_000 : (amount / 1_000).toFixed(1))}K Gold`;
  return `${amount} Gold`;
}

function formatGoldAr(amount) {
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) return `${(amount / 1_000_000 % 1 === 0 ? amount / 1_000_000 : (amount / 1_000_000).toFixed(2))} مليون جولد`;
  if (amount >= 1_000) return `${(amount / 1_000 % 1 === 0 ? amount / 1_000 : (amount / 1_000).toFixed(1))} ألف جولد`;
  return `${amount} جولد`;
}

// Progress bar for remaining quantity
function buildProgressBar(remaining, total, length = 12) {
  if (!total) return '░'.repeat(length);
  const filled = Math.round((remaining / total) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

const STATUS_CONFIG = {
  open:      { emoji: '🟢', label: 'Open',      color: 0x00FF88 },
  partial:   { emoji: '🟡', label: 'Partial',   color: 0xFFD700 },
  completed: { emoji: '✅', label: 'Completed', color: 0x2ECC71 },
  cancelled: { emoji: '❌', label: 'Cancelled', color: 0xFF4444 },
};

const TYPE_CONFIG = {
  Gold:      { emoji: '💰', label: 'Gold Order',      color: 0xFFD700, thumbnail: GOLD_IMAGE },
  Gems:      { emoji: '💎', label: 'Gems Order',      color: 0xA855F7 },
  Materials: { emoji: '🧱', label: 'Materials Order', color: 0x22C55E },
};

function buildOrderEmbed(order) {
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };
  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.open;

  // Use status color when not open
  const embedColor = order.status === 'open' || order.status === 'partial'
    ? typeConf.color
    : statusConf.color;

  const thumbnail = order.type === 'Gold'
    ? GOLD_IMAGE
    : order.type === 'Gems'
    ? (order.gemImageUrl || null)
    : (order.materialImageUrl || null);

  // Build details based on type
  let detailLines = [];
  let totalValueLine = '';

  if (order.type === 'Gold') {
    const totalEGP = ((order.goldQuantity / 100_000) * order.goldPrice).toFixed(0);
    detailLines = [
      `> 💰  **Quantity**   \`${formatGold(order.goldQuantity)}\``,
      `> 💵  **Price / 100K**  \`${order.goldPrice} EGP\``,
      `> 💲  **Total Value**  \`~${Number(totalEGP).toLocaleString()} EGP\``,
    ];
  } else if (order.type === 'Gems') {
    const totalEGP = (order.gemQuantity * order.gemGoldPrice).toFixed(0);
    detailLines = [
      `> 💎  **Gem Level**   \`Level ${order.gemLevel}\``,
      `> 💵  **Price / Gem**  \`${order.gemGoldPrice} EGP\``,
      `> 📦  **Total Gems**  \`${order.gemQuantity} Gems\``,
      `> 💲  **Total Value**  \`~${Number(totalEGP).toLocaleString()} EGP\``,
    ];
  } else if (order.type === 'Materials') {
    detailLines = [
      `> 🧱  **Material**   \`${order.materialName}\``,
      `> 🪙  **Gold Budget**  \`${formatGold(order.materialGoldAmount)}\``,
    ];
  }

  if (order.maxClaimPerUser) {
    const limitDisplay = order.type === 'Gems'
      ? `${order.maxClaimPerUser} Gems`
      : formatGold(order.maxClaimPerUser);
    detailLines.push(`> 🔒  **Max / User**  \`${limitDisplay}\``);
  }

  // Progress
  const progressBar = buildProgressBar(order.remainingQuantity, order.totalQuantity);
  const pct = order.totalQuantity > 0
    ? Math.round((order.remainingQuantity / order.totalQuantity) * 100)
    : 0;

  const remainDisplay = order.type === 'Gems'
    ? `${order.remainingQuantity} / ${order.totalQuantity} Gems`
    : `${formatGold(order.remainingQuantity)} / ${formatGold(order.totalQuantity)}`;

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setAuthor({
      name: `${typeConf.emoji} ${typeConf.label}  •  ${order.server}`,
      iconURL: thumbnail || undefined,
    })
    .setTitle(`\`${order.orderCode}\`  —  ${statusConf.emoji} ${statusConf.label}`)
    .addFields(
      {
        name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        value: detailLines.join('\n') || '—',
      },
      {
        name: '📊  Remaining Stock',
        value: `\`\`\`${progressBar} ${pct}%\`\`\`${remainDisplay}`,
      }
    )
    .setFooter({ text: `Order ID: ${order.orderCode}  •  Server: ${order.server}  •  Lost Hub` })
    .setTimestamp(order.createdAt);

  if (thumbnail) embed.setThumbnail(thumbnail);

  return embed;
}

function buildTicketEmbed(order, ticket) {
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };

  const claimedDisplay = order.type === 'Gems'
    ? `${ticket.claimedQuantity} Gems`
    : formatGold(ticket.claimedQuantity);

  const remainingDisplay = order.type === 'Gems'
    ? `${order.remainingQuantity} / ${order.totalQuantity} Gems`
    : `${formatGold(order.remainingQuantity)} / ${formatGold(order.totalQuantity)}`;

  return new EmbedBuilder()
    .setColor(typeConf.color)
    .setAuthor({ name: `🎫  Ticket  •  ${order.orderCode}` })
    .setTitle(`${typeConf.emoji} ${typeConf.label}  —  ${order.server}`)
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
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };
  const thumbnail = order.type === 'Gold' ? GOLD_IMAGE : order.type === 'Gems' ? order.gemImageUrl : order.materialImageUrl;

  let detailValue = '';
  if (order.type === 'Gold') {
    detailValue = `> 💰 **${formatGold(order.goldQuantity)}**\n> 💵 ${order.goldPrice} EGP / 100K`;
  } else if (order.type === 'Gems') {
    detailValue = `> 💎 Level ${order.gemLevel} — ${order.gemQuantity} Gems\n> 💵 ${order.gemGoldPrice} EGP / Gem`;
  } else {
    detailValue = `> 🧱 ${order.materialName}\n> 🪙 ${formatGold(order.materialGoldAmount)}`;
  }

  const embed = new EmbedBuilder()
    .setColor(typeConf.color)
    .setTitle(`🔔  New ${typeConf.label} Available!`)
    .setDescription(`A new order has been posted on **${order.server}**`)
    .addFields(
      { name: `${typeConf.emoji}  Order Details`, value: detailValue },
      { name: '🌍  Server', value: order.server, inline: true },
      { name: '🆔  Order Code', value: `\`${order.orderCode}\``, inline: true },
    )
    .setFooter({ text: 'Lost Hub  •  Click button below to disable notifications' })
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
  hasStaffPermission,
  hasAdminPermission,
  buildOrderEmbed,
  buildTicketEmbed,
  buildDMEmbed,
  buildLogEmbed,
  formatGold,
  formatGoldAr,
};
