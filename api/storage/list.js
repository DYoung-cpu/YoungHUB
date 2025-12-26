const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  const { folder } = req.query;

  try {
    const bucketName = 'family-vault';

    if (folder) {
      // List specific folder
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list(folder, { limit: 100 });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        folder,
        fileCount: files?.length || 0,
        files: files?.map(f => ({
          name: f.name,
          path: `${folder}/${f.name}`,
          size: f.metadata?.size,
          lastModified: f.metadata?.lastModified
        })) || []
      });
    }

    // List root folders
    const { data: rootItems, error } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 100 });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      bucket: bucketName,
      folders: rootItems?.map(f => f.name) || []
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
