const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // gunakan service role agar bisa insert
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { growid, world_name, bot_name, owner_name } = JSON.parse(event.body || '{}');
    if (!growid || !world_name || !bot_name || !owner_name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Data tidak lengkap' }) };
    }

    const { error } = await supabase
      .from('user_deposits')
      .insert([{ growid, world_name, bot_name, owner_name }]);
    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};