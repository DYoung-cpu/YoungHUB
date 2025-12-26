import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const debug = {
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 15) + '...',
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
    supabaseKeyPrefix: process.env.SUPABASE_SERVICE_KEY?.substring(0, 20) + '...',
    nodeVersion: process.version,
  };

  // Try to import and test Anthropic
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Simple API test
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say "API working" and nothing else.' }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    return res.status(200).json({
      ...debug,
      anthropicTest: 'SUCCESS',
      response: textContent?.type === 'text' ? textContent.text : 'no text',
    });
  } catch (error: any) {
    return res.status(200).json({
      ...debug,
      anthropicTest: 'FAILED',
      error: error.message,
      errorType: error.constructor.name,
    });
  }
}
