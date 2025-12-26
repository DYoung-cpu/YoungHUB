const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Folder mapping based on category
const categoryToFolder = {
  'medical': 'Coty-Coleman',
  'legal': 'Coty-Coleman',
  'bank': 'Investments',
  'investment': 'Investments',
  'mortgage': '1085-Acanto',
  'insurance': '1085-Acanto',
  'housing': 'Anita-Young',
  'utility': '1085-Acanto',
  'tax': 'The-Young-Group'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    // GET - show what would be synced
    try {
      // Get all documents without storage_path
      const { data: docs, error } = await supabase
        .from('documents')
        .select('id, filename, category, storage_path, file_size')
        .is('storage_path', null);

      if (error) throw error;

      // Get all files in storage
      const storageFiles = [];
      const folders = ['1085-Acanto', '1808-Manning', '2224-Birchglen', 'Anita-Young',
                       'Coty-Coleman', 'David-Young', 'Investments', 'Jacob-Young',
                       'The-Young-Group', 'temp-extract'];

      for (const folder of folders) {
        const { data: files } = await supabase.storage
          .from('family-vault')
          .list(`documents/${folder}`, { limit: 100 });

        if (files) {
          for (const file of files) {
            storageFiles.push({
              name: file.name,
              path: `documents/${folder}/${file.name}`,
              size: file.metadata?.size
            });
          }
        }
      }

      // Try to match documents to storage files
      const matches = [];
      for (const doc of docs) {
        const match = storageFiles.find(sf => sf.name === doc.filename);
        if (match) {
          matches.push({
            docId: doc.id,
            filename: doc.filename,
            storagePath: match.path,
            size: match.size
          });
        }
      }

      return res.status(200).json({
        docsWithoutPath: docs.length,
        filesInStorage: storageFiles.length,
        matches: matches.length,
        matchDetails: matches
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - actually sync
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Add confirm: true to body' });
  }

  try {
    // Get all documents
    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, filename, category, storage_path');

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

    return res.status(200).json({
      success: true,
      updated,
      total: docs.length
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
