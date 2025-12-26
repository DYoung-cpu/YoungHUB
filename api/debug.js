// Simplest possible handler - no imports
module.exports = (req, res) => {
  res.status(200).json({
    env: {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      nodeVersion: process.version
    },
    timestamp: new Date().toISOString()
  });
};
