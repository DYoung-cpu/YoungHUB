import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import { formatDistanceToNow } from 'date-fns'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import 'leaflet/dist/leaflet.css'

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
  is_sharing: boolean
  avatar?: string
}

interface Place {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  radius: number
  icon: string
  notifications_enabled: boolean
}

interface ChatMessage {
  id: string
  sender_name: string
  message: string
  timestamp: Date
  message_type: 'text' | 'location' | 'sos'
  latitude?: number
  longitude?: number
}

interface Props {
  session: Session
}

export default function FamilyTrackingRealtime({ session }: Props) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [myLocation, setMyLocation] = useState<GeolocationPosition | null>(null)
  const [selectedView, setSelectedView] = useState<'map' | 'list' | 'chat' | 'places'>('map')
  const [isTracking, setIsTracking] = useState(false)
  const [showAddPlace, setShowAddPlace] = useState(false)
  const [showSOS, setShowSOS] = useState(false)
  const [loading, setLoading] = useState(true)
  const watchId = useRef<number | null>(null)
  const locationUpdateInterval = useRef<NodeJS.Timeout | null>(null)

  // Load family members from Supabase
  const loadFamilyMembers = async () => {
    const { data: members, error } = await supabase
      .from('family_members')
      .select('*')
    
    if (!error && members) {
      const { data: locations } = await supabase
        .from('locations')
        .select('*')
      
      const membersWithLocations = members.map(member => {
        const location = locations?.find(l => l.member_id === member.id)
        return {
          id: member.id,
          name: member.name,
          email: member.email,
          status: member.status,
          is_sharing: member.is_sharing,
          avatar: member.avatar_url,
          location: location ? {
            lat: parseFloat(location.latitude),
            lng: parseFloat(location.longitude),
            accuracy: location.accuracy || 0,
            timestamp: new Date(location.timestamp),
            battery: location.battery_level,
            speed: location.speed
          } : undefined
        }
      })
      
      setFamilyMembers(membersWithLocations)
    }
  }

  // Load places from Supabase
  const loadPlaces = async () => {
    const { data, error } = await supabase
      .from('places')
      .select('*')
    
    if (!error && data) {
      setPlaces(data.map(place => ({
        id: place.id,
        name: place.name,
        address: place.address || '',
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        radius: place.radius,
        icon: place.icon,
        notifications_enabled: place.notifications_enabled
      })))
    }
  }

  // Load chat messages from Supabase
  const loadChatMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(50)
    
    if (!error && data) {
      setChatMessages(data.map(msg => ({
        id: msg.id,
        sender_name: msg.sender_name,
        message: msg.message,
        timestamp: new Date(msg.timestamp),
        message_type: msg.message_type,
        latitude: msg.latitude,
        longitude: msg.longitude
      })))
    }
  }

  // Set up real-time subscriptions
  useEffect(() => {
    loadFamilyMembers()
    loadPlaces()
    loadChatMessages()

    // Subscribe to location updates
    const locationSubscription = supabase
      .channel('location-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'locations' },
        () => {
          loadFamilyMembers()
        }
      )
      .subscribe()

    // Subscribe to chat messages
    const chatSubscription = supabase
      .channel('chat-messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as any
          setChatMessages(prev => [...prev, {
            id: newMsg.id,
            sender_name: newMsg.sender_name,
            message: newMsg.message,
            timestamp: new Date(newMsg.timestamp),
            message_type: newMsg.message_type,
            latitude: newMsg.latitude,
            longitude: newMsg.longitude
          }])
        }
      )
      .subscribe()

    // Subscribe to places updates
    const placesSubscription = supabase
      .channel('places-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'places' },
        () => {
          loadPlaces()
        }
      )
      .subscribe()

    setLoading(false)

    return () => {
      supabase.removeChannel(locationSubscription)
      supabase.removeChannel(chatSubscription)
      supabase.removeChannel(placesSubscription)
    }
  }, [])

  // Start location tracking
  const startTracking = () => {
    if ('geolocation' in navigator) {
      setIsTracking(true)
      
      // Get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMyLocation(position)
          updateMyLocationInDB(position)
        },
        (error) => {
          console.error('Location error:', error)
          alert('Please enable location services')
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )

      // Watch position for updates
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          setMyLocation(position)
          checkGeofences(position)
        },
        (error) => console.error('Watch error:', error),
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )

      // Update location in database every 30 seconds
      locationUpdateInterval.current = setInterval(() => {
        if (myLocation) {
          updateMyLocationInDB(myLocation)
        }
      }, 30000)
    } else {
      alert('Geolocation is not supported by your browser')
    }
  }

  // Stop location tracking
  const stopTracking = async () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    
    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current)
      locationUpdateInterval.current = null
    }

    // Update sharing status in database
    const { data: member } = await supabase
      .from('family_members')
      .select('id')
      .eq('email', session.user.email)
      .single()
    
    if (member) {
      await supabase
        .from('family_members')
        .update({ is_sharing: false })
        .eq('id', member.id)
    }

    setIsTracking(false)
  }

  // Update location in database
  const updateMyLocationInDB = async (position: GeolocationPosition) => {
    const { error } = await supabase.rpc('update_member_location', {
      p_email: session.user.email,
      p_latitude: position.coords.latitude,
      p_longitude: position.coords.longitude,
      p_accuracy: position.coords.accuracy,
      p_speed: position.coords.speed,
      p_battery: null // Would need Battery API
    })

    if (error) {
      console.error('Error updating location:', error)
    }
  }

  // Check if entered/left any geofenced places
  const checkGeofences = (position: GeolocationPosition) => {
    places.forEach(place => {
      if (place.notifications_enabled) {
        const distance = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          place.lat,
          place.lng
        )
        
        if (distance <= place.radius) {
          showNotification(`Arrived at ${place.name}`)
        }
      }
    })
  }

  // Calculate distance between two coordinates (in meters)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3
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
  const sendMessage = async (type: 'text' | 'location' | 'sos' = 'text') => {
    if (newMessage.trim() || type !== 'text') {
      const userName = session.user.email?.split('@')[0] || 'Unknown'
      
      const messageData = {
        sender_name: userName,
        message: type === 'sos' ? '🆘 EMERGENCY - NEED HELP!' : 
                 type === 'location' ? `📍 Shared location` : 
                 newMessage,
        message_type: type,
        latitude: type === 'location' && myLocation ? myLocation.coords.latitude : null,
        longitude: type === 'location' && myLocation ? myLocation.coords.longitude : null
      }

      const { error } = await supabase
        .from('chat_messages')
        .insert([messageData])

      if (!error) {
        setNewMessage('')
        if (type === 'sos') {
          setShowSOS(false)
          // Send notification to all family members
          showNotification(`🆘 ${userName} sent an SOS!`)
        }
      }
    }
  }

  // Add new place
  const addPlace = async (name: string, address: string) => {
    if (myLocation) {
      const { data: member } = await supabase
        .from('family_members')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (member) {
        const { error } = await supabase
          .from('places')
          .insert([{
            name,
            address: address || 'Current location',
            latitude: myLocation.coords.latitude,
            longitude: myLocation.coords.longitude,
            radius: 100,
            icon: name === 'Work' ? '🏢' : name === 'School' ? '🏫' : '📍',
            notifications_enabled: true,
            created_by: member.id
          }])

        if (!error) {
          setShowAddPlace(false)
          loadPlaces()
        }
      }
    }
  }

  // Delete place
  const deletePlace = async (placeId: string) => {
    const { error } = await supabase
      .from('places')
      .delete()
      .eq('id', placeId)

    if (!error) {
      loadPlaces()
    }
  }

  // Toggle place notifications
  const togglePlaceNotifications = async (placeId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('places')
      .update({ notifications_enabled: enabled })
      .eq('id', placeId)

    if (!error) {
      loadPlaces()
    }
  }

  // Get center coordinates for map
  const getMapCenter = (): [number, number] => {
    if (myLocation) {
      return [myLocation.coords.latitude, myLocation.coords.longitude]
    }
    const memberWithLocation = familyMembers.find(m => m.location)
    if (memberWithLocation?.location) {
      return [memberWithLocation.location.lat, memberWithLocation.location.lng]
    }
    return [34.0549, -118.4426]
  }

  if (loading) {
    return <div className="loading">Loading family tracking...</div>
  }

  return (
    <div className="family-tracking-container">
      <div className="tracking-header">
        <h2>👨‍👩‍👧 Family Tracking</h2>
        <div className="tracking-controls">
          {!isTracking ? (
            <button onClick={startTracking} className="start-tracking-btn">
              📍 Start Sharing Location
            </button>
          ) : (
            <button onClick={stopTracking} className="stop-tracking-btn">
              ⏹️ Stop Sharing
            </button>
          )}
          <button onClick={() => setShowSOS(true)} className="sos-btn">
            🆘 SOS
          </button>
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
          💬 Chat ({chatMessages.length})
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
              
              {/* Family member markers */}
              {familyMembers.map(member => {
                if (member.location && member.is_sharing) {
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
                          {member.location.speed && member.location.speed > 0 && (
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
            {familyMembers.map(member => (
              <div key={member.id} className="family-member-card">
                <div className="member-header">
                  <div className="member-avatar">
                    {member.name[0]}
                  </div>
                  <div className="member-info">
                    <h3>{member.name}</h3>
                    <p className="member-status">{member.status || 'No status'}</p>
                  </div>
                  <div className="member-sharing">
                    {member.is_sharing ? (
                      <span className="sharing-active">📍 Sharing</span>
                    ) : (
                      <span className="sharing-inactive">📍 Not sharing</span>
                    )}
                  </div>
                </div>
                
                {member.location && member.is_sharing && (
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedView === 'places' && (
          <div className="places-view">
            <div className="places-header">
              <h3>Saved Places</h3>
              <button 
                onClick={() => setShowAddPlace(true)}
                className="add-place-btn"
                disabled={!myLocation}
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
                      className={`notification-toggle ${place.notifications_enabled ? 'active' : ''}`}
                      onClick={() => togglePlaceNotifications(place.id, !place.notifications_enabled)}
                    >
                      {place.notifications_enabled ? '🔔' : '🔕'}
                    </button>
                    <button 
                      className="delete-place-btn"
                      onClick={() => deletePlace(place.id)}
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
                    className={`chat-message ${msg.message_type === 'sos' ? 'sos-message' : ''}`}
                  >
                    <div className="message-header">
                      <strong>{msg.sender_name}</strong>
                      <small>{formatDistanceToNow(msg.timestamp)} ago</small>
                    </div>
                    <div className="message-content">
                      {msg.message}
                      {msg.message_type === 'location' && msg.latitude && msg.longitude && (
                        <div className="location-share">
                          <small>
                            📍 {msg.latitude.toFixed(4)}, {msg.longitude.toFixed(4)}
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

      {/* SOS Modal */}
      {showSOS && (
        <div className="modal-overlay" onClick={() => setShowSOS(false)}>
          <div className="sos-modal" onClick={e => e.stopPropagation()}>
            <h2>🆘 Send Emergency Alert?</h2>
            <p>This will immediately notify all family members of your location and that you need help.</p>
            <div className="sos-actions">
              <button 
                onClick={() => sendMessage('sos')}
                className="confirm-sos"
              >
                Send SOS
              </button>
              <button 
                onClick={() => setShowSOS(false)}
                className="cancel-sos"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <span>📍 {isTracking ? 'Sharing' : 'Not Sharing'}</span>
        </div>
        <div className="status-item">
          <span>👥 {familyMembers.filter(m => m.is_sharing).length} Active</span>
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