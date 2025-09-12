import { useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import Mortgages from '../components/Mortgages'

interface DashboardProps {
  session: Session
}

export default function Dashboard({ session }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('mortgages')
  
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Family Finance Hub</h1>
          <div className="user-info">
            <span>Welcome, {session.user.email?.split('@')[0]}</span>
            <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
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
      </nav>

      <main className="dashboard-content">
        {activeTab === 'mortgages' && (
          <div className="tab-content">
            <Mortgages />
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="tab-content">
            <h2>Overview</h2>
            <div className="overview-grid">
              <div className="overview-card">
                <h3>Recent Documents</h3>
                <p>No documents uploaded yet</p>
              </div>
              <div className="overview-card">
                <h3>Upcoming Bills</h3>
                <p>No bills scheduled</p>
              </div>
              <div className="overview-card">
                <h3>Account Summary</h3>
                <p>Add your accounts to get started</p>
              </div>
              <div className="overview-card">
                <h3>Quick Actions</h3>
                <button className="action-btn">📤 Upload Document</button>
                <button className="action-btn">➕ Add Account</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="tab-content">
            <h2>Documents</h2>
            <div className="document-upload">
              <div className="upload-area">
                <svg className="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p>Drag and drop files here, or click to browse</p>
                <input type="file" className="file-input" multiple />
              </div>
            </div>
            <div className="document-list">
              <h3>Your Documents</h3>
              <p>No documents uploaded yet</p>
            </div>
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
          <div className="tab-content">
            <h2>Important Dates</h2>
            <button className="add-event-btn">➕ Add Event</button>
            <div className="calendar-view">
              <p>No events scheduled</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}