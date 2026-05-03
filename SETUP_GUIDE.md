# 🤖 Lost Ark Order Management Bot — Setup Guide

---

## 📋 What This Bot Does

- Create Gold / Gems / Materials orders with `/neworder`
- Auto-mentions the correct server role (Gienah, Arcturus, Ratik, Elpon, Ortuus)
- Auto-mentions **Mail Gold** role for Gold orders
- Users can claim part or full orders → auto-creates a private ticket channel
- Admins can **Complete** (with payment reference) or **Cancel** tickets
- Cancel returns quantity back to the order automatically
- Bulk close all completed tickets with `/close-all-tickets`
- DM notifications for subscribed users via `/notifications`
- Full action logs in a dedicated log channel

---

## 🔧 STEP 1 — Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name (e.g. `DarkCore Orders`)
3. Go to **Bot** tab → click **Add Bot**
4. Under **Token** → click **Reset Token** → copy and save it
5. Enable these **Privileged Gateway Intents**:
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (easiest for tickets/channels)
7. Copy the generated URL → open it → invite bot to your server

---

## 🔧 STEP 2 — Set Up MongoDB (Free)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account → create a **Free Cluster**
3. Create a database user (username + password)
4. Under **Network Access** → Add IP `0.0.0.0/0` (allow all)
5. Click **Connect → Connect your application**
6. Copy the connection string (looks like):
   `mongodb+srv://username:password@cluster.mongodb.net/lostark-bot`

---

## 🔧 STEP 3 — Set Up Discord Channels & Roles

### Create these channels in your Discord server:
| Channel | Purpose |
|---------|---------|
| `#orders` | Where orders are posted |
| `#order-logs` | Bot action logs |
| Create a **Category** called `Tickets` | For ticket channels |

### Create these roles (if they don't exist):
| Role | Purpose |
|------|---------|
| `Admin` | Full bot control |
| `Staff` | Can create orders |
| `Mail Gold` | Mentioned on Gold orders |
| `Gienah` | Mentioned for Gienah orders |
| `Arcturus` | Mentioned for Arcturus orders |
| `Ratik` | Mentioned for Ratik orders |
| `Elpon` | Mentioned for Elpon orders |
| `Ortuus` | Mentioned for Ortuus orders |

### Get IDs (enable Developer Mode first):
- Discord Settings → Advanced → **Developer Mode ON**
- Right-click any channel/role → **Copy ID**

---

## 🔧 STEP 4 — Configure the .env File

Copy `.env.example` to `.env` and fill in all values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
GUILD_ID=your_discord_server_id

MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lostark-bot

ORDERS_CHANNEL_ID=paste_orders_channel_id
TICKETS_CATEGORY_ID=paste_tickets_category_id
LOGS_CHANNEL_ID=paste_logs_channel_id

ADMIN_ROLE_ID=paste_admin_role_id
STAFF_ROLE_ID=paste_staff_role_id
MAIL_GOLD_ROLE_ID=paste_mail_gold_role_id

ROLE_GIENAH=paste_gienah_role_id
ROLE_ARCTURUS=paste_arcturus_role_id
ROLE_RATIK=paste_ratik_role_id
ROLE_ELPON=paste_elpon_role_id
ROLE_ORTUUS=paste_ortuus_role_id
```

---

## 🔧 STEP 5 — Host on Railway (Free)

1. Go to https://railway.app → sign up with GitHub
2. Create a new project → **Deploy from GitHub repo**
   - Push your bot code to a GitHub repo first, OR
   - Use Railway CLI: `railway init` then `railway up`
3. Go to your Railway project → **Variables** tab
4. Add ALL your `.env` variables there (one by one)
5. Railway will auto-deploy and keep your bot online 24/7

### Alternative: Run locally
```bash
npm install
node src/deploy-commands.js   # Register slash commands (run once)
node src/index.js              # Start the bot
```

---

## 🎮 Bot Commands

| Command | Who Can Use | Description |
|---------|------------|-------------|
| `/neworder` | Admin + Staff | Create a Gold / Gems / Materials order |
| `/cancelorder` | Admin | Cancel an order by code |
| `/vieworders` | Admin + Staff | View all open orders |
| `/close-all-tickets` | Admin | Mark all completed tickets as Paid |
| `/notifications` | Everyone | Manage DM notification preferences |

---

## 📦 Order Flow

```
1. Staff uses /neworder → fills in modal
2. Bot posts order in #orders with Claim button
3. Server role + Mail Gold (for Gold orders) are mentioned
4. Subscribed users receive a DM notification
5. User clicks "✋ Claim This Order" → enters quantity
6. Bot creates private ticket channel: ticket-GA-1025-username
7. Admin sees ticket, handles trade
8. Admin clicks:
   ✅ Complete Ticket → enters payment reference → ticket marked Completed
   ❌ Cancel Ticket  → quantity returns to order automatically
9. Admin uses /close-all-tickets to bulk-close after paying suppliers
```

---

## ❓ Troubleshooting

- **Commands not showing?** Run `node src/deploy-commands.js` again
- **Bot can't create channels?** Make sure it has `Administrator` permission
- **MongoDB error?** Check your connection string and whitelist `0.0.0.0/0` in Atlas
- **DMs not sending?** Users must allow DMs from server members in their privacy settings
