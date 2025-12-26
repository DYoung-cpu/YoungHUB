const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  const { action } = req.query;

  try {
    if (action === 'add-storage-path') {
      // Add storage_path column to documents table
      const { error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;'
      });

      if (error) {
        // Try direct SQL if RPC fails
        return res.status(500).json({
          error: 'Cannot add column via API. Run this SQL in Supabase dashboard:',
          sql: 'ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;'
        });
      }

      return res.status(200).json({ success: true, message: 'storage_path column added' });
    }

    // Get column info for documents table
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .limit(1);

    if (error) throw error;

    const columns = data && data[0] ? Object.keys(data[0]) : [];

    return res.status(200).json({
      table: 'documents',
      columns,
      sampleRecord: data?.[0]
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
