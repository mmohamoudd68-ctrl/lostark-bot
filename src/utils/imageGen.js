const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Register fonts
const fontPath = path.join(__dirname, '../../assets/Roboto.ttf');
const monoPath = path.join(__dirname, '../../assets/RobotoMono.ttf');
try { GlobalFonts.registerFromPath(fontPath, 'Roboto'); } catch(e) {}
try { GlobalFonts.registerFromPath(monoPath, 'RobotoMono'); } catch(e) {}

const GOLD_IMAGE_URL = 'https://cdn.bynogame.com/assets/pazarimg/1747296783460-4a139cfc-0f45-4811-bff2-daa9225c6eea.png';

const TYPE_CONFIG = {
  Gold:      { label: 'Gold Order',      accent: '#FFD700', glow: '#FFD70088', secondary: '#FFA500' },
  Gems:      { label: 'Gems Order',      accent: '#A855F7', glow: '#A855F788', secondary: '#7C3AED' },
  Materials: { label: 'Materials Order', accent: '#22C55E', glow: '#22C55E88', secondary: '#16A34A' },
};
const STATUS_CONFIG = {
  open:      { label: 'OPEN',      color: '#00FF88' },
  partial:   { label: 'PARTIAL',   color: '#FFD700' },
  completed: { label: 'COMPLETED', color: '#00FF88' },
  cancelled: { label: 'CANCELLED', color: '#FF4444' },
};

function formatGold(amount) {
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) { const v = amount/1_000_000; return `${v%1===0?v:v.toFixed(2)}M Gold`; }
  if (amount >= 1_000) { const v = amount/1_000; return `${v%1===0?v:v.toFixed(1)}K Gold`; }
  return `${amount} Gold`;
}
function formatGoldShort(amount) {
  if (!amount && amount !== 0) return '0';
  if (amount >= 1_000_000) { const v = amount/1_000_000; return `${v%1===0?v:v.toFixed(2)}M`; }
  if (amount >= 1_000) { const v = amount/1_000; return `${v%1===0?v:v.toFixed(1)}K`; }
  return `${amount}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

async function generateOrderImage(order) {
  const W = 700, H = 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const typeConf = TYPE_CONFIG[order.type] || TYPE_CONFIG.Gold;
  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.open;
  const accent = typeConf.accent;
  const glow = typeConf.glow;

  // ── Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0A0A0F');
  bgGrad.addColorStop(0.5, '#0F0F1A');
  bgGrad.addColorStop(1, '#0A0A0F');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();

  // ── Glowing border
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 24;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  roundRect(ctx, 2, 2, W-4, H-4, 16);
  ctx.stroke();
  ctx.restore();

  // ── Top accent bar
  const barGrad = ctx.createLinearGradient(0, 0, W, 0);
  barGrad.addColorStop(0, typeConf.secondary);
  barGrad.addColorStop(0.5, accent);
  barGrad.addColorStop(1, typeConf.secondary);
  ctx.fillStyle = barGrad;
  ctx.save(); roundRect(ctx, 2, 2, W-4, 4, 2); ctx.fill(); ctx.restore();

  // ── Left strip
  const stripGrad = ctx.createLinearGradient(0, 0, 0, H);
  stripGrad.addColorStop(0, accent);
  stripGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = stripGrad;
  ctx.fillRect(2, 6, 4, H-20);

  // ── Thumbnail (top right)
  let thumb = null;
  try {
    const imgUrl = order.type === 'Gold' ? GOLD_IMAGE_URL
      : order.type === 'Gems' ? order.gemImageUrl
      : order.materialImageUrl;
    if (imgUrl) thumb = await loadImage(imgUrl);
  } catch(e) {}

  if (thumb) {
    const tx = W-110, ty = 18, ts = 90;
    ctx.save();
    ctx.beginPath();
    ctx.arc(tx+ts/2, ty+ts/2, ts/2, 0, Math.PI*2);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(thumb, tx, ty, ts, ts);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = 18;
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tx+ts/2, ty+ts/2, ts/2, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // ── Title
  ctx.font = 'bold 26px Roboto';
  ctx.fillStyle = accent;
  ctx.shadowColor = glow; ctx.shadowBlur = 10;
  ctx.fillText(typeConf.label, 28, 50);
  ctx.shadowBlur = 0;

  // ── Server
  ctx.font = '13px Roboto';
  ctx.fillStyle = '#888888';
  ctx.fillText(`SERVER: ${order.server.toUpperCase()}`, 28, 72);

  // ── Code pill
  ctx.fillStyle = '#1A1A2E';
  roundRect(ctx, 28, 84, 160, 28, 6); ctx.fill();
  ctx.strokeStyle = accent+'66'; ctx.lineWidth = 1;
  roundRect(ctx, 28, 84, 160, 28, 6); ctx.stroke();
  ctx.font = 'bold 14px RobotoMono';
  ctx.fillStyle = accent;
  ctx.fillText(order.orderCode, 40, 103);

  // ── Status badge
  ctx.fillStyle = statusConf.color+'22';
  roundRect(ctx, 200, 84, 120, 28, 14); ctx.fill();
  ctx.strokeStyle = statusConf.color; ctx.lineWidth = 1;
  roundRect(ctx, 200, 84, 120, 28, 14); ctx.stroke();
  ctx.fillStyle = statusConf.color;
  ctx.beginPath(); ctx.arc(216, 98, 5, 0, Math.PI*2); ctx.fill();
  ctx.font = 'bold 12px Roboto';
  ctx.fillStyle = statusConf.color;
  ctx.fillText(statusConf.label, 226, 103);

  // ── Divider
  const divGrad = ctx.createLinearGradient(28, 0, W-28, 0);
  divGrad.addColorStop(0, accent+'88'); divGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = divGrad;
  ctx.fillRect(28, 124, W-56, 1);

  // ── Detail rows
  const rows = [];
  if (order.type === 'Gold') {
    const totalEGP = ((order.goldQuantity/100_000)*order.goldPrice).toFixed(0);
    rows.push(['Quantity',     formatGold(order.goldQuantity)]);
    rows.push(['Price / 100K', `${order.goldPrice} EGP`]);
    rows.push(['Total Value',  `~${Number(totalEGP).toLocaleString()} EGP`]);
  } else if (order.type === 'Gems') {
    const totalEGP = (order.gemQuantity*order.gemGoldPrice).toFixed(0);
    rows.push(['Gem Level',    `Level ${order.gemLevel}`]);
    rows.push(['Price / Gem',  `${order.gemGoldPrice} EGP`]);
    rows.push(['Total Value',  `~${Number(totalEGP).toLocaleString()} EGP`]);
  } else {
    rows.push(['Material',    order.materialName]);
    rows.push(['Gold Budget', formatGold(order.materialGoldAmount)]);
  }
  if (order.maxClaimPerUser) {
    const lim = order.type === 'Gems' ? `${order.maxClaimPerUser} Gems` : formatGold(order.maxClaimPerUser);
    rows.push(['Max / User', lim]);
  }

  let rowY = 148;
  for (const [label, value] of rows) {
    ctx.fillStyle = '#FFFFFF08';
    roundRect(ctx, 28, rowY-18, 390, 30, 6); ctx.fill();

    ctx.font = '14px Roboto';
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText(label, 44, rowY);

    ctx.font = 'bold 13px RobotoMono';
    ctx.fillStyle = '#FFFFFF';
    const valW = ctx.measureText(value).width + 20;
    ctx.fillStyle = accent+'22';
    roundRect(ctx, 430-valW, rowY-16, valW, 24, 5); ctx.fill();
    ctx.font = 'bold 13px RobotoMono';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(value, 440-valW, rowY);

    rowY += 36;
  }

  // ── Stock box (right side)
  const sx = 470, sy = 130, sw = 200, sh = 200;
  ctx.fillStyle = '#FFFFFF06';
  roundRect(ctx, sx, sy, sw, sh, 10); ctx.fill();
  ctx.strokeStyle = accent+'44'; ctx.lineWidth = 1;
  roundRect(ctx, sx, sy, sw, sh, 10); ctx.stroke();

  ctx.font = 'bold 11px Roboto';
  ctx.fillStyle = '#666666';
  ctx.fillText('STOCK STATUS', sx+14, sy+22);

  const goalText = order.type === 'Gems'
    ? `GOAL: ${order.totalQuantity} GEMS`
    : `GOAL: ${formatGold(order.totalQuantity).toUpperCase()}`;
  ctx.font = '10px Roboto';
  ctx.fillStyle = accent+'AA';
  ctx.fillText(goalText, sx+14, sy+38);

  const pct = order.totalQuantity > 0
    ? Math.round((order.remainingQuantity/order.totalQuantity)*100) : 0;
  const bigNum = order.type === 'Gems'
    ? `${order.remainingQuantity}`
    : formatGoldShort(order.remainingQuantity);

  ctx.save();
  ctx.shadowColor = glow; ctx.shadowBlur = 20;
  ctx.font = 'bold 44px Roboto';
  ctx.fillStyle = pct === 0 ? '#FF4444' : accent;
  ctx.textAlign = 'center';
  ctx.fillText(bigNum, sx+sw/2, sy+108);
  ctx.restore();

  ctx.font = '11px Roboto';
  ctx.fillStyle = '#555555';
  ctx.textAlign = 'center';
  ctx.fillText(order.type === 'Gems' ? 'GEMS AVAILABLE' : 'UNITS AVAILABLE', sx+sw/2, sy+126);

  ctx.fillStyle = accent+'33';
  ctx.fillRect(sx+14, sy+136, sw-28, 1);

  const stockLabel = pct === 0 ? 'OUT OF STOCK' : pct <= 25 ? 'LOW STOCK' : 'IN STOCK';
  const stockColor = pct === 0 ? '#FF4444' : pct <= 25 ? '#FFD700' : '#00FF88';

  ctx.fillStyle = stockColor+'22';
  roundRect(ctx, sx+14, sy+148, sw-28, 36, 18); ctx.fill();
  ctx.strokeStyle = stockColor; ctx.lineWidth = 1;
  roundRect(ctx, sx+14, sy+148, sw-28, 36, 18); ctx.stroke();

  ctx.fillStyle = stockColor;
  ctx.shadowColor = stockColor; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(sx+30, sy+166, 5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = 'bold 12px Roboto';
  ctx.fillStyle = stockColor;
  ctx.textAlign = 'left';
  ctx.fillText(`${stockLabel} (${pct}%)`, sx+42, sy+171);

  // ── Footer
  ctx.fillStyle = accent+'44';
  ctx.fillRect(28, H-36, W-56, 1);
  ctx.font = '11px Roboto';
  ctx.fillStyle = '#444444';
  ctx.textAlign = 'left';
  ctx.fillText(`#${order.orderCode}  •  LOST HUB  •  SECURED TRANSACTION`, 28, H-16);
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  ctx.textAlign = 'right';
  ctx.fillText(`Today at ${now}`, W-28, H-16);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

module.exports = { generateOrderImage };
