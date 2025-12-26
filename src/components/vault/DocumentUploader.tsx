import { useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

interface DocumentUploaderProps {
  onUploadComplete?: (document: UploadedDocument) => void
}

interface UploadedDocument {
  id: string
  filename: string
  file_path: string
  category: string
  file_type: string
  file_size: number
}

const CATEGORIES = [
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'mortgage', label: 'Mortgage', icon: '🏠' },
  { value: 'bank', label: 'Bank Statement', icon: '🏦' },
  { value: 'utility', label: 'Utility', icon: '💡' },
  { value: 'medical', label: 'Medical', icon: '🏥' },
  { value: 'tax', label: 'Tax', icon: '📋' },
  { value: 'housing', label: 'Housing/Property', icon: '🏢' },
  { value: 'legal', label: 'Legal', icon: '⚖️' },
  { value: 'other', label: 'Other', icon: '📁' },
]

const PROPERTIES = [
  { value: '1085 Acanto Pl, Los Angeles, CA 90049', label: '1085 Acanto (Home)' },
  { value: '1808 Manning Ave #202, Los Angeles, CA 90025', label: '1808 Manning (Rental)' },
  { value: '2224 Birchglen St, Unit 111, Simi Valley, CA 93063', label: '2224 Birchglen (Simi Valley)' },
]

export default function DocumentUploader({ onUploadComplete }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [category, setCategory] = useState('')
  const [property, setProperty] = useState('')
  const [tags, setTags] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    setSelectedFiles(prev => [...prev, ...files])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const getFileType = (file: File): string => {
    if (file.type === 'application/pdf') return 'pdf'
    if (file.type.startsWith('image/')) return 'image'
    return 'other'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Convert file to base64 for localStorage storage
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  // Save to localStorage as fallback
  const saveToLocalStorage = async (file: File, filePath: string): Promise<boolean> => {
    try {
      const base64 = await fileToBase64(file)
      const localDocs = JSON.parse(localStorage.getItem('familyVaultDocs') || '[]')
      localDocs.push({
        filePath,
        base64,
        uploadedAt: new Date().toISOString()
      })
      localStorage.setItem('familyVaultDocs', JSON.stringify(localDocs))
      return true
    } catch (e) {
      console.error('localStorage save failed:', e)
      return false
    }
  }

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file')
      return
    }
    if (!category) {
      setError('Please select a category')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    let useLocalFallback = false

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const fileType = getFileType(file)
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `documents/${category}/${timestamp}_${sanitizedName}`

        let uploadSuccess = false

        // Try Supabase Storage first
        if (!useLocalFallback) {
          try {
            const { error: uploadError } = await supabase.storage
              .from('family-vault')
              .upload(filePath, file)

            if (uploadError) {
              console.error('Supabase upload error:', uploadError)
              // Check for common issues
              if (uploadError.message.includes('not found') ||
                  uploadError.message.includes('Bucket not found')) {
                console.warn('Storage bucket not found, using local fallback')
                useLocalFallback = true
              } else if (uploadError.message.includes('Failed to fetch') ||
                         uploadError.message.includes('NetworkError')) {
                console.warn('Network error, using local fallback')
                useLocalFallback = true
              } else {
                throw uploadError
              }
            } else {
              uploadSuccess = true
            }
          } catch (fetchErr) {
            console.error('Fetch error:', fetchErr)
            useLocalFallback = true
          }
        }

        // Fallback to localStorage if Supabase fails
        if (useLocalFallback || !uploadSuccess) {
          const localSaved = await saveToLocalStorage(file, filePath)
          if (localSaved) {
            uploadSuccess = true
            console.log('Saved to localStorage:', filePath)
          }
        }

        if (!uploadSuccess) {
          throw new Error('Failed to save file')
        }

        // Save metadata to documents table
        const tagArray = tags.split(',').map(t => t.trim()).filter(t => t)

        const docRecord = {
          id: crypto.randomUUID(),
          filename: sanitizedName,
          original_filename: file.name,
          file_path: filePath,
          file_type: fileType,
          file_size: file.size,
          category: category,
          property_address: property || null,
          tags: tagArray.length > 0 ? tagArray : null,
          storage_type: useLocalFallback ? 'local' : 'supabase'
        }

        // Try saving to Supabase DB
        const { data: docData, error: dbError } = await supabase
          .from('documents')
          .insert({
            filename: sanitizedName,
            original_filename: file.name,
            file_path: filePath,
            file_type: fileType,
            file_size: file.size,
            category: category,
            property_address: property || null,
            tags: tagArray.length > 0 ? tagArray : null,
          })
          .select()
          .single()

        if (dbError) {
          console.error('Database error:', dbError)
          // Save to local index if DB fails
          const localIndex = JSON.parse(localStorage.getItem('familyVaultIndex') || '[]')
          localIndex.push(docRecord)
          localStorage.setItem('familyVaultIndex', JSON.stringify(localIndex))
        }

        setUploadProgress(((i + 1) / selectedFiles.length) * 100)

        if (onUploadComplete) {
          onUploadComplete(docData || docRecord as UploadedDocument)
        }
      }

      // Clear form after successful upload
      setSelectedFiles([])
      setCategory('')
      setProperty('')
      setTags('')
      setUploadProgress(100)

      if (useLocalFallback) {
        setError('Saved locally (Supabase storage not configured). Create bucket "family-vault" in Supabase Dashboard > Storage.')
      }

    } catch (err) {
      console.error('Upload error:', err)
      const errorMsg = err instanceof Error ? err.message : 'Upload failed'
      if (errorMsg.includes('Failed to fetch')) {
        setError('Cannot connect to Supabase Storage. Go to Supabase Dashboard > Storage > Create bucket named "family-vault" (public).')
      } else {
        setError(errorMsg)
      }
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="document-uploader">
      <h3>Upload Documents</h3>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="drop-zone-content">
          <span className="drop-icon">📄</span>
          <p>Drag & drop files here</p>
          <p className="drop-hint">or click to browse</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="selected-files">
          <h4>Selected Files ({selectedFiles.length})</h4>
          {selectedFiles.map((file, index) => (
            <div key={index} className="file-item">
              <span className="file-icon">
                {getFileType(file) === 'pdf' ? '📕' : '🖼️'}
              </span>
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatFileSize(file.size)}</span>
              <button
                className="remove-file"
                onClick={() => removeFile(index)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Category Selection */}
      <div className="form-group">
        <label>Category *</label>
        <div className="category-grid">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`category-btn ${category === cat.value ? 'selected' : ''}`}
              onClick={() => setCategory(cat.value)}
              type="button"
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Property Selection */}
      <div className="form-group">
        <label>Property (optional)</label>
        <select
          value={property}
          onChange={(e) => setProperty(e.target.value)}
          className="property-select"
        >
          <option value="">-- Select Property --</option>
          {PROPERTIES.map(prop => (
            <option key={prop.value} value={prop.value}>
              {prop.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div className="form-group">
        <label>Tags (comma-separated)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g., 2025, renewal, annual"
          className="tags-input"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}

      {/* Progress Bar */}
      {isUploading && (
        <div className="upload-progress">
          <div
            className="progress-bar"
            style={{ width: `${uploadProgress}%` }}
          />
          <span>{Math.round(uploadProgress)}%</span>
        </div>
      )}

      {/* Upload Button */}
      <button
        className="upload-btn"
        onClick={uploadFiles}
        disabled={isUploading || selectedFiles.length === 0}
      >
        {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
