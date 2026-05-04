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
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000;
    return `${v % 1 === 0 ? v : v.toFixed(2)}M Gold`;
  }
  if (amount >= 1_000) {
    const v = amount / 1_000;
    return `${v % 1 === 0 ? v : v.toFixed(1)}K Gold`;
  }
  return `${amount} Gold`;
}

function formatGoldAr(amount) {
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000;
    return `${v % 1 === 0 ? v : v.toFixed(2)} مليون جولد`;
  }
  if (amount >= 1_000) {
    const v = amount / 1_000;
    return `${v % 1 === 0 ? v : v.toFixed(1)} ألف جولد`;
  }
  return `${amount} جولد`;
}

function formatGoldShort(amount) {
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) return `${(amount/1_000_000 % 1 === 0 ? amount/1_000_000 : (amount/1_000_000).toFixed(2))}M`;
  if (amount >= 1_000) return `${(amount/1_000 % 1 === 0 ? amount/1_000 : (amount/1_000).toFixed(1))}K`;
  return `${amount}`;
}

const STATUS_CONFIG = {
  open:      { emoji: '🟢', label: '● OPEN',      color: 0xFFD700 },
  partial:   { emoji: '🟡', label: '◑ PARTIAL',   color: 0xFFD700 },
  completed: { emoji: '✅', label: '● COMPLETED',  color: 0x00FF88 },
  cancelled: { emoji: '❌', label: '● CANCELLED',  color: 0xFF4444 },
};

const TYPE_CONFIG = {
  Gold:      { emoji: '💰', label: 'Gold Order',      color: 0xFFD700 },
  Gems:      { emoji: '💎', label: 'Gems Order',      color: 0xA855F7 },
  Materials: { emoji: '🧱', label: 'Materials Order', color: 0x22C55E },
};

function buildOrderEmbed(order) {
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };
  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.open;

  const embedColor = (order.status === 'open' || order.status === 'partial')
    ? typeConf.color : statusConf.color;

  const thumbnail = order.type === 'Gold' ? GOLD_IMAGE
    : order.type === 'Gems' ? (order.gemImageUrl || null)
    : (order.materialImageUrl || null);

  // ── Header line
  const headerLine = `**SERVER: ${order.server.toUpperCase()}**`;

  // ── Order code + status badge
  const codeLine = `\`${order.orderCode}\`  ─────────────  ${statusConf.emoji} \`${statusConf.label}\``;

  // ── Detail rows (mimic the card layout)
  let detailRows = '';
  let goalLabel = '';
  let unitsAvailable = 0;
  let goalAmount = '';
  let pct = 0;

  if (order.type === 'Gold') {
    const totalEGP = ((order.goldQuantity / 100_000) * order.goldPrice).toFixed(0);
    detailRows = [
      `> 💰  **Quantity** ${'　'.repeat(6)} \`${formatGold(order.goldQuantity)}\``,
      `> 💵  **Price / 100K** ${'　'.repeat(3)} \`${order.goldPrice} EGP\``,
      `> 💲  **Total Value** ${'　'.repeat(4)} \`~${Number(totalEGP).toLocaleString()} EGP\``,
    ].join('\n');
    unitsAvailable = order.remainingQuantity;
    goalAmount = formatGold(order.totalQuantity);
    goalLabel = `GOAL: ${formatGold(order.totalQuantity).toUpperCase()}`;
    pct = order.totalQuantity > 0 ? Math.round((order.remainingQuantity / order.totalQuantity) * 100) : 0;

  } else if (order.type === 'Gems') {
    const totalEGP = (order.gemQuantity * order.gemGoldPrice).toFixed(0);
    detailRows = [
      `> 💎  **Gem Level** ${'　'.repeat(5)} \`Level ${order.gemLevel}\``,
      `> 💵  **Price / Gem** ${'　'.repeat(4)} \`${order.gemGoldPrice} EGP\``,
      `> 💲  **Total Value** ${'　'.repeat(4)} \`~${Number(totalEGP).toLocaleString()} EGP\``,
    ].join('\n');
    unitsAvailable = order.remainingQuantity;
    goalLabel = `GOAL: ${order.totalQuantity} GEMS`;
    pct = order.totalQuantity > 0 ? Math.round((order.remainingQuantity / order.totalQuantity) * 100) : 0;

  } else if (order.type === 'Materials') {
    detailRows = [
      `> 🧱  **Material** ${'　'.repeat(6)} \`${order.materialName}\``,
      `> 🪙  **Gold Budget** ${'　'.repeat(5)} \`${formatGold(order.materialGoldAmount)}\``,
    ].join('\n');
    unitsAvailable = order.remainingQuantity;
    goalLabel = `GOAL: ${formatGold(order.totalQuantity).toUpperCase()}`;
    pct = order.totalQuantity > 0 ? Math.round((order.remainingQuantity / order.totalQuantity) * 100) : 0;
  }

  if (order.maxClaimPerUser) {
    const limitDisplay = order.type === 'Gems'
      ? `${order.maxClaimPerUser} Gems` : formatGold(order.maxClaimPerUser);
    detailRows += `\n> 🔒  **Max / User** ${'　'.repeat(5)} \`${limitDisplay}\``;
  }

  // ── Stock counter block (mimics the big number in the image)
  const stockStatus = pct === 0
    ? `OUT OF STOCK (0%)`
    : pct <= 25
    ? `LOW STOCK (${pct}%)`
    : `IN STOCK (${pct}%)`;

  const unitLabel = order.type === 'Gems' ? 'GEMS AVAILABLE' : 'UNITS AVAILABLE';
  const displayUnits = order.type === 'Gems'
    ? `${unitsAvailable}`
    : formatGoldShort(unitsAvailable);

  const stockBlock = [
    `\`\`\``,
    `  ┌─────────────────────────────┐`,
    `  │  STOCK STATUS      ${goalLabel.padEnd(12)}│`,
    `  │                             │`,
    `  │        ${displayUnits.padStart(6).padEnd(6)}               │`,
    `  │      ${unitLabel.padEnd(20)}   │`,
    `  │                             │`,
    `  │  ${pct === 0 ? '▓ ' : pct <= 25 ? '▒ ' : '░ '}${stockStatus.padEnd(28)}│`,
    `  └─────────────────────────────┘`,
    `\`\`\``,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setAuthor({
      name: `${typeConf.emoji}  ${typeConf.label}`,
      iconURL: thumbnail || undefined,
    })
    .setDescription(`${headerLine}\n${codeLine}`)
    .addFields(
      { name: '\u200b', value: detailRows },
      { name: '\u200b', value: stockBlock },
    )
    .setFooter({ text: `#${order.orderCode}  •  LOST HUB  •  SECURED TRANSACTION` })
    .setTimestamp(order.createdAt);

  if (thumbnail) embed.setThumbnail(thumbnail);

  return embed;
}

function buildTicketEmbed(order, ticket) {
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };

  const claimedDisplay = order.type === 'Gems'
    ? `${ticket.claimedQuantity} Gems` : formatGold(ticket.claimedQuantity);
  const remainingDisplay = order.type === 'Gems'
    ? `${order.remainingQuantity} / ${order.totalQuantity} Gems`
    : `${formatGold(order.remainingQuantity)} / ${formatGold(order.totalQuantity)}`;

  return new EmbedBuilder()
    .setColor(typeConf.color)
    .setAuthor({ name: `🎫  Ticket  •  ${order.orderCode}` })
    .setTitle(`${typeConf.emoji}  ${typeConf.label}  —  ${order.server}`)
    .addFields(
      { name: '👤  Claimed By',       value: `<@${ticket.claimedBy}>`,  inline: true },
      { name: '📦  Claimed Amount',   value: claimedDisplay,             inline: true },
      { name: '📊  Order Remaining',  value: remainingDisplay,           inline: true },
      { name: '🌍  Server',           value: order.server,               inline: true },
      { name: '📋  Type',             value: `${typeConf.emoji} ${typeConf.label}`, inline: true },
    )
    .setFooter({ text: `Ticket  •  ${order.orderCode}  •  Lost Hub` })
    .setTimestamp();
}

function buildDMEmbed(order) {
  const typeConf = TYPE_CONFIG[order.type] || { emoji: '📦', label: order.type, color: 0x5865F2 };
  const thumbnail = order.type === 'Gold' ? GOLD_IMAGE
    : order.type === 'Gems' ? order.gemImageUrl
    : order.materialImageUrl;

  let detailValue = '';
  if (order.type === 'Gold') {
    detailValue = `> 💰 \`${formatGold(order.goldQuantity)}\`\n> 💵 \`${order.goldPrice} EGP / 100K\``;
  } else if (order.type === 'Gems') {
    detailValue = `> 💎 Level ${order.gemLevel} — ${order.gemQuantity} Gems\n> 💵 \`${order.gemGoldPrice} EGP / Gem\``;
  } else {
    detailValue = `> 🧱 ${order.materialName}\n> 🪙 \`${formatGold(order.materialGoldAmount)}\``;
  }

  const embed = new EmbedBuilder()
    .setColor(typeConf.color)
    .setTitle(`🔔  New ${typeConf.label}!`)
    .setDescription(`A new order has been posted on **${order.server}**`)
    .addFields(
      { name: `${typeConf.emoji}  Order Details`, value: detailValue },
      { name: '🌍  Server',    value: order.server,           inline: true },
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
  buildOrderEmbed, buildTicketEmbed, buildDMEmbed, buildLogEmbed,
  formatGold, formatGoldAr,
};
