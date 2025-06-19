const fetch = require('node-fetch');
const nodemailer = require('nodemailer');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_SENDER = process.env.EMAIL_SENDER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: "Method Not Allowed" }) };
  }

  let growid, jumlah;
  try {
    const body = JSON.parse(event.body || "{}");
    growid = body.growid;
    jumlah = parseInt(body.jumlah, 10) || 1;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Invalid JSON" }) };
  }
  if (!growid || jumlah < 1) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Invalid data" }) };
  }

  // Ambil email user dan saldo dari tabel users
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?growid=ilike.${encodeURIComponent(growid)}&select=gmail,balance`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const user = await userRes.json();
  if (!user[0] || !user[0].gmail) {
    return { statusCode: 404, body: JSON.stringify({ success: false, message: "User not found or email not set" }) };
  }
  const userEmail = user[0].gmail;
  const userBalance = user[0].balance || 0;

  // Ambil harga Gmail dari tabel settings
  const hargaRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.gmail_price&select=value`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const hargaData = await hargaRes.json();
  const hargaGmail = hargaData[0] ? parseInt(hargaData[0].value, 10) : 5;

  // Hitung total harga
  const totalHarga = jumlah * hargaGmail;
  if (userBalance < totalHarga) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Saldo tidak cukup" }) };
  }

  // Ambil sejumlah akun Gmail available
  const stockRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_items?status=eq.available&select=id,email,password&limit=${jumlah}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const gmails = await stockRes.json();
  if (!gmails || gmails.length < jumlah) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Stock not available" }) };
  }

  // Kurangi saldo user
  await fetch(`${SUPABASE_URL}/rest/v1/users?growid=eq.${encodeURIComponent(growid)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ balance: userBalance - totalHarga })
  });

  // Update status jadi sold
  for (const item of gmails) {
    await fetch(`${SUPABASE_URL}/rest/v1/stock_items?id=eq.${item.id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: "sold" }),
    });
  }

  // Tambahkan ke tabel daily_sales
  await fetch(`${SUPABASE_URL}/rest/v1/daily_sales`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      growid: growid,
      jumlah: jumlah,
      harga: hargaGmail,
      total: totalHarga,
      tanggal: new Date().toISOString()
    })
  });

  // Kirim file .txt ke email user
  const txtContent = gmails.map(item => `${item.email}:${item.password}`).join('\n');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_SENDER,
      pass: EMAIL_PASSWORD
    }
  });

  try {
    await transporter.sendMail({
      from: EMAIL_SENDER,
      to: userEmail,
      subject: 'Akun Gmail yang Anda Beli',
      text: 'Berikut akun Gmail yang Anda beli terlampir.',
      attachments: [
        {
          filename: 'gmail.txt',
          content: txtContent
        }
      ]
    });
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: "Gagal kirim email: " + err.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, sent_to: userEmail, count: gmails.length })
  };
};