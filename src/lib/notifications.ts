// Notification utilities for Family Vault

export interface CalendarNotificationData {
  memberName: string
  eventType: string
  dates: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser')
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission
  }

  return Notification.permission
}

/**
 * Check if notifications are supported and enabled
 */
export function canSendNotifications(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}

/**
 * Send a calendar update notification via service worker
 */
export async function sendCalendarNotification(data: CalendarNotificationData): Promise<void> {
  if (!canSendNotifications()) {
    console.log('Notifications not enabled, skipping')
    return
  }

  // Try to send via service worker for better reliability
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CALENDAR_UPDATE',
      ...data
    })
  } else {
    // Fallback to direct notification
    showDirectNotification(data)
  }
}

/**
 * Show notification directly (fallback when no service worker)
 */
function showDirectNotification(data: CalendarNotificationData): void {
  const eventIcons: Record<string, string> = {
    office: '🏢',
    wfh: '🏠',
    vacation: '🏖️',
    appointment: '📅',
    bill_due: '💰'
  }

  const icon = eventIcons[data.eventType] || '📅'
  const actionText = data.action === 'INSERT' ? 'added' : 'updated'

  new Notification('Family Calendar Updated', {
    body: `${data.memberName} ${actionText}: ${icon} ${data.eventType} on ${data.dates}`,
    icon: '/icon-192.png',
    tag: 'calendar-update'
  })
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js')
    console.log('Service Worker registered:', registration.scope)
    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    return null
  }
}

/**
 * Initialize notifications - request permission and register service worker
 */
export async function initializeNotifications(): Promise<boolean> {
  const permission = await requestNotificationPermission()

  if (permission !== 'granted') {
    console.log('Notification permission not granted')
    return false
  }

  await registerServiceWorker()
  return true
}

// ============================================
// PUSH SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Get VAPID public key from server
 */
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const response = await fetch('/api/notifications/subscribe')
    if (!response.ok) return null
    const data = await response.json()
    return data.vapidPublicKey
  } catch (error) {
    console.error('Failed to get VAPID key:', error)
    return null
  }
}

/**
 * Convert URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(familyMemberId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported')
    return false
  }

  try {
    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey()
    if (!vapidPublicKey) {
      console.error('VAPID public key not available')
      return false
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    })

    // Send subscription to server
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyMemberId,
        subscription: subscription.toJSON(),
        deviceName: getDeviceName(),
        userAgent: navigator.userAgent
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save subscription')
    }

    console.log('Push subscription successful')
    return true
  } catch (error) {
    console.error('Push subscription failed:', error)
    return false
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      return true // Already unsubscribed
    }

    // Unsubscribe from browser
    await subscription.unsubscribe()

    // Notify server
    await fetch('/api/notifications/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint
      })
    })

    console.log('Push unsubscription successful')
    return true
  } catch (error) {
    console.error('Push unsubscription failed:', error)
    return false
  }
}

/**
 * Check if user is subscribed to push notifications
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch (error) {
    return false
  }
}

/**
 * Get a friendly device name
 */
function getDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android Device'
  if (/Windows/i.test(ua)) return 'Windows PC'
  if (/Mac/i.test(ua)) return 'Mac'
  return 'Unknown Device'
}

/**
 * Initialize push notifications for a family member
 */
export async function initializePushNotifications(familyMemberId: string): Promise<boolean> {
  // First, ensure basic notification permission
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    return false
  }

  // Register service worker if not already
  await registerServiceWorker()

  // Subscribe to push
  return subscribeToPush(familyMemberId)
}
