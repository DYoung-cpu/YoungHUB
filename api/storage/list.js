const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  try {
    // List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      return res.status(500).json({ error: 'Failed to list buckets', details: bucketsError.message });
    }

    const result = {
      buckets: []
    };

    // For each bucket, list files
    for (const bucket of buckets) {
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 100 });

      result.buckets.push({
        name: bucket.name,
        public: bucket.public,
        fileCount: files ? files.length : 0,
        files: files ? files.slice(0, 20).map(f => ({
          name: f.name,
          size: f.metadata?.size || 'unknown'
        })) : [],
        error: filesError?.message
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
