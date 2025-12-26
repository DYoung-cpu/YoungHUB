import { useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import Mortgages from '../components/Mortgages'
import FamilyTracking from '../components/FamilyTracking'
import { DocumentUploader, DocumentViewer, DocumentSearch, FamilyCalendar, VaultChat, UrgentItems } from '../components/vault'

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

interface DashboardProps {
  session: Session | null
}

export default function Dashboard({ session }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('documents')
  const [showUploader, setShowUploader] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const userName = session?.user?.email?.split('@')[0] || 'Guest'

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDocument(doc)
  }

  const handleUploadComplete = () => {
    setShowUploader(false)
    // Refresh will happen via component re-render
  }

  const getDocumentUrl = (filePath: string): string => {
    const { data } = supabase.storage.from('family-vault').getPublicUrl(filePath)
    return data.publicUrl
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Family Finance Hub</h1>
          <div className="user-info">
            <span>Welcome, {userName}</span>
            <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button 
          className={activeTab === 'tracking' ? 'active' : ''}
          onClick={() => setActiveTab('tracking')}
        >
          📍 Tracking
        </button>
        <button 
          className={activeTab === 'mortgages' ? 'active' : ''}
          onClick={() => setActiveTab('mortgages')}
        >
          🏠 Mortgages
        </button>
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={activeTab === 'documents' ? 'active' : ''}
          onClick={() => setActiveTab('documents')}
        >
          📁 Documents
        </button>
        <button 
          className={activeTab === 'accounts' ? 'active' : ''}
          onClick={() => setActiveTab('accounts')}
        >
          🏦 Accounts
        </button>
        <button 
          className={activeTab === 'expenses' ? 'active' : ''}
          onClick={() => setActiveTab('expenses')}
        >
          💰 Expenses
        </button>
        <button
          className={activeTab === 'calendar' ? 'active' : ''}
          onClick={() => setActiveTab('calendar')}
        >
          📅 Calendar
        </button>
        <button
          className={activeTab === 'ask' ? 'active' : ''}
          onClick={() => setActiveTab('ask')}
        >
          🤖 Ask Vault
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'tracking' && (
          <div className="tab-content">
            <FamilyTracking />
          </div>
        )}

        {activeTab === 'mortgages' && (
          <div className="tab-content">
            <Mortgages />
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="tab-content">
            <h2>Overview</h2>
            <div className="overview-grid">
              <div className="overview-card urgent-card">
                <UrgentItems onDocumentClick={(docId) => {
                  setActiveTab('documents')
                }} />
              </div>
              <div className="overview-card chat-card">
                <VaultChat onDocumentClick={(docId) => {
                  setActiveTab('documents')
                }} />
              </div>
              <div className="overview-card">
                <h3>Quick Actions</h3>
                <button className="action-btn" onClick={() => setActiveTab('documents')}>📁 View Documents</button>
                <button className="action-btn" onClick={() => setActiveTab('ask')}>🤖 Ask Vault AI</button>
                <button className="action-btn" onClick={() => setActiveTab('calendar')}>📅 Calendar</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="tab-content documents-tab">
            <div className="documents-header">
              <h2>Family Vault</h2>
              <button
                className="upload-btn"
                onClick={() => setShowUploader(true)}
              >
                📤 Upload Document
              </button>
            </div>
            <DocumentSearch onDocumentSelect={handleDocumentSelect} />

            {/* Upload Modal */}
            {showUploader && (
              <div className="modal-overlay" onClick={() => setShowUploader(false)}>
                <div className="modal-content upload-modal" onClick={e => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setShowUploader(false)}>✕</button>
                  <DocumentUploader onUploadComplete={handleUploadComplete} />
                </div>
              </div>
            )}

            {/* Document Viewer Modal */}
            {selectedDocument && (
              <DocumentViewer
                fileUrl={getDocumentUrl(selectedDocument.file_path)}
                fileType={selectedDocument.file_type}
                filename={selectedDocument.original_filename || selectedDocument.filename}
                onClose={() => setSelectedDocument(null)}
                metadata={{
                  category: selectedDocument.category,
                  property_address: selectedDocument.property_address,
                  tags: selectedDocument.tags,
                  due_date: selectedDocument.due_date,
                  summary: selectedDocument.summary,
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="tab-content">
            <h2>Financial Accounts</h2>
            <button className="add-account-btn">➕ Add New Account</button>
            <div className="accounts-list">
              <p>No accounts added yet</p>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="tab-content">
            <h2>Expense Tracker</h2>
            <button className="add-expense-btn">➕ Add Expense</button>
            <div className="expenses-list">
              <p>No expenses tracked yet</p>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="tab-content calendar-tab">
            <FamilyCalendar />
          </div>
        )}

        {activeTab === 'ask' && (
          <div className="tab-content ask-tab">
            <div className="ask-layout">
              <div className="ask-main">
                <VaultChat onDocumentClick={(docId) => {
                  setActiveTab('documents')
                }} />
              </div>
              <div className="ask-sidebar">
                <UrgentItems onDocumentClick={(docId) => {
                  setActiveTab('documents')
                }} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}