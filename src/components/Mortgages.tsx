import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Property {
  id?: string
  address: string
  unit?: string
  city: string
  state: string
  zip: string
  purchasePrice: number
  purchaseDate: string
  currentValue?: number
  loanAmount: number
  lender: string
  interestRate: number
  loanTerm: number
  monthlyPayment: number
  propertyTax?: number
  insurance?: number
  hoa?: number
  notes?: string
}

export default function Mortgages() {
  const [properties, setProperties] = useState<Property[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)

  // Sample property data (will be replaced with database)
  const sampleProperty: Property = {
    id: '1',
    address: '1808 Manning Ave',
    unit: 'Unit 202',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90049',
    purchasePrice: 0,
    purchaseDate: '',
    loanAmount: 0,
    lender: '',
    interestRate: 0,
    loanTerm: 30,
    monthlyPayment: 0,
  }

  useEffect(() => {
    loadProperties()
  }, [])

  const loadProperties = async () => {
    // For now, use sample data. Later will fetch from Supabase
    setProperties([sampleProperty])
    setLoading(false)
  }

  const [formData, setFormData] = useState<Property>({
    address: '',
    unit: '',
    city: '',
    state: '',
    zip: '',
    purchasePrice: 0,
    purchaseDate: '',
    currentValue: 0,
    loanAmount: 0,
    lender: '',
    interestRate: 0,
    loanTerm: 30,
    monthlyPayment: 0,
    propertyTax: 0,
    insurance: 0,
    hoa: 0,
    notes: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('Price') || name.includes('Amount') || name.includes('Payment') || 
               name.includes('Tax') || name.includes('insurance') || name.includes('hoa') || 
               name.includes('Value') || name.includes('Rate') || name.includes('Term')
        ? parseFloat(value) || 0
        : value
    }))
  }

  const calculateMonthlyPayment = () => {
    const principal = formData.loanAmount
    const rate = formData.interestRate / 100 / 12
    const term = formData.loanTerm * 12
    
    if (principal && rate && term) {
      const payment = principal * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1)
      setFormData(prev => ({ ...prev, monthlyPayment: Math.round(payment * 100) / 100 }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingProperty) {
      // Update existing property
      setProperties(prev => prev.map(p => 
        p.id === editingProperty.id ? { ...formData, id: editingProperty.id } : p
      ))
      setEditingProperty(null)
    } else {
      // Add new property
      const newProperty = { ...formData, id: Date.now().toString() }
      setProperties(prev => [...prev, newProperty])
    }
    
    setShowAddForm(false)
    setFormData({
      address: '',
      unit: '',
      city: '',
      state: '',
      zip: '',
      purchasePrice: 0,
      purchaseDate: '',
      currentValue: 0,
      loanAmount: 0,
      lender: '',
      interestRate: 0,
      loanTerm: 30,
      monthlyPayment: 0,
      propertyTax: 0,
      insurance: 0,
      hoa: 0,
      notes: ''
    })
  }

  const handleEdit = (property: Property) => {
    setFormData(property)
    setEditingProperty(property)
    setShowAddForm(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this property?')) {
      setProperties(prev => prev.filter(p => p.id !== id))
    }
  }

  const getTotalMonthlyPayment = (property: Property) => {
    return (property.monthlyPayment || 0) + 
           (property.propertyTax || 0) / 12 + 
           (property.insurance || 0) / 12 + 
           (property.hoa || 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return <div className="loading">Loading properties...</div>
  }

  return (
    <div className="mortgages-container">
      <div className="mortgages-header">
        <h2>🏠 Property Mortgages</h2>
        <button 
          className="add-property-btn"
          onClick={() => setShowAddForm(true)}
        >
          ➕ Add Property
        </button>
      </div>

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingProperty ? 'Edit Property' : 'Add New Property'}</h3>
            <form onSubmit={handleSubmit} className="property-form">
              <div className="form-section">
                <h4>Property Details</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="1808 Manning Ave"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit/Apt</label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      placeholder="Unit 202"
                    />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Los Angeles"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="CA"
                      maxLength={2}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>ZIP Code</label>
                    <input
                      type="text"
                      name="zip"
                      value={formData.zip}
                      onChange={handleInputChange}
                      placeholder="90049"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Purchase Information</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Purchase Price</label>
                    <input
                      type="number"
                      name="purchasePrice"
                      value={formData.purchasePrice}
                      onChange={handleInputChange}
                      placeholder="500000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Purchase Date</label>
                    <input
                      type="date"
                      name="purchaseDate"
                      value={formData.purchaseDate}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Current Value</label>
                    <input
                      type="number"
                      name="currentValue"
                      value={formData.currentValue}
                      onChange={handleInputChange}
                      placeholder="550000"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Loan Details</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Loan Amount</label>
                    <input
                      type="number"
                      name="loanAmount"
                      value={formData.loanAmount}
                      onChange={handleInputChange}
                      placeholder="400000"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Lender</label>
                    <input
                      type="text"
                      name="lender"
                      value={formData.lender}
                      onChange={handleInputChange}
                      placeholder="Bank of America"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Interest Rate (%)</label>
                    <input
                      type="number"
                      name="interestRate"
                      value={formData.interestRate}
                      onChange={handleInputChange}
                      step="0.01"
                      placeholder="3.5"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Loan Term (years)</label>
                    <input
                      type="number"
                      name="loanTerm"
                      value={formData.loanTerm}
                      onChange={handleInputChange}
                      placeholder="30"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Monthly Payment</label>
                    <div className="input-with-button">
                      <input
                        type="number"
                        name="monthlyPayment"
                        value={formData.monthlyPayment}
                        onChange={handleInputChange}
                        placeholder="2500"
                        required
                      />
                      <button type="button" onClick={calculateMonthlyPayment} className="calc-btn">
                        Calculate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Additional Costs</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Property Tax (Annual)</label>
                    <input
                      type="number"
                      name="propertyTax"
                      value={formData.propertyTax}
                      onChange={handleInputChange}
                      placeholder="6000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Insurance (Annual)</label>
                    <input
                      type="number"
                      name="insurance"
                      value={formData.insurance}
                      onChange={handleInputChange}
                      placeholder="1200"
                    />
                  </div>
                  <div className="form-group">
                    <label>HOA (Monthly)</label>
                    <input
                      type="number"
                      name="hoa"
                      value={formData.hoa}
                      onChange={handleInputChange}
                      placeholder="300"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Notes</h4>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Additional notes about this property..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowAddForm(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingProperty ? 'Update Property' : 'Add Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="properties-grid">
        {properties.length === 0 ? (
          <div className="no-properties">
            <p>No properties added yet. Click "Add Property" to get started.</p>
          </div>
        ) : (
          properties.map(property => (
            <div key={property.id} className="property-card">
              <div className="property-header">
                <h3>
                  {property.address}
                  {property.unit && `, ${property.unit}`}
                </h3>
                <div className="property-actions">
                  <button onClick={() => handleEdit(property)} className="edit-btn">✏️</button>
                  <button onClick={() => handleDelete(property.id!)} className="delete-btn">🗑️</button>
                </div>
              </div>
              
              <div className="property-location">
                {property.city}, {property.state} {property.zip}
              </div>

              <div className="property-details">
                <div className="detail-section">
                  <h4>Purchase Info</h4>
                  <div className="detail-row">
                    <span>Purchase Price:</span>
                    <strong>{formatCurrency(property.purchasePrice)}</strong>
                  </div>
                  {property.purchaseDate && (
                    <div className="detail-row">
                      <span>Purchase Date:</span>
                      <strong>{new Date(property.purchaseDate).toLocaleDateString()}</strong>
                    </div>
                  )}
                  {property.currentValue && (
                    <div className="detail-row">
                      <span>Current Value:</span>
                      <strong>{formatCurrency(property.currentValue)}</strong>
                    </div>
                  )}
                  {property.currentValue && property.loanAmount && (
                    <div className="detail-row">
                      <span>Equity:</span>
                      <strong className="equity">
                        {formatCurrency((property.currentValue || property.purchasePrice) - property.loanAmount)}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4>Loan Details</h4>
                  <div className="detail-row">
                    <span>Lender:</span>
                    <strong>{property.lender || 'Not specified'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Loan Amount:</span>
                    <strong>{formatCurrency(property.loanAmount)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Interest Rate:</span>
                    <strong>{property.interestRate}%</strong>
                  </div>
                  <div className="detail-row">
                    <span>Loan Term:</span>
                    <strong>{property.loanTerm} years</strong>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Monthly Costs</h4>
                  <div className="detail-row">
                    <span>Principal & Interest:</span>
                    <strong>{formatCurrency(property.monthlyPayment)}</strong>
                  </div>
                  {property.propertyTax && (
                    <div className="detail-row">
                      <span>Property Tax:</span>
                      <strong>{formatCurrency(property.propertyTax / 12)}</strong>
                    </div>
                  )}
                  {property.insurance && (
                    <div className="detail-row">
                      <span>Insurance:</span>
                      <strong>{formatCurrency(property.insurance / 12)}</strong>
                    </div>
                  )}
                  {property.hoa && (
                    <div className="detail-row">
                      <span>HOA:</span>
                      <strong>{formatCurrency(property.hoa)}</strong>
                    </div>
                  )}
                  <div className="detail-row total">
                    <span>Total Monthly:</span>
                    <strong>{formatCurrency(getTotalMonthlyPayment(property))}</strong>
                  </div>
                </div>

                {property.notes && (
                  <div className="detail-section">
                    <h4>Notes</h4>
                    <p className="property-notes">{property.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {properties.length > 0 && (
        <div className="summary-section">
          <h3>Portfolio Summary</h3>
          <div className="summary-grid">
            <div className="summary-card">
              <span>Total Properties</span>
              <strong>{properties.length}</strong>
            </div>
            <div className="summary-card">
              <span>Total Value</span>
              <strong>
                {formatCurrency(
                  properties.reduce((sum, p) => sum + (p.currentValue || p.purchasePrice), 0)
                )}
              </strong>
            </div>
            <div className="summary-card">
              <span>Total Debt</span>
              <strong>
                {formatCurrency(
                  properties.reduce((sum, p) => sum + p.loanAmount, 0)
                )}
              </strong>
            </div>
            <div className="summary-card">
              <span>Total Equity</span>
              <strong className="equity">
                {formatCurrency(
                  properties.reduce((sum, p) => 
                    sum + ((p.currentValue || p.purchasePrice) - p.loanAmount), 0
                  )
                )}
              </strong>
            </div>
            <div className="summary-card">
              <span>Monthly Payments</span>
              <strong>
                {formatCurrency(
                  properties.reduce((sum, p) => sum + getTotalMonthlyPayment(p), 0)
                )}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}