require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHECK_INTERVAL = 10000; // 10 detik

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
  console.log(`Bot ready as ${client.user.tag}`);
  setInterval(checkDonations, CHECK_INTERVAL);
});

async function checkDonations() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    for (const msg of messages.values()) {
      if (msg.embeds.length > 0 && msg.embeds[0].title === "Thomas Donate Log") {
        const desc = msg.embeds[0].description || "";
        const match = desc.match(/(.+?)\s+is\s+donated\s+(\d+)\s+(.+)/i);
        if (!match) continue;
        const growid = match[1].trim();
        const jumlah = parseInt(match[2]);
        const paymentType = match[3].trim();
        const discord_message_id = msg.id;

        // Cek log donasi di database
        const logRes = await fetch(`${SUPABASE_URL}/rest/v1/donation_logs?discord_message_id=eq.${discord_message_id}`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        });
        const logs = await logRes.json();

        if (logs.length > 0) {
          // Jika sudah true, skip
          if (logs[0].is_processed) continue;

          // Jika masih false, update balance dan set is_processed=true
          const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?growid=ilike.${encodeURIComponent(growid)}`, {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          });
          const user = await userRes.json();
          if (!user[0]) continue;

          let currentBalance = Number(user[0].balance) || 0;
          let newBalance = currentBalance + jumlah;

          await fetch(`${SUPABASE_URL}/rest/v1/users?growid=eq.${encodeURIComponent(user[0].growid)}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=representation"
            },
            body: JSON.stringify({ balance: newBalance }),
          });

          // Update log jadi is_processed=true
          await fetch(`${SUPABASE_URL}/rest/v1/donation_logs?id=eq.${logs[0].id}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=representation"
            },
            body: JSON.stringify({ is_processed: true }),
          });

          console.log(`Donasi ${jumlah} ${paymentType} dari ${growid} diproses dan log diupdate.`);
        } else {
          // Jika belum ada log, buat log baru dengan is_processed=true
          const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?growid=ilike.${encodeURIComponent(growid)}`, {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          });
          const user = await userRes.json();
          if (!user[0]) continue;

          let currentBalance = Number(user[0].balance) || 0;
          let newBalance = currentBalance + jumlah;

          await fetch(`${SUPABASE_URL}/rest/v1/users?growid=eq.${encodeURIComponent(user[0].growid)}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=representation"
            },
            body: JSON.stringify({ balance: newBalance }),
          });

          await fetch(`${SUPABASE_URL}/rest/v1/donation_logs`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              discord_message_id,
              growid: user[0].growid,
              jumlah,
              payment_type: paymentType,
              is_processed: true
            }),
          });

          console.log(`Donasi ${jumlah} ${paymentType} dari ${growid} diproses dan log dibuat.`);
        }
      }
    }
  } catch (err) {
    console.error("Error checking donations:", err.message);
  }
}

client.login(TOKEN);