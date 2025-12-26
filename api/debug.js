module.exports = async (req, res) => {
  const debug = {
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicKeyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...' : 'NOT SET',
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    supabaseUrl: process.env.SUPABASE_URL || 'NOT SET',
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
    supabaseKeyPrefix: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.substring(0, 20) + '...' : 'NOT SET',
    nodeVersion: process.version,
    env: process.env.NODE_ENV
  };

  // Test imports
  const imports = {};

  try {
    require('@anthropic-ai/sdk');
    imports.anthropic = 'OK';
  } catch (e) {
    imports.anthropic = `FAILED: ${e.message}`;
  }

  try {
    require('@supabase/supabase-js');
    imports.supabase = 'OK';
  } catch (e) {
    imports.supabase = `FAILED: ${e.message}`;
  }

  return res.status(200).json({
    ...debug,
    imports,
    timestamp: new Date().toISOString()
  });
};
