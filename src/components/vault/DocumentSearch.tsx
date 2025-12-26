import { useState, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { supabase } from '../../lib/supabase'

interface Document {
  id: string
  filename: string
  original_filename: string
  file_path: string
  file_type: string
  file_size: number
  category: string
  subcategory?: string
  tags?: string[]
  property_address?: string
  provider?: string
  summary?: string
  due_date?: string
  created_at: string
}

interface DocumentSearchProps {
  onDocumentSelect: (doc: Document) => void
}

// Natural language query mappings
const QUERY_MAPPINGS: { [key: string]: { category?: string; keywords?: string[] } } = {
  'home insurance': { category: 'insurance', keywords: ['mercury', 'ho6', 'homeowners'] },
  'insurance': { category: 'insurance' },
  'mortgage': { category: 'mortgage', keywords: ['escrow', 'payment', 'loan'] },
  'bank': { category: 'bank', keywords: ['statement', 'chase', 'account'] },
  'tax': { category: 'tax', keywords: ['ftb', 'irs', '1099', 'w2'] },
  'medical': { category: 'medical', keywords: ['medi-cal', 'doctor', 'health'] },
  'medi-cal': { category: 'medical', keywords: ['medi-cal', 'noa'] },
  'coty': { keywords: ['coty', 'coleman'] },
  'property tax': { category: 'housing', keywords: ['property', 'tax', 'county'] },
  'rent': { category: 'housing', keywords: ['jco', 'rso', 'rental'] },
}

export default function DocumentSearch({ onDocumentSelect }: DocumentSearchProps) {
  const [query, setQuery] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [results, setResults] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Fetch all documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
      setResults(data || [])
    } catch (err) {
      console.error('Error fetching documents:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize Fuse.js
  const fuse = useMemo(() => {
    return new Fuse(documents, {
      keys: [
        { name: 'filename', weight: 0.3 },
        { name: 'original_filename', weight: 0.3 },
        { name: 'category', weight: 0.2 },
        { name: 'tags', weight: 0.15 },
        { name: 'provider', weight: 0.1 },
        { name: 'summary', weight: 0.1 },
        { name: 'property_address', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
    })
  }, [documents])

  // Search handler
  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)

    if (!searchQuery.trim()) {
      setResults(documents)
      setSelectedCategory(null)
      return
    }

    const lowerQuery = searchQuery.toLowerCase()

    // Check for natural language queries
    let matchedMapping: { category?: string; keywords?: string[] } | null = null
    for (const [phrase, mapping] of Object.entries(QUERY_MAPPINGS)) {
      if (lowerQuery.includes(phrase)) {
        matchedMapping = mapping
        break
      }
    }

    if (matchedMapping) {
      // Filter by category and/or keywords
      let filtered = documents

      if (matchedMapping.category) {
        filtered = filtered.filter(d => d.category === matchedMapping!.category)
        setSelectedCategory(matchedMapping.category)
      }

      if (matchedMapping.keywords) {
        const keywords = matchedMapping.keywords
        filtered = filtered.filter(d => {
          const searchText = [
            d.filename,
            d.original_filename,
            d.provider,
            d.summary,
            ...(d.tags || [])
          ].join(' ').toLowerCase()
          return keywords.some(kw => searchText.includes(kw))
        })
      }

      setResults(filtered)
    } else {
      // Use Fuse.js fuzzy search
      const fuseResults = fuse.search(searchQuery)
      setResults(fuseResults.map(r => r.item))
      setSelectedCategory(null)
    }
  }

  // Filter by category
  const filterByCategory = (category: string | null) => {
    setSelectedCategory(category)
    if (category) {
      setResults(documents.filter(d => d.category === category))
      setQuery('')
    } else {
      setResults(documents)
    }
  }

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      insurance: '🛡️',
      mortgage: '🏠',
      bank: '🏦',
      medical: '🏥',
      tax: '📋',
      housing: '🏢',
      legal: '⚖️',
      other: '📁',
    }
    return icons[category] || '📄'
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Get unique categories from documents
  const categories = useMemo(() => {
    const cats = new Set(documents.map(d => d.category))
    return Array.from(cats).filter(Boolean)
  }, [documents])

  return (
    <div className="document-search">
      {/* Search Bar */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search documents... (e.g., 'home insurance', 'Coty medical')"
          className="search-input"
        />
        {query && (
          <button
            className="clear-search"
            onClick={() => handleSearch('')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick Filters */}
      <div className="quick-filters">
        <button
          className={`filter-btn ${selectedCategory === null ? 'active' : ''}`}
          onClick={() => filterByCategory(null)}
        >
          All ({documents.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => filterByCategory(cat)}
          >
            {getCategoryIcon(cat)} {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="search-results">
        {isLoading ? (
          <div className="loading">Loading documents...</div>
        ) : results.length === 0 ? (
          <div className="no-results">
            <span className="no-results-icon">📭</span>
            <p>No documents found</p>
            {query && <p className="hint">Try a different search term</p>}
          </div>
        ) : (
          <>
            <div className="results-count">
              {results.length} document{results.length !== 1 ? 's' : ''} found
            </div>
            <div className="results-grid">
              {results.map(doc => (
                <div
                  key={doc.id}
                  className="document-card"
                  onClick={() => onDocumentSelect(doc)}
                >
                  <div className="card-icon">
                    {doc.file_type === 'pdf' ? '📕' : '🖼️'}
                  </div>
                  <div className="card-content">
                    <div className="card-title">
                      {doc.original_filename || doc.filename}
                    </div>
                    <div className="card-meta">
                      <span className="category-badge">
                        {getCategoryIcon(doc.category)} {doc.category}
                      </span>
                      <span className="file-size">
                        {formatFileSize(doc.file_size)}
                      </span>
                    </div>
                    {doc.property_address && (
                      <div className="card-property">
                        📍 {doc.property_address.split(',')[0]}
                      </div>
                    )}
                    {doc.due_date && (
                      <div className="card-due-date">
                        ⏰ Due: {formatDate(doc.due_date)}
                      </div>
                    )}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="card-tags">
                        {doc.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="card-date">
                    {formatDate(doc.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Example Queries */}
      {!query && results.length > 0 && (
        <div className="example-queries">
          <span>Try:</span>
          <button onClick={() => handleSearch('home insurance')}>
            "home insurance"
          </button>
          <button onClick={() => handleSearch('mortgage')}>
            "mortgage"
          </button>
          <button onClick={() => handleSearch('coty medical')}>
            "coty medical"
          </button>
        </div>
      )}
    </div>
  )
}
