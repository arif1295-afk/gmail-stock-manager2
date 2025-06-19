const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  let body = {};
  if (event.httpMethod === 'POST' || event.httpMethod === 'DELETE') {
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      body = {};
    }
  }

  try {
    switch (event.httpMethod) {
      case 'GET': {
        const { data: stocks, error: getError } = await supabase
          .from('stock_items')
          .select('*')
          .order('added_date', { ascending: false });

        if (getError) throw getError;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, data: stocks })
        };
      }

      case 'POST': {
        const { action, email, password, id, quantity } = body;

        if (action === 'add') {
          const { data: newStock, error: addError } = await supabase
            .from('stock_items')
            .insert([{ email, password, status: 'available' }])
            .select();

          if (addError) throw addError;

          await supabase
            .from('activities')
            .insert([{
              user_name: 'Admin',
              action: `Added new Gmail: ${email}`
            }]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: newStock[0] })
          };

        } else if (action === 'sell') {
          const { data: soldItem, error: sellError } = await supabase
            .from('stock_items')
            .update({
              status: 'sold',
              sold_date: new Date().toISOString()
            })
            .eq('id', id)
            .select();

          if (sellError) throw sellError;

          await supabase
            .from('daily_sales')
            .insert([{
              item_id: id,
              email: soldItem[0].email,
              price: 5000
            }]);

          await supabase
            .from('activities')
            .insert([{
              user_name: 'Sale',
              action: `Sold Gmail: ${soldItem[0].email}`
            }]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: soldItem[0] })
          };

        } else if (action === 'bulk') {
          let generated = [];
          for (let i = 0; i < quantity; i++) {
            const genEmail = generateEmail();
            const genPassword = generatePassword();
            generated.push({ email: genEmail, password: genPassword, status: 'available' });
          }
          const { data: bulkData, error: bulkError } = await supabase
            .from('stock_items')
            .insert(generated)
            .select();

          if (bulkError) throw bulkError;

          await supabase
            .from('activities')
            .insert([{
              user_name: 'Admin',
              action: `Bulk generated ${quantity} Gmail`
            }]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: bulkData })
          };
        }

        break;
      }

      case 'DELETE': {
        const { id: deleteId } = body;

        const { error: deleteError } = await supabase
          .from('stock_items')
          .delete()
          .eq('id', deleteId);

        if (deleteError) throw deleteError;

        await supabase
          .from('activities')
          .insert([{
            user_name: 'Admin',
            action: 'Removed Gmail from stock'
          }]);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function generateEmail() {
  const domains = ['gmail.com'];
  const prefixes = ['user', 'test', 'demo', 'account', 'email'];
  const numbers = Math.floor(Math.random() * 9999);
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}${numbers}@${domains[0]}`;
}

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}