#!/usr/bin/env node
/**
 * Upload Documents to Supabase Storage
 *
 * This script uploads all documents from document-processing/ folder
 * to Supabase Storage and creates database records.
 *
 * Usage: node scripts/upload-documents.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase credentials (same as .env)
const SUPABASE_URL = 'https://fnfwaqugiwspnyjtribf.supabase.co';
const SUPABASE_KEY = 'sb_secret_bXlY_v6HH7FNg43FAaP-QA_k8AnMZ0U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Document metadata mapping based on CLAUDE.md
const DOCUMENT_METADATA = {
  // 1085 Acanto
  'LADWP_Bill_2025-10-24.pdf': {
    category: 'utility',
    property_address: '1085 Acanto Pl, Los Angeles, CA 90049',
    provider: 'LADWP',
    tags: ['electric', 'water', 'sanitation', '2025'],
    summary: 'LADWP Bill Oct 2025 - $1,328.27 total'
  },
  'Mechanics_Bank_HELOC_Statement_2025-12-10.pdf': {
    category: 'mortgage',
    property_address: '1085 Acanto Pl, Los Angeles, CA 90049',
    provider: 'Mechanics Bank',
    tags: ['heloc', 'credit-line', '2025'],
    summary: 'HELOC Statement - $272K limit, $0 balance'
  },

  // 1808 Manning
  'CrossCountry_Mortgage_Transfer_Notice_2025-12-09.pdf': {
    category: 'mortgage',
    property_address: '1808 Manning Ave #202, Los Angeles, CA 90025',
    provider: 'CrossCountry Mortgage',
    tags: ['transfer', 'servicing', '2025'],
    summary: 'Mortgage transfer from Freedom Mortgage to CrossCountry'
  },
  'CrossCountry_Welcome_Letter_2025-12-01.pdf': {
    category: 'mortgage',
    property_address: '1808 Manning Ave #202, Los Angeles, CA 90025',
    provider: 'CrossCountry Mortgage',
    tags: ['welcome', '2025'],
    summary: 'Welcome letter - Monthly payment $2,353.71'
  },
  'LAHD_Annual_Bill_FINAL_NOTICE_2025-12-12.pdf': {
    category: 'housing',
    property_address: '1808 Manning Ave #202, Los Angeles, CA 90025',
    provider: 'LA Housing Dept',
    tags: ['scep', 'jco', 'annual-fee', 'urgent', '2025'],
    summary: 'LAHD SCEP Fee $77.83 - FINAL NOTICE',
    due_date: '2025-12-31'
  },

  // 2224 Birchglen
  'RocketMortgage_LenderPlaced_Insurance_Notice_2025-12-15.pdf': {
    category: 'insurance',
    property_address: '2224 Birchglen St, Unit 111, Simi Valley, CA 93063',
    provider: 'Rocket Mortgage',
    tags: ['ho6', 'lender-placed', 'urgent', '2025'],
    summary: 'HO6 Insurance EXPIRED - Lender-placed insurance warning',
    due_date: '2025-01-15'
  },

  // Coty Coleman
  'SSA_Benefits_Letter_2025-08-04.pdf': {
    category: 'medical',
    provider: 'Social Security Administration',
    tags: ['ssa', 'benefits', 'medicare', 'coty-coleman'],
    summary: 'SSA Benefits $1,188/month, Medicare info'
  },

  // Investments
  'JPMorgan_JTWROS_Statement_2025-11.pdf': {
    category: 'bank',
    provider: 'J.P. Morgan',
    tags: ['investment', 'jtwros', 'david-marc', '2025'],
    summary: 'Investment Statement - $410,892.88 (David & Marc Young)'
  },

  // Anita Young Documents
  'Steve_Watson_Application_2010.pdf': {
    category: 'housing',
    property_address: '1133 S Hayworth Ave, Los Angeles, CA 90035',
    tags: ['rental-application', 'steve-watson', 'anita-young', '2010'],
    summary: 'Tenant application with credit history and deposit checks'
  },
  'Steve_Watson_Lease_2010.pdf': {
    category: 'housing',
    property_address: '1133 S Hayworth Ave, Los Angeles, CA 90035',
    tags: ['lease', 'rental-agreement', 'steve-watson', '2010'],
    summary: 'Original lease $2,600/mo with signatures and checklist'
  },
  'Steve_Watson_Lease_Renewal_2015.pdf': {
    category: 'housing',
    property_address: '1133 S Hayworth Ave, Los Angeles, CA 90035',
    tags: ['lease', 'renewal', 'steve-watson', '2015'],
    summary: 'Lease renewal 2015'
  },
  'Rent_Increase_Notice_2015-09_to_2843.pdf': {
    category: 'housing',
    property_address: '1133 S Hayworth Ave, Los Angeles, CA 90035',
    tags: ['rent-increase', 'steve-watson', '2015'],
    summary: 'Rent increase to $2,843/mo effective Sept 2015'
  },
  'Rent_Increase_Notice_2019-09_to_3232.pdf': {
    category: 'housing',
    property_address: '1133 S Hayworth Ave, Los Angeles, CA 90035',
    tags: ['rent-increase', 'steve-watson', '2019'],
    summary: 'Rent increase to $3,232/mo effective Sept 2019'
  },
  'Rent_Increase_Notice_2020-09_to_3362.pdf': {
    category: 'housing',
    property_address: '1133 S Hayworth Ave, Los Angeles, CA 90035',
    tags: ['rent-increase', 'steve-watson', '2020'],
    summary: 'Rent increase to $3,362/mo effective Sept 2020'
  },
  'Chase_CD_POD_Marc_Young_2010-08.pdf': {
    category: 'bank',
    provider: 'Chase',
    tags: ['cd', 'certificate-deposit', 'pod', 'marc-young', 'anita-young', '2010'],
    summary: 'CD Receipt $3,600 POD Marc D Young'
  },
  'David_Young_CA_RE_Broker_License.pdf': {
    category: 'legal',
    provider: 'CA Dept of Real Estate',
    tags: ['license', 'real-estate', 'broker', 'david-young'],
    summary: 'California Real Estate Broker License - David Jaime Young'
  },

  // New documents from scan processing (Dec 25, 2024)
  'Power_of_Attorney_Coty_Coleman.pdf': {
    category: 'legal',
    provider: 'General Durable POA',
    tags: ['power-of-attorney', 'poa', 'coty-coleman', 'legal'],
    summary: 'General Durable Power of Attorney for Coty Coleman'
  },
  'Mercury_Insurance_Claim_Letter_2025-09-04.pdf': {
    category: 'insurance',
    property_address: '1085 Acanto Pl, Los Angeles, CA 90049',
    provider: 'Mercury Insurance',
    tags: ['claim', 'insurance', 'lisa-young', '2025'],
    summary: 'Insurance Claim #CAPA-02571084 - Lisa Young, Date of Loss June 6, 2025'
  },
  'Mercury_Insurance_Declarations_Change_2025-09.pdf': {
    category: 'insurance',
    property_address: '1085 Acanto Pl, Los Angeles, CA 90049',
    provider: 'Mercury Insurance',
    tags: ['declarations', 'policy-change', 'ho3', '2025'],
    summary: 'Homeowners Declarations Page - Policy change effective 09/14/2025 (Change Mortgage)'
  },
  'KW_Specialty_Billing_Notice_2025-09.pdf': {
    category: 'insurance',
    property_address: '1085 Acanto Pl, Los Angeles, CA 90049',
    provider: 'KW Specialty Insurance',
    tags: ['billing', 'premium', 'ho3', '2025'],
    summary: 'HO3 Policy Billing Notice - $5,374.65 due 09/12/2025',
    due_date: '2025-09-12'
  },
  'KW_Specialty_Policy_Declarations_2024-2025.pdf': {
    category: 'insurance',
    property_address: '1085 Acanto Pl, Los Angeles, CA 90049',
    provider: 'KW Specialty Insurance',
    tags: ['policy', 'declarations', 'ho3', '2024', '2025'],
    summary: 'HO3 Policy #1000017887HO2 - $4,053.94 annual premium'
  },
  'CA_501_CORP_Declaration_2025.pdf': {
    category: 'tax',
    provider: 'CA Franchise Tax Board',
    tags: ['501-corp', 'corporate', 'declaration', 'the-young-group', '2025'],
    summary: 'CA 501-CORP Declaration of Directors and Officers - The Young Group Inc'
  },
  'LA_Housing_Rent_Registry_Form_2025.pdf': {
    category: 'housing',
    property_address: '1808 Manning Ave #202, Los Angeles, CA 90025',
    provider: 'LA Housing Dept',
    tags: ['rent-registry', 'rso', 'landlord', '2025'],
    summary: '2025 Annual Rent Registry Form for 1808 Manning'
  },
  'Mercury_Insurance_Renewal_2025-2026.pdf': {
    category: 'insurance',
    property_address: '1808 Manning Ave #202, Los Angeles, CA 90025',
    provider: 'Mercury Insurance',
    tags: ['renewal', 'homeowner', 'ho3', '2025', '2026'],
    summary: 'Homeowner Insurance Renewal - Policy #CAHP0001094546, $1,085.12, Sept 2025-2026'
  },
  'JPMorgan_JTWROS_Statement_2025-08.pdf': {
    category: 'bank',
    provider: 'J.P. Morgan',
    tags: ['investment', 'jtwros', 'david-marc', '2025', 'august'],
    summary: 'Investment Statement Aug 2025 - David & Marc Young JTWROS Account #767-44030'
  }
};

// Get category from folder name
function getCategoryFromFolder(folderName) {
  const mapping = {
    '1085-Acanto': 'mortgage',
    '1808-Manning': 'mortgage',
    '2224-Birchglen': 'insurance',
    'Anita-Young': 'housing',
    'Coty-Coleman': 'medical',
    'Investments': 'bank',
    'The-Young-Group': 'tax',
    'David-Young': 'legal',
    'Jacob-Young': 'bank'
  };
  return mapping[folderName] || 'other';
}

// Get property address from folder
function getPropertyFromFolder(folderName) {
  const mapping = {
    '1085-Acanto': '1085 Acanto Pl, Los Angeles, CA 90049',
    '1808-Manning': '1808 Manning Ave #202, Los Angeles, CA 90025',
    '2224-Birchglen': '2224 Birchglen St, Unit 111, Simi Valley, CA 93063',
    'Anita-Young': '1135 S Hayworth Ave, Los Angeles, CA 90035'
  };
  return mapping[folderName] || null;
}

async function uploadDocument(filePath, folderName, fileName) {
  console.log(`\nUploading: ${fileName}`);

  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;
  const fileType = fileName.endsWith('.pdf') ? 'pdf' : 'image';

  // Storage path
  const storagePath = `documents/${folderName}/${fileName}`;

  // Get metadata
  const metadata = DOCUMENT_METADATA[fileName] || {};
  const category = metadata.category || getCategoryFromFolder(folderName);
  const property = metadata.property_address || getPropertyFromFolder(folderName);

  try {
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('family-vault')
      .upload(storagePath, fileBuffer, {
        contentType: fileType === 'pdf' ? 'application/pdf' : 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`  Storage error: ${uploadError.message}`);
      return false;
    }

    console.log(`  Uploaded to storage: ${storagePath}`);

    // Create database record
    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert({
        filename: fileName,
        original_filename: fileName,
        file_path: storagePath,
        file_type: fileType,
        file_size: fileSize,
        category: category,
        property_address: property,
        provider: metadata.provider || null,
        tags: metadata.tags || null,
        summary: metadata.summary || null,
        due_date: metadata.due_date || null
      })
      .select()
      .single();

    if (dbError) {
      console.error(`  Database error: ${dbError.message}`);
      return false;
    }

    console.log(`  Created DB record: ${dbData.id}`);
    return true;

  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('Family Vault - Document Upload Script');
  console.log('========================================\n');

  const baseDir = path.join(__dirname, '..', 'document-processing');

  // Check if directory exists
  if (!fs.existsSync(baseDir)) {
    console.error(`Directory not found: ${baseDir}`);
    process.exit(1);
  }

  // Get all folders
  const folders = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  console.log(`Found folders: ${folders.join(', ')}\n`);

  let totalFiles = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const folder of folders) {
    const folderPath = path.join(baseDir, folder);

    // Get PDF files (skip files starting with _)
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.pdf') && !f.startsWith('_'));

    if (files.length === 0) continue;

    console.log(`\n--- ${folder} (${files.length} files) ---`);

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(folderPath, file);
      const success = await uploadDocument(filePath, folder, file);

      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
  }

  console.log('\n========================================');
  console.log('Upload Complete');
  console.log('========================================');
  console.log(`Total files: ${totalFiles}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  if (errorCount > 0) {
    console.log('\nNote: If you see "Bucket not found" errors, create the bucket first:');
    console.log('1. Go to https://supabase.com/dashboard/project/ureyfsxuitbgqbdhmlix/storage');
    console.log('2. Click "New bucket"');
    console.log('3. Name it "family-vault"');
    console.log('4. Check "Public bucket"');
    console.log('5. Run this script again');
  }
}

main().catch(console.error);
