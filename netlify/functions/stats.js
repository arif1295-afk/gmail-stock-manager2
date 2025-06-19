const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      // Get total stock
      const { count: totalStock } = await supabase
        .from('stock_items')
        .select('*', { count: 'exact', head: true });

      // Get available stock
      const { count: availableStock } = await supabase
        .from('stock_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available');

      // Get today's sales
      const today = new Date().toISOString().split('T')[0];
      const { data: todaySales, error: salesError } = await supabase
        .from('daily_sales')
        .select('*')
        .eq('sale_date', today);

      if (salesError) throw salesError;

      const soldCount = todaySales.length;
      const revenue = todaySales.reduce((sum, sale) => sum + sale.price, 0);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            totalStock: totalStock || 0,
            availableStock: availableStock || 0,
            soldCount,
            revenue
          }
        })
      };
    } else {
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