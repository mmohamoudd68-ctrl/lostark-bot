const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const config = require('../../config/config');
const { hasStaffPermission } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('neworder')
    .setDescription('Create a new Lost Ark order')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Order type')
        .setRequired(true)
        .addChoices(
          { name: '💰 Gold', value: 'Gold' },
          { name: '💎 Gems', value: 'Gems' },
          { name: '🧱 Materials', value: 'Materials' }
        )
    )
    .addStringOption(opt =>
      opt.setName('server')
        .setDescription('Lost Ark server')
        .setRequired(true)
        .addChoices(
          { name: 'Gienah', value: 'Gienah' },
          { name: 'Arcturus', value: 'Arcturus' },
          { name: 'Ratik', value: 'Ratik' },
          { name: 'Elpon', value: 'Elpon' },
          { name: 'Ortuus', value: 'Ortuus' }
        )
    )
    .addStringOption(opt =>
      opt.setName('order_code')
        .setDescription('Unique order code (e.g. GA-1025)')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!hasStaffPermission(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to create orders.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const server = interaction.options.getString('server');
    const orderCode = interaction.options.getString('order_code').toUpperCase();

    // Build modal based on type
    const modal = new ModalBuilder()
      .setCustomId(`order_modal_${type}_${server}_${orderCode}`)
      .setTitle(`New ${type} Order — ${orderCode}`);

    if (type === 'Gold') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gold_quantity')
            .setLabel('Gold Quantity (e.g. 100000)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gold_price')
            .setLabel('Gold Price per 1k in USD (e.g. 0.25)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    } else if (type === 'Gems') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_level')
            .setLabel('Gem Level (e.g. 10)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_value')
            .setLabel('Gem Value in Gold (e.g. 500000)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_gold_price')
            .setLabel('Current Gold Price per 1k USD (e.g. 0.25)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_quantity')
            .setLabel('Gem Quantity (e.g. 3)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    } else if (type === 'Materials') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('material_name')
            .setLabel('Material Name (e.g. Abidos)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('material_value')
            .setLabel('Material Value in Gold (e.g. 2000000)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('material_quantity')
            .setLabel('Quantity (e.g. 10)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    }

    await interaction.showModal(modal);
  },
};
