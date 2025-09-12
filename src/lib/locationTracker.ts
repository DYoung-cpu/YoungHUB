// Enhanced Location Tracking with Background Support
// import { supabase } from './supabase' // Commented until Supabase is configured

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  speed?: number | null
  heading?: number | null
  altitude?: number | null
  timestamp: string
  battery_level?: number
}

class LocationTracker {
  private watchId: number | null = null
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null
  private isTracking: boolean = false
  private lastUpdate: Date | null = null
  private updateInterval: number = 30000 // 30 seconds
  private highAccuracyMode: boolean = true

  constructor() {
    this.initServiceWorker()
    this.initBatteryMonitoring()
  }

  // Initialize service worker for background tracking
  private async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/service-worker.js')
        console.log('Service Worker registered for background tracking')
        
        // Request persistent storage
        if ('storage' in navigator && 'persist' in navigator.storage) {
          const isPersisted = await navigator.storage.persist()
          console.log(`Persistent storage ${isPersisted ? 'granted' : 'denied'}`)
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error)
      }
    }
  }

  // Monitor battery level to adjust tracking frequency
  private async initBatteryMonitoring() {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery()
        
        battery.addEventListener('levelchange', () => {
          // Reduce tracking frequency when battery is low
          if (battery.level < 0.2) {
            this.updateInterval = 120000 // 2 minutes
            this.highAccuracyMode = false
          } else if (battery.level < 0.5) {
            this.updateInterval = 60000 // 1 minute
          } else {
            this.updateInterval = 30000 // 30 seconds
            this.highAccuracyMode = true
          }
        })
      } catch (error) {
        console.log('Battery API not available')
      }
    }
  }

  // Start tracking location with smart updates
  async startTracking(email: string): Promise<boolean> {
    if (this.isTracking) return true

    // Request permission
    const permission = await this.requestLocationPermission()
    if (permission !== 'granted') {
      console.error('Location permission denied')
      return false
    }

    // Enable background sync if available
    if (this.serviceWorkerRegistration && 'sync' in this.serviceWorkerRegistration) {
      try {
        await (this.serviceWorkerRegistration as any).sync.register('location-update')
      } catch (error) {
        console.log('Background sync not available')
      }
    }

    // Smart tracking with movement detection
    let lastPosition: GeolocationPosition | null = null
    
    // Start foreground tracking
    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        // Determine if user is moving
        const speed = position.coords.speed || 0
        const isMoving = speed > 0.5 // meters per second (~1.1 mph)
        const isDriving = speed > 6.7 // 15 mph threshold
        
        // Smart update logic to save API calls
        if (lastPosition) {
          const distance = this.calculateDistance(
            lastPosition.coords.latitude,
            lastPosition.coords.longitude,
            position.coords.latitude,
            position.coords.longitude
          )
          
          const timeDiff = position.timestamp - lastPosition.timestamp
          
          // Update based on movement
          if (isDriving) {
            // Driving: update every 30 seconds
            if (timeDiff > 30000) {
              await this.updateLocation(email, position)
              lastPosition = position
            }
          } else if (isMoving) {
            // Walking: update every minute or 50 meters
            if (timeDiff > 60000 || distance > 50) {
              await this.updateLocation(email, position)
              lastPosition = position
            }
          } else {
            // Stationary: update every 5 minutes
            if (timeDiff > 300000) {
              await this.updateLocation(email, position)
              lastPosition = position
            }
          }
        } else {
          // First update
          await this.updateLocation(email, position)
          lastPosition = position
        }
      },
      (error) => {
        console.error('Location error:', error)
        this.handleLocationError(error)
      },
      {
        enableHighAccuracy: this.highAccuracyMode,
        timeout: 10000,
        maximumAge: 0
      }
    )

    // Enable periodic background sync if supported
    if ('periodicSync' in ServiceWorkerRegistration.prototype) {
      try {
        await (this.serviceWorkerRegistration as any).periodicSync.register('track-location', {
          minInterval: this.updateInterval
        })
      } catch (error) {
        console.log('Periodic background sync not available')
      }
    }

    // Send message to service worker to start tracking
    if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.active) {
      this.serviceWorkerRegistration.active.postMessage({ 
        type: 'START_TRACKING',
        email: email 
      })
    }

    this.isTracking = true
    return true
  }

  // Stop tracking
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }

    // Stop service worker tracking
    if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.active) {
      this.serviceWorkerRegistration.active.postMessage({ type: 'STOP_TRACKING' })
    }

    this.isTracking = false
  }

  // Update location in database
  private async updateLocation(_email: string, position: GeolocationPosition) {
    // Throttle updates
    const now = new Date()
    if (this.lastUpdate && (now.getTime() - this.lastUpdate.getTime()) < 5000) {
      return // Skip if last update was less than 5 seconds ago
    }

    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
      altitude: position.coords.altitude,
      timestamp: new Date(position.timestamp).toISOString()
    }

    try {
      // Get battery level if available
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery()
        locationData.battery_level = Math.round(battery.level * 100)
      }

      // Call Supabase function to update location (disabled until configured)
      // const { error } = await supabase.rpc('update_member_location', {
      //   p_email: email,
      //   p_latitude: locationData.latitude,
      //   p_longitude: locationData.longitude,
      //   p_accuracy: locationData.accuracy,
      //   p_speed: locationData.speed,
      //   p_battery: locationData.battery_level
      // })

      // if (error) throw error

      this.lastUpdate = now
      console.log('Location updated:', locationData)

      // Check geofences
      await this.checkGeofences(locationData)

    } catch (error) {
      console.error('Failed to update location:', error)
    }
  }

  // Check if user entered/left any geofenced areas
  private async checkGeofences(location: LocationData) {
    try {
      // Get all places from database (disabled until Supabase configured)
      // const { data: places, error } = await supabase
      //   .from('places')
      //   .select('*')
      //   .eq('notifications_enabled', true)

      // if (error) throw error

      const places: any[] = [] // Temporary empty array
      places?.forEach(place => {
        const distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          place.latitude,
          place.longitude
        )

        if (distance <= place.radius) {
          this.sendNotification(`Arrived at ${place.name}`, place.icon)
        }
      })
    } catch (error) {
      console.error('Geofence check failed:', error)
    }
  }

  // Calculate distance between two points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180
    const phi2 = lat2 * Math.PI / 180
    const deltaPhi = (lat2 - lat1) * Math.PI / 180
    const deltaLambda = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  // Send push notification
  private async sendNotification(message: string, icon: string = '=�') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Family Hub', {
        body: `${icon} ${message}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      })
    }
  }

  // Request location permission
  private async requestLocationPermission(): Promise<string> {
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      
      if (result.state === 'prompt') {
        // Request permission
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve('granted'),
            () => resolve('denied')
          )
        })
      }
      
      return result.state
    }
    
    // Fallback for browsers without Permissions API
    return 'granted'
  }

  // Handle location errors
  private handleLocationError(error: GeolocationPositionError) {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location permission denied')
        this.sendNotification('Location permission required for tracking', '�')
        break
      case error.POSITION_UNAVAILABLE:
        console.error('Location unavailable')
        break
      case error.TIMEOUT:
        console.error('Location request timeout')
        break
    }
  }

  // Get current status
  getStatus() {
    return {
      isTracking: this.isTracking,
      updateInterval: this.updateInterval,
      highAccuracyMode: this.highAccuracyMode,
      hasServiceWorker: this.serviceWorkerRegistration !== null
    }
  }
}

// Export singleton instance
export const locationTracker = new LocationTracker()