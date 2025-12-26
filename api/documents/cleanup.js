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

    if (action === 'sync-storage-paths') {
      // Sync storage paths for documents
      const { data: docs, error } = await supabase
        .from('documents')
        .select('id, filename, storage_path');

      if (error) throw error;

      // Get all files in storage
      const storageFiles = new Map();
      const folders = ['1085-Acanto', '1808-Manning', '2224-Birchglen', 'Anita-Young',
                       'Coty-Coleman', 'David-Young', 'Investments', 'Jacob-Young',
                       'The-Young-Group', 'temp-extract'];

      for (const folder of folders) {
        const { data: files } = await supabase.storage
          .from('family-vault')
          .list(`documents/${folder}`, { limit: 100 });

        if (files) {
          for (const file of files) {
            storageFiles.set(file.name, `documents/${folder}/${file.name}`);
          }
        }
      }

      if (!confirm) {
        // Preview mode
        const matches = [];
        for (const doc of docs) {
          if (!doc.storage_path) {
            const storagePath = storageFiles.get(doc.filename);
            if (storagePath) {
              matches.push({ id: doc.id, filename: doc.filename, path: storagePath });
            }
          }
        }
        return res.status(200).json({
          docsWithoutPath: docs.filter(d => !d.storage_path).length,
          filesInStorage: storageFiles.size,
          matchesFound: matches.length,
          matches
        });
      }

      // Update documents with matching storage paths
      let updated = 0;
      for (const doc of docs) {
        if (!doc.storage_path) {
          const storagePath = storageFiles.get(doc.filename);
          if (storagePath) {
            const { error: updateError } = await supabase
              .from('documents')
              .update({ storage_path: storagePath })
              .eq('id', doc.id);
            if (!updateError) updated++;
          }
        }
      }

      return res.status(200).json({ success: true, updated, total: docs.length });
    }

    return res.status(400).json({
      error: 'Invalid action',
      validActions: ['find-duplicates', 'remove-duplicates', 'sync-storage-paths']
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
