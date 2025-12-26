const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  const { schema } = req.query;

  try {
    if (schema === 'true') {
      // Return column info
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .limit(1);

      if (error) throw error;

      const columns = data && data[0] ? Object.keys(data[0]) : [];
      return res.status(200).json({
        table: 'documents',
        columns,
        hasStoragePath: columns.includes('storage_path'),
        sqlToAdd: 'ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;'
      });
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, filename, category, file_size, created_at, summary, tags')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Format file sizes
    const formattedDocs = documents.map(doc => ({
      ...doc,
      file_size_mb: doc.file_size ? (doc.file_size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'
    }));

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents: formattedDocs
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
