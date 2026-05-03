const { EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

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

function buildOrderEmbed(order) {
  let color = config.colors.gold;
  let description = '';

  if (order.type === 'Gold') {
    color = config.colors.gold;
    description = [
      `💰 **Gold Quantity:** ${order.goldQuantity.toLocaleString()} gold`,
      `💵 **Gold Price:** $${order.goldPrice} per 1k gold`,
      `💲 **Total Value:** ~$${((order.goldQuantity / 1000) * order.goldPrice).toFixed(2)}`,
    ].join('\n');
  } else if (order.type === 'Gems') {
    color = config.colors.gems;
    description = [
      `💎 **Gem Level:** Level ${order.gemLevel}`,
      `🪙 **Gem Value:** ${order.gemValueInGold.toLocaleString()} gold each`,
      `💵 **Gold Price:** $${order.gemGoldPrice} per 1k gold`,
      `📦 **Quantity:** ${order.gemQuantity} gems`,
      `💲 **Total Value:** ~$${(((order.gemValueInGold * order.gemQuantity) / 1000) * order.gemGoldPrice).toFixed(2)}`,
    ].join('\n');
  } else if (order.type === 'Materials') {
    color = config.colors.materials;
    description = [
      `🧱 **Material:** ${order.materialName}`,
      `🪙 **Value per unit:** ${order.materialValueInGold.toLocaleString()} gold`,
      `📦 **Quantity:** ${order.materialQuantity}`,
    ].join('\n');
  }

  const statusEmoji = {
    open: '🟢',
    partial: '🟡',
    completed: '✅',
    cancelled: '❌',
  };

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${statusEmoji[order.status] || '🟢'} [${order.orderCode}] ${order.type} Order — ${order.server}`)
    .setDescription(description)
    .addFields(
      {
        name: '📊 Quantity Remaining',
        value: `**${order.remainingQuantity}** / ${order.totalQuantity}`,
        inline: true,
      },
      {
        name: '📋 Status',
        value: order.status.charAt(0).toUpperCase() + order.status.slice(1),
        inline: true,
      }
    )
    .setFooter({ text: `Order Code: ${order.orderCode}` })
    .setTimestamp(order.createdAt);

  return embed;
}

function buildTicketEmbed(order, ticket) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`🎫 Ticket — ${order.orderCode}`)
    .addFields(
      { name: '📋 Order Type', value: order.type, inline: true },
      { name: '🌍 Server', value: order.server, inline: true },
      { name: '👤 Claimed By', value: `<@${ticket.claimedBy}>`, inline: true },
      { name: '📦 Claimed Quantity', value: `${ticket.claimedQuantity}`, inline: true },
      { name: '📊 Order Remaining', value: `${order.remainingQuantity} / ${order.totalQuantity}`, inline: true },
    )
    .setFooter({ text: `Ticket created • ${order.orderCode}` })
    .setTimestamp();

  return embed;
}

function buildLogEmbed(action, details, adminId) {
  return new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`📝 Log — ${action}`)
    .setDescription(details)
    .addFields({ name: 'By', value: `<@${adminId}>`, inline: true })
    .setTimestamp();
}

module.exports = { hasStaffPermission, hasAdminPermission, buildOrderEmbed, buildTicketEmbed, buildLogEmbed };
