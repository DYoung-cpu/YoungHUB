const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  const { id, filename } = req.query;

  try {
    let query = supabase.from('documents').select('*');

    if (id) {
      query = query.eq('id', id);
    } else if (filename) {
      query = query.ilike('filename', `%${filename}%`);
    } else {
      return res.status(400).json({ error: 'Provide id or filename query parameter' });
    }

    const { data: documents, error } = await query;

    if (error) throw error;

    // Get signed URLs for storage files
    const docsWithUrls = await Promise.all(documents.map(async (doc) => {
      let signedUrl = null;
      if (doc.storage_path) {
        const { data, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry
        if (!urlError) {
          signedUrl = data.signedUrl;
        }
      }
      return {
        ...doc,
        file_size_mb: doc.file_size ? (doc.file_size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown',
        download_url: signedUrl
      };
    }));

    return res.status(200).json({
      success: true,
      documents: docsWithUrls
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
