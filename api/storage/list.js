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
      // List root level
      const { data: rootFiles, error: rootError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 100 });

      // If there's a documents folder, list its contents
      let docFiles = [];
      const { data: subFiles, error: subError } = await supabase.storage
        .from(bucket.name)
        .list('documents', { limit: 100 });
      if (!subError && subFiles) {
        docFiles = subFiles;
      }

      const files = [...(rootFiles || []), ...docFiles];

      result.buckets.push({
        name: bucket.name,
        public: bucket.public,
        fileCount: files ? files.length : 0,
        files: files ? files.slice(0, 20).map(f => ({
          name: f.name,
          size: f.metadata?.size || 'unknown'
        })) : [],
        error: rootError?.message || subError?.message
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
