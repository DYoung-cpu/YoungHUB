import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { formatDistanceToNow } from 'date-fns'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { locationTracker } from '../lib/locationTracker'
import { supabase } from '../lib/supabase'

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface FamilyMember {
  id: string
  name: string
  email: string
  location?: {
    lat: number
    lng: number
    accuracy: number
    timestamp: Date
    battery?: number
    speed?: number
  }
  status?: string
  isSharing: boolean
  avatar?: string
  profilePicture?: string // Base64 encoded image
}

interface Place {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  radius: number // in meters
  icon: string
  notifications: boolean
}

interface ChatMessage {
  id: string
  sender: string
  message: string
  timestamp: Date
  type: 'text' | 'location' | 'sos'
}

// Component to recenter map on current location
function RecenterButton({ position }: { position: [number, number] | null }) {
  const map = useMap()

  const handleRecenter = () => {
    if (position) {
      map.setView(position, 15)
    }
  }

  return (
    <button
      onClick={handleRecenter}
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'white',
        border: '2px solid #667eea',
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}
    >
      📍 My Location
    </button>
  )
}

// Component to fly to a member's location when focused
function MapController({ focusedPosition }: { focusedPosition: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (focusedPosition) {
      map.flyTo(focusedPosition, 16, { duration: 1 })
    }
  }, [map, focusedPosition])

  return null
}

export default function FamilyTracking() {
  const [showAvatarUpload, setShowAvatarUpload] = useState(false)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [focusedPosition, setFocusedPosition] = useState<[number, number] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const myEmail = 'dyoung1946@gmail.com' // This would come from auth

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])

  const [places, setPlaces] = useState<Place[]>([
    {
      id: '1',
      name: 'Home',
      address: 'Current Home Location',
      lat: 34.0522,
      lng: -118.2437,
      radius: 100,
      icon: '🏠',
      notifications: true
    }
  ])

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [myLocation, setMyLocation] = useState<GeolocationPosition | null>(null)
  const [selectedView, setSelectedView] = useState<'map' | 'list' | 'chat' | 'places'>('map')
  const [isTracking, setIsTracking] = useState(true) // Always tracking by default
  const [showAddPlace, setShowAddPlace] = useState(false)
  const watchId = useRef<number | null>(null)

  // Load family members from Supabase on mount
  const loadFamilyMembers = useCallback(async () => {
    try {
      // Load family members with their current locations
      const { data: members, error: membersError } = await supabase
        .from('family_members')
        .select(`
          id,
          email,
          name,
          avatar_url,
          status,
          is_sharing,
          locations (
            latitude,
            longitude,
            accuracy,
            speed,
            battery_level,
            timestamp
          )
        `)

      if (membersError) {
        console.error('Error loading family members:', membersError)
        // Fall back to default members if database fails
        setFamilyMembers([
          { id: '1', name: 'David', email: 'dyoung1946@gmail.com', isSharing: true, status: 'Active' },
          { id: '2', name: 'Lisa', email: 'lisa.young@email.com', isSharing: true, status: 'Active' }
        ])
        setIsLoading(false)
        return
      }

      if (members && members.length > 0) {
        const mappedMembers: FamilyMember[] = members.map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          isSharing: m.is_sharing ?? true,
          status: m.status || 'Active',
          avatar: m.avatar_url,
          profilePicture: localStorage.getItem(`avatar_${m.name.toLowerCase()}`) || m.avatar_url || undefined,
          location: m.locations?.[0] ? {
            lat: parseFloat(m.locations[0].latitude),
            lng: parseFloat(m.locations[0].longitude),
            accuracy: m.locations[0].accuracy || 0,
            timestamp: new Date(m.locations[0].timestamp),
            speed: m.locations[0].speed || undefined,
            battery: m.locations[0].battery_level || undefined
          } : undefined
        }))
        setFamilyMembers(mappedMembers)
      } else {
        // No members in DB - create default ones
        console.log('No family members found, creating defaults...')
        await ensureDefaultMembers()
      }
    } catch (error) {
      console.error('Failed to load family members:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Ensure default family members exist in database
  const ensureDefaultMembers = async () => {
    const defaultMembers = [
      { email: 'dyoung1946@gmail.com', name: 'David', status: 'Active', is_sharing: true },
      { email: 'lisa.young@email.com', name: 'Lisa', status: 'Active', is_sharing: true }
    ]

    for (const member of defaultMembers) {
      const { error } = await supabase
        .from('family_members')
        .upsert(member, { onConflict: 'email' })

      if (error) {
        console.error('Error creating member:', error)
      }
    }

    // Reload after creating
    await loadFamilyMembers()
  }

  // Save my location to Supabase
  const saveLocationToDatabase = useCallback(async (position: GeolocationPosition) => {
    console.log('=== SAVING LOCATION ===')
    console.log('Coords:', position.coords.latitude, position.coords.longitude)
    console.log('Looking for member:', myEmail)

    try {
      // First get my member ID - use maybeSingle to avoid error if not found
      const { data: member, error: memberError } = await supabase
        .from('family_members')
        .select('id')
        .eq('email', myEmail)
        .maybeSingle()

      if (memberError) {
        console.error('Error finding member:', memberError)
        return
      }

      let memberId = member?.id

      if (!memberId) {
        console.log('Member not found, creating...')
        const { data: newMember, error: createError } = await supabase
          .from('family_members')
          .insert({ email: myEmail, name: 'David', status: 'Active', is_sharing: true })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating member:', createError)
          return
        }
        if (!newMember) {
          console.error('No member created')
          return
        }
        memberId = newMember.id
        console.log('Created new member:', memberId)
      } else {
        console.log('Found existing member:', memberId)
      }

      // Update member to show they're sharing
      const { error: updateError } = await supabase
        .from('family_members')
        .update({ is_sharing: true, status: 'Active', updated_at: new Date().toISOString() })
        .eq('id', memberId)

      if (updateError) {
        console.error('Error updating member status:', updateError)
      }

      // First try to delete existing location, then insert new one
      // This is more reliable than upsert with some Supabase configurations
      await supabase
        .from('locations')
        .delete()
        .eq('member_id', memberId)

      const { error: locationError } = await supabase
        .from('locations')
        .insert({
          member_id: memberId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          battery_level: null,
          timestamp: new Date().toISOString()
        })

      if (locationError) {
        console.error('Error saving location:', locationError)
      } else {
        console.log('✅ Location saved successfully!')
      }

      // Save to history (don't wait for this)
      supabase.from('location_history').insert({
        member_id: memberId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed || 0,
        timestamp: new Date().toISOString()
      }).then(({ error }) => {
        if (error) console.error('History save error:', error)
      })

      // Reload family members to show updated location
      console.log('Reloading family members...')
      await loadFamilyMembers()
      console.log('=== DONE ===')
    } catch (error) {
      console.error('Failed to save location:', error)
    }
  }, [myEmail, loadFamilyMembers])

  // Focus map on a specific family member
  const focusOnMember = (member: FamilyMember) => {
    if (member.location) {
      setFocusedPosition([member.location.lat, member.location.lng])
      setSelectedView('map') // Switch to map view
    } else {
      alert(`${member.name}'s location is not available`)
    }
  }

  // Load family members on mount
  useEffect(() => {
    loadFamilyMembers()

    // Subscribe to real-time location updates
    const subscription = supabase
      .channel('location-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'locations'
      }, (payload) => {
        console.log('Location update received:', payload)
        // Reload family members to get updated locations
        loadFamilyMembers()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [loadFamilyMembers])

  // Check for avatar permission on first load (only if members loaded)
  useEffect(() => {
    if (familyMembers.length === 0) return

    const hasRequestedAvatars = localStorage.getItem('avatarsRequested')
    if (!hasRequestedAvatars) {
      setTimeout(() => {
        const userConsent = window.confirm(
          '📷 Would you like to add profile pictures for family members?\n\n' +
          'This will help you quickly identify family members on the map.'
        )

        localStorage.setItem('avatarsRequested', 'true')
        if (userConsent) {
          setShowAvatarUpload(true)
          setSelectedMember(familyMembers[0]?.id || null)
        }
      }, 2000)
    }
  }, [familyMembers])

  // Auto-start tracking on component mount (like Life360)
  useEffect(() => {
    const initTracking = async () => {
      // Always start tracking - permission was already requested at app start
      if ('geolocation' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          
          if (permission.state === 'granted') {
            // Permission already granted - start tracking immediately
            startTracking()
          } else if (permission.state === 'prompt') {
            // Show custom prompt explaining why we need location
            const userConsent = window.confirm(
              '📍 Family Finance Hub needs your location to:\n\n' +
              '• Show your location to family members\n' +
              '• Send alerts when you arrive/leave places\n' +
              '• Track family members safely\n\n' +
              'Allow location tracking?'
            )
            
            if (userConsent) {
              startTracking()
            }
          }
        } catch (error) {
          console.log('Permission API not supported, requesting directly')
          startTracking() // This will trigger the browser's permission prompt
        }
      }
    }

    // Start tracking immediately on mount
    initTracking()
  }, [])

  // Start enhanced location tracking with smart updates
  const startTracking = async () => {
    if ('geolocation' in navigator) {
      setIsTracking(true)
      
      // Save preference
      localStorage.setItem('trackingEnabled', 'true')
      
      // Get unique device ID (stored in localStorage)
      let deviceId = localStorage.getItem('deviceId')
      if (!deviceId) {
        // Generate unique device ID for this phone/browser
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('deviceId', deviceId)
      }
      
      // Use enhanced tracker for smart, battery-efficient updates
      const myEmail = 'dyoung1946@gmail.com' // This would come from auth
      const success = await locationTracker.startTracking(myEmail)
      
      if (!success) {
        alert('Please enable location services')
        setIsTracking(false)
        return
      }

      // Get tracking status
      const status = locationTracker.getStatus()
      console.log('Tracking status:', status)
      
      // Also update local state for immediate UI feedback
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMyLocation(position)
          updateMyLocation(position)
          
          // Update Home location to actual current location on first tracking
          if (!localStorage.getItem('homeLocationSet')) {
            setPlaces(prev => prev.map(place => 
              place.name === 'Home' 
                ? { 
                    ...place, 
                    lat: position.coords.latitude, 
                    lng: position.coords.longitude,
                    address: 'Your Home Location'
                  }
                : place
            ))
            localStorage.setItem('homeLocationSet', 'true')
          }
        },
        (error) => {
          console.error('Location error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )

      // Show tracking mode notification
      if (status.hasServiceWorker) {
        showNotification('📍 Background tracking active - works when app is closed!')
      } else {
        showNotification('📍 Location tracking started')
      }
    } else {
      alert('Geolocation is not supported by your browser')
    }
  }

  // Stop location tracking
  // @ts-ignore - Keeping for future use
  const stopTracking = () => {
    // Save preference that user disabled tracking
    localStorage.setItem('trackingEnabled', 'false')
    
    locationTracker.stopTracking()
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setIsTracking(false)
    showNotification('📍 Location tracking stopped')
  }

  // Update my location in the family members list AND save to database
  const updateMyLocation = (position: GeolocationPosition) => {
    setFamilyMembers(prev => prev.map(member => {
      if (member.email === myEmail) {
        // Check if at home
        const homePlace = places.find(p => p.name === 'Home')
        let newStatus = member.status

        if (homePlace) {
          const distanceFromHome = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            homePlace.lat,
            homePlace.lng
          )

          if (distanceFromHome <= homePlace.radius) {
            newStatus = '🏠 Home'
          }
        }

        return {
          ...member,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp),
            speed: position.coords.speed || undefined,
            battery: undefined
          },
          status: newStatus
        }
      }
      return member
    }))

    // Also save to Supabase database
    saveLocationToDatabase(position)
  }

  // Check if entered/left any geofenced places
  // @ts-ignore - Used in location updates
  const checkGeofences = (position: GeolocationPosition) => {
    places.forEach(place => {
      if (place.notifications) {
        const distance = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          place.lat,
          place.lng
        )
        
        if (distance <= place.radius) {
          // Entered place
          showNotification(`Arrived at ${place.name}`)
        }
      }
    })
  }

  // Calculate distance between two coordinates (in meters)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  // Show notification
  const showNotification = (message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Family Hub', {
        body: message,
        icon: '/icon-192x192.png'
      })
    }
  }

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Send chat message
  const sendMessage = (type: 'text' | 'location' | 'sos' = 'text') => {
    if (newMessage.trim() || type !== 'text') {
      const message: ChatMessage = {
        id: Date.now().toString(),
        sender: 'David',
        message: type === 'sos' ? '🆘 EMERGENCY - NEED HELP!' : 
                 type === 'location' ? '📍 Shared location' : 
                 newMessage,
        timestamp: new Date(),
        type
      }
      setChatMessages(prev => [...prev, message])
      setNewMessage('')
    }
  }

  // Add new place
  const addPlace = (name: string, address: string) => {
    if (myLocation) {
      const newPlace: Place = {
        id: Date.now().toString(),
        name,
        address,
        lat: myLocation.coords.latitude,
        lng: myLocation.coords.longitude,
        radius: 100,
        icon: name === 'Work' ? '🏢' : name === 'School' ? '🏫' : '📍',
        notifications: true
      }
      setPlaces(prev => [...prev, newPlace])
      setShowAddPlace(false)
    }
  }

  // Get center coordinates for map
  const getMapCenter = (): [number, number] => {
    // First priority: Use my current location if tracking
    if (myLocation) {
      return [myLocation.coords.latitude, myLocation.coords.longitude]
    }
    // Second priority: Use any family member with location
    const memberWithLocation = familyMembers.find(m => m.location)
    if (memberWithLocation?.location) {
      return [memberWithLocation.location.lat, memberWithLocation.location.lng]
    }
    // Don't default to Manning Ave - wait for real location
    return [34.0522, -118.2437] // Downtown LA as neutral default
  }

  // Handle avatar upload
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && selectedMember) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        
        // Find member and update their avatar
        const member = familyMembers.find(m => m.id === selectedMember)
        if (member) {
          // Save to localStorage
          localStorage.setItem(`avatar_${member.name.toLowerCase()}`, base64String)
          
          // Update state
          setFamilyMembers(prev => prev.map(m => 
            m.id === selectedMember 
              ? { ...m, profilePicture: base64String }
              : m
          ))
        }
        
        // Move to next member or close
        if (selectedMember === '1') {
          setSelectedMember('2')
        } else {
          setShowAvatarUpload(false)
          setSelectedMember(null)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="family-tracking-container">
      <div className="tracking-header">
        <h2>👨‍👩‍👧 Family Tracking</h2>
        <div className="tracking-status-badge">
          {myLocation ? (
            <span className="status-active">
              <span className="pulse-dot"></span>
              Live Tracking
            </span>
          ) : (
            <button
              className="enable-tracking-btn"
              onClick={startTracking}
            >
              📍 Enable Location
            </button>
          )}
        </div>
      </div>

      <div className="tracking-tabs">
        <button 
          className={selectedView === 'map' ? 'active' : ''}
          onClick={() => setSelectedView('map')}
        >
          🗺️ Map
        </button>
        <button 
          className={selectedView === 'list' ? 'active' : ''}
          onClick={() => setSelectedView('list')}
        >
          👥 Family
        </button>
        <button 
          className={selectedView === 'places' ? 'active' : ''}
          onClick={() => setSelectedView('places')}
        >
          📍 Places
        </button>
        <button 
          className={selectedView === 'chat' ? 'active' : ''}
          onClick={() => setSelectedView('chat')}
        >
          💬 Chat
        </button>
      </div>

      <div className="tracking-content">
        {selectedView === 'map' && (
          <div className="map-view">
            <MapContainer 
              center={getMapCenter()} 
              zoom={13} 
              style={{ height: '500px', width: '100%' }}
              className="family-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Recenter button */}
              {myLocation && (
                <RecenterButton position={[myLocation.coords.latitude, myLocation.coords.longitude]} />
              )}

              {/* Controller to fly to focused member */}
              <MapController focusedPosition={focusedPosition} />
              
              {/* Family member markers */}
              {familyMembers.map(member => {
                if (member.location) {
                  return (
                    <Marker 
                      key={member.id}
                      position={[member.location.lat, member.location.lng]}
                    >
                      <Popup>
                        <div className="member-popup">
                          <strong>{member.name}</strong>
                          <p>{member.status}</p>
                          <small>
                            Updated {formatDistanceToNow(member.location.timestamp)} ago
                          </small>
                          {member.location.battery && (
                            <p>🔋 {member.location.battery}%</p>
                          )}
                          {member.location.speed && (
                            <p>🚗 {Math.round(member.location.speed * 2.237)} mph</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )
                }
                return null
              })}

              {/* Place circles */}
              {places.map(place => (
                <Circle
                  key={place.id}
                  center={[place.lat, place.lng]}
                  radius={place.radius}
                  pathOptions={{ 
                    fillColor: 'blue',
                    fillOpacity: 0.1,
                    color: 'blue',
                    weight: 2
                  }}
                >
                  <Popup>
                    <div className="place-popup">
                      <strong>{place.icon} {place.name}</strong>
                      <p>{place.address}</p>
                      <small>Radius: {place.radius}m</small>
                    </div>
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          </div>
        )}

        {selectedView === 'list' && (
          <div className="family-list">
            {isLoading ? (
              <div className="loading-state">Loading family members...</div>
            ) : familyMembers.length === 0 ? (
              <div className="empty-state">No family members found</div>
            ) : (
              familyMembers.map(member => (
                <div
                  key={member.id}
                  className={`family-member-card ${member.location ? 'has-location' : 'no-location'}`}
                  onClick={() => focusOnMember(member)}
                  style={{ cursor: member.location ? 'pointer' : 'default' }}
                >
                  <div className="member-header">
                    <div className="member-avatar" onClick={(e) => {
                      e.stopPropagation() // Don't trigger card click
                      if (!member.profilePicture) {
                        setSelectedMember(member.id)
                        setShowAvatarUpload(true)
                      }
                    }}>
                      {member.profilePicture ? (
                        <img src={member.profilePicture} alt={member.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {member.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="member-info">
                      <h3>{member.name}</h3>
                      <p className="member-status">{member.status}</p>
                    </div>
                    <div className="member-sharing">
                      {member.isSharing ? (
                        <span className="sharing-active">📍 Sharing</span>
                      ) : (
                        <span className="sharing-inactive">📍 Not sharing</span>
                      )}
                    </div>
                  </div>

                  {member.location ? (
                    <div className="member-location">
                      <div className="location-details">
                        <p>📍 Last seen: {formatDistanceToNow(member.location.timestamp)} ago</p>
                        {member.location.battery && (
                          <p>🔋 Battery: {member.location.battery}%</p>
                        )}
                        {member.location.speed && member.location.speed > 0 && (
                          <p>🚗 Speed: {Math.round(member.location.speed * 2.237)} mph</p>
                        )}
                        <p>📏 Accuracy: ±{Math.round(member.location.accuracy)}m</p>
                      </div>
                      <button
                        className="locate-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          focusOnMember(member)
                        }}
                      >
                        🎯 Show on Map
                      </button>
                    </div>
                  ) : (
                    <div className="member-location no-data">
                      <p>📍 Location not available - waiting for update</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {selectedView === 'places' && (
          <div className="places-view">
            <div className="places-header">
              <h3>Saved Places</h3>
              <button 
                onClick={() => setShowAddPlace(true)}
                className="add-place-btn"
              >
                ➕ Add Current Location
              </button>
            </div>
            
            {showAddPlace && (
              <div className="add-place-form">
                <input 
                  type="text" 
                  placeholder="Place name (e.g., Work, Gym)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement
                      addPlace(input.value, 'Current location')
                      input.value = ''
                    }
                  }}
                />
                <button onClick={() => setShowAddPlace(false)}>Cancel</button>
              </div>
            )}

            <div className="places-list">
              {places.map(place => (
                <div key={place.id} className="place-card">
                  <div className="place-icon">{place.icon}</div>
                  <div className="place-info">
                    <h4>{place.name}</h4>
                    <p>{place.address}</p>
                    <small>Alert radius: {place.radius}m</small>
                  </div>
                  <div className="place-actions">
                    <button 
                      className={`notification-toggle ${place.notifications ? 'active' : ''}`}
                      onClick={() => {
                        setPlaces(prev => prev.map(p => 
                          p.id === place.id 
                            ? { ...p, notifications: !p.notifications }
                            : p
                        ))
                      }}
                    >
                      {place.notifications ? '🔔' : '🔕'}
                    </button>
                    <button 
                      className="delete-place-btn"
                      onClick={() => {
                        setPlaces(prev => prev.filter(p => p.id !== place.id))
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedView === 'chat' && (
          <div className="family-chat">
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Start a conversation!</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`chat-message ${msg.type === 'sos' ? 'sos-message' : ''}`}
                  >
                    <div className="message-header">
                      <strong>{msg.sender}</strong>
                      <small>{formatDistanceToNow(msg.timestamp)} ago</small>
                    </div>
                    <div className="message-content">
                      {msg.message}
                      {msg.type === 'location' && myLocation && (
                        <div className="location-share">
                          <small>
                            📍 {myLocation.coords.latitude.toFixed(4)}, 
                            {myLocation.coords.longitude.toFixed(4)}
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="chat-input">
              <input 
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage()
                  }
                }}
                placeholder="Type a message..."
              />
              <button 
                onClick={() => sendMessage('location')}
                className="share-location-btn"
                disabled={!myLocation}
              >
                📍
              </button>
              <button 
                onClick={() => sendMessage()}
                className="send-btn"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Avatar Upload Modal */}
      {showAvatarUpload && selectedMember && (
        <div className="modal-overlay" onClick={() => setShowAvatarUpload(false)}>
          <div className="avatar-modal" onClick={e => e.stopPropagation()}>
            <h2>📷 Add Profile Picture</h2>
            <p>Upload a photo for {familyMembers.find(m => m.id === selectedMember)?.name}</p>
            
            <div className="avatar-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="upload-btn"
              >
                📁 Choose Photo
              </button>
              
              <button 
                onClick={() => {
                  // Take photo with camera
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.capture = 'user'
                  input.onchange = (e) => handleAvatarUpload(e as any)
                  input.click()
                }}
                className="camera-btn"
              >
                📸 Take Photo
              </button>
            </div>
            
            <button 
              onClick={() => {
                if (selectedMember === '1') {
                  setSelectedMember('2')
                } else {
                  setShowAvatarUpload(false)
                  setSelectedMember(null)
                }
              }}
              className="skip-btn"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Quick Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <span>📍 {isTracking ? 'Sharing' : 'Not Sharing'}</span>
        </div>
        <div className="status-item">
          <span>👥 {familyMembers.filter(m => m.isSharing).length} Active</span>
        </div>
        <div className="status-item">
          <span>📍 {places.length} Places</span>
        </div>
        <div className="status-item">
          <span>💬 {chatMessages.length} Messages</span>
        </div>
      </div>
    </div>
  )
}