const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  // Only allow POST with confirmation
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST to perform cleanup' });
  }

  const { action, confirm } = req.body;

  try {
    if (action === 'find-duplicates') {
      // Find duplicates by filename
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, filename, created_at, file_size')
        .order('filename')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by filename and find duplicates
      const byFilename = {};
      for (const doc of documents) {
        if (!byFilename[doc.filename]) {
          byFilename[doc.filename] = [];
        }
        byFilename[doc.filename].push(doc);
      }

      const duplicates = {};
      let totalDuplicates = 0;
      for (const [filename, docs] of Object.entries(byFilename)) {
        if (docs.length > 1) {
          duplicates[filename] = docs;
          totalDuplicates += docs.length - 1; // Count extras
        }
      }

      return res.status(200).json({
        success: true,
        duplicatesFound: Object.keys(duplicates).length,
        totalExtraDocuments: totalDuplicates,
        duplicates
      });
    }

    if (action === 'remove-duplicates' && confirm === true) {
      // Find and remove duplicates (keep the oldest one)
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, filename, created_at')
        .order('filename')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const byFilename = {};
      for (const doc of documents) {
        if (!byFilename[doc.filename]) {
          byFilename[doc.filename] = [];
        }
        byFilename[doc.filename].push(doc);
      }

      const toDelete = [];
      for (const docs of Object.values(byFilename)) {
        if (docs.length > 1) {
          // Keep the first (oldest), delete the rest
          for (let i = 1; i < docs.length; i++) {
            toDelete.push(docs[i].id);
          }
        }
      }

      if (toDelete.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No duplicates to remove',
          deleted: 0
        });
      }

      // Delete duplicates
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .in('id', toDelete);

      if (deleteError) throw deleteError;

      return res.status(200).json({
        success: true,
        deleted: toDelete.length,
        deletedIds: toDelete
      });
    }

    return res.status(400).json({
      error: 'Invalid action',
      validActions: ['find-duplicates', 'remove-duplicates']
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
