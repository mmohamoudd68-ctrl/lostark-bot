require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  mongoUri: process.env.MONGODB_URI,

  channels: {
    orders: process.env.ORDERS_CHANNEL_ID,
    ticketsCategory: process.env.TICKETS_CATEGORY_ID,
    logs: process.env.LOGS_CHANNEL_ID,
  },

  roles: {
    admin: process.env.ADMIN_ROLE_ID,
    staff: process.env.STAFF_ROLE_ID,
    mailGold: process.env.MAIL_GOLD_ROLE_ID,
    servers: {
      Gienah: process.env.ROLE_GIENAH,
      Arcturus: process.env.ROLE_ARCTURUS,
      Ratik: process.env.ROLE_RATIK,
      Elpon: process.env.ROLE_ELPON,
      Ortuus: process.env.ROLE_ORTUUS,
    },
  },

  servers: ['Gienah', 'Arcturus', 'Ratik', 'Elpon', 'Ortuus'],
  orderTypes: ['Gold', 'Gems', 'Materials'],

  colors: {
    gold: 0xFFD700,
    gems: 0x9B59B6,
    materials: 0x2ECC71,
    success: 0x00FF00,
    error: 0xFF0000,
    warning: 0xFFA500,
    info: 0x3498DB,
  },

  orderStatus: {
    OPEN: 'open',
    PARTIAL: 'partial',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  ticketStatus: {
    OPEN: 'open',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    PAID: 'paid',
  },
};
