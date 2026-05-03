const {
  SlashCommandBuilder,
  ActionRowBuilder,
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
    .setDescription('إنشاء أوردر جديد')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('نوع الأوردر')
        .setRequired(true)
        .addChoices(
          { name: '💰 جولد', value: 'Gold' },
          { name: '💎 جيمز', value: 'Gems' },
          { name: '🧱 ماتريال', value: 'Materials' }
        )
    )
    .addStringOption(opt =>
      opt.setName('server')
        .setDescription('سيرفر Lost Ark')
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
        .setDescription('كود الأوردر (مثال: GA-1025)')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!hasStaffPermission(interaction.member)) {
      return interaction.reply({ content: '❌ ما عندكش صلاحية إنشاء أوردر.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const server = interaction.options.getString('server');
    const orderCode = interaction.options.getString('order_code').toUpperCase();

    const modal = new ModalBuilder()
      .setCustomId(`order_modal_${type}_${server}_${orderCode}`)
      .setTitle(`أوردر ${type} جديد — ${orderCode}`);

    if (type === 'Gold') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gold_amount')
            .setLabel('الكمية (رقم فقط، مثال: 100)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gold_unit')
            .setLabel('الوحدة: اكتب "ألف" أو "مليون"')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('ألف أو مليون')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gold_price')
            .setLabel('سعر 100 ألف جولد بالجنيه (مثال: 250)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('max_claim')
            .setLabel('الحد الأقصى للمستخدم (اختياري، مثال: 500000)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );
    } else if (type === 'Gems') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_level')
            .setLabel('مستوى الجيم (مثال: 10)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_price')
            .setLabel('سعر الجيم الواحد بالجنيه (مثال: 1200)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_quantity')
            .setLabel('عدد الجيمات (مثال: 3)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gem_image')
            .setLabel('لينك صورة الجيم')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('https://...')
        )
      );
    } else if (type === 'Materials') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('material_name')
            .setLabel('اسم الماتريال (مثال: أبيدوس)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('material_gold')
            .setLabel('كمية الجولد المستخدمة (مثال: 2000000)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('material_image')
            .setLabel('لينك صورة الماتريال')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('https://...')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('max_claim')
            .setLabel('الحد الأقصى للمستخدم بالجولد (اختياري)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );
    }

    await interaction.showModal(modal);
  },
};
