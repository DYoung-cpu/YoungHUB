import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentViewerProps {
  fileUrl: string
  fileType: 'pdf' | 'image' | string
  filename: string
  onClose: () => void
  metadata?: {
    category?: string
    property_address?: string
    tags?: string[]
    due_date?: string
    summary?: string
  }
}

export default function DocumentViewer({
  fileUrl,
  fileType,
  filename,
  onClose,
  metadata
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
  }

  const onDocumentLoadError = (error: Error) => {
    setError('Failed to load PDF: ' + error.message)
    setIsLoading(false)
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3))
  }

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const downloadFile = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="document-viewer-overlay" onClick={onClose}>
      <div className="document-viewer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="viewer-header">
          <div className="viewer-title">
            <span className="file-icon">{fileType === 'pdf' ? '📕' : '🖼️'}</span>
            <span className="file-name">{filename}</span>
          </div>
          <div className="viewer-actions">
            <button onClick={downloadFile} title="Download">
              ⬇️
            </button>
            <button onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="viewer-content">
          {/* Document Display */}
          <div className="document-display">
            {fileType === 'pdf' ? (
              <>
                {isLoading && <div className="loading">Loading PDF...</div>}
                {error && <div className="error">{error}</div>}
                <Document
                  file={fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={<div className="loading">Loading PDF...</div>}
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </>
            ) : (
              <img
                src={fileUrl}
                alt={filename}
                style={{ maxWidth: '100%', transform: `scale(${scale})` }}
                onLoad={() => setIsLoading(false)}
                onError={() => setError('Failed to load image')}
              />
            )}
          </div>

          {/* Metadata Panel */}
          {metadata && (
            <div className="metadata-panel">
              <h4>Document Info</h4>

              {metadata.category && (
                <div className="meta-item">
                  <label>Category</label>
                  <span className="meta-badge">{metadata.category}</span>
                </div>
              )}

              {metadata.property_address && (
                <div className="meta-item">
                  <label>Property</label>
                  <span>{metadata.property_address}</span>
                </div>
              )}

              {metadata.due_date && (
                <div className="meta-item">
                  <label>Due Date</label>
                  <span className="due-date">{metadata.due_date}</span>
                </div>
              )}

              {metadata.tags && metadata.tags.length > 0 && (
                <div className="meta-item">
                  <label>Tags</label>
                  <div className="tags-list">
                    {metadata.tags.map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {metadata.summary && (
                <div className="meta-item">
                  <label>Summary</label>
                  <p className="summary">{metadata.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="viewer-footer">
          {/* Zoom Controls */}
          <div className="zoom-controls">
            <button onClick={zoomOut} title="Zoom Out">−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} title="Zoom In">+</button>
          </div>

          {/* Page Controls (PDF only) */}
          {fileType === 'pdf' && numPages > 0 && (
            <div className="page-controls">
              <button onClick={goToPrevPage} disabled={pageNumber <= 1}>
                ◀
              </button>
              <span>
                Page {pageNumber} of {numPages}
              </span>
              <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
                ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
