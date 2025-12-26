import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { initializeNotifications, sendCalendarNotification, canSendNotifications } from '../../lib/notifications'

interface CalendarEvent {
  id: string
  family_member_id: string
  title: string
  event_type: string
  event_date: string
  location?: string
  notes?: string
  color: string
}

interface FamilyMember {
  id: string
  name: string
  email: string
}

const EVENT_TYPES = [
  { value: 'office', label: 'Office', icon: '🏢', color: '#3b82f6' },
  { value: 'wfh', label: 'Work from Home', icon: '🏠', color: '#10b981' },
  { value: 'vacation', label: 'Vacation', icon: '🏖️', color: '#f59e0b' },
  { value: 'appointment', label: 'Appointment', icon: '📅', color: '#8b5cf6' },
  { value: 'bill_due', label: 'Bill Due', icon: '💰', color: '#ef4444' },
]

export default function FamilyCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [_selectedEventType, _setSelectedEventType] = useState<string | null>(null)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null)
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [_isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(canSendNotifications())

  // Initialize notifications on mount
  useEffect(() => {
    initializeNotifications().then(enabled => {
      setNotificationsEnabled(enabled)
    })
  }, [])

  const handleEnableNotifications = async () => {
    const enabled = await initializeNotifications()
    setNotificationsEnabled(enabled)
  }

  // Fetch data on mount
  useEffect(() => {
    fetchFamilyMembers()
    fetchEvents()
    const unsubscribe = setupRealtimeSubscription()
    return unsubscribe
  }, [currentMonth])

  const fetchFamilyMembers = async () => {
    const { data } = await supabase.from('family_members').select('*')
    if (data && data.length > 0) {
      setFamilyMembers(data)
      // For now, assume first user (David) - in real app would use auth
      setCurrentUser(data[0] || null)
      setSelectedMember(data[0] || null)
    } else {
      // Create default family members if none exist
      const defaultMembers = [
        { name: 'David', email: 'david@family.com' },
        { name: 'Lisa', email: 'lisa@family.com' }
      ]
      const { data: newMembers } = await supabase
        .from('family_members')
        .insert(defaultMembers)
        .select()

      if (newMembers && newMembers.length > 0) {
        setFamilyMembers(newMembers)
        setCurrentUser(newMembers[0])
        setSelectedMember(newMembers[0])
      }
    }
  }

  const fetchEvents = async () => {
    setIsLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', start)
      .lte('event_date', end)

    if (!error && data) {
      setEvents(data)
    }
    setIsLoading(false)
  }

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('calendar_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        (payload) => {
          console.log('Calendar update:', payload)
          fetchEvents()

          // Show push notification for other user's updates
          if (payload.new && 'family_member_id' in payload.new) {
            const event = payload.new as CalendarEvent
            if (event.family_member_id !== currentUser?.id) {
              showNotification(event, payload.eventType)
            }
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const showNotification = async (event: CalendarEvent, action: string) => {
    const member = familyMembers.find(m => m.id === event.family_member_id)
    const formattedDate = format(new Date(event.event_date), 'EEE, MMM d')

    sendCalendarNotification({
      memberName: member?.name || 'Someone',
      eventType: event.event_type,
      dates: formattedDate,
      action: action as 'INSERT' | 'UPDATE' | 'DELETE'
    })
  }

  // Quick-tap to add event
  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setShowEventModal(true)
  }

  const handleQuickAdd = async (eventType: string) => {
    if (!selectedDate || !selectedMember) {
      console.error('Missing selectedDate or selectedMember', { selectedDate, selectedMember })
      alert('Please select a family member first')
      return
    }

    const eventConfig = EVENT_TYPES.find(t => t.value === eventType)
    if (!eventConfig) return

    setIsAdding(true)

    const { error } = await supabase.from('calendar_events').insert({
      family_member_id: selectedMember.id,
      title: eventConfig.label,
      event_type: eventType,
      event_date: format(selectedDate, 'yyyy-MM-dd'),
      color: eventConfig.color,
    })

    setIsAdding(false)

    if (error) {
      console.error('Failed to add event:', error)
      alert('Failed to add event: ' + error.message)
    } else {
      setShowEventModal(false)
      setSelectedDate(null)
      fetchEvents()
    }
  }

  const handleRemoveEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)

    if (!error) {
      fetchEvents()
    }
  }

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.filter(e => e.event_date === dateStr)
  }

  const getMemberName = (memberId: string): string => {
    return familyMembers.find(m => m.id === memberId)?.name || 'Unknown'
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad start of month to align with weekday
  const startPadding = monthStart.getDay()
  const paddedDays = [...Array(startPadding).fill(null), ...calendarDays]

  return (
    <div className="family-calendar">
      {/* Header */}
      <div className="calendar-header">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          ◀
        </button>
        <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          ▶
        </button>
      </div>

      {/* Notification Banner */}
      {!notificationsEnabled && (
        <div className="notification-banner">
          <span>🔔 Enable notifications to get alerts when family members update the calendar</span>
          <button onClick={handleEnableNotifications} className="enable-btn">
            Enable
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="calendar-legend">
        {familyMembers.map(member => (
          <span key={member.id} className="legend-item">
            <span className="legend-dot" style={{
              backgroundColor: member.name === 'David' ? '#3b82f6' : '#ec4899'
            }} />
            {member.name}
          </span>
        ))}
      </div>

      {/* Weekday Headers */}
      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {paddedDays.map((day, index) => {
          if (!day) {
            return <div key={`pad-${index}`} className="calendar-day empty" />
          }

          const dayEvents = getEventsForDate(day)
          const isToday = isSameDay(day, new Date())
          const isCurrentMonth = isSameMonth(day, currentMonth)

          return (
            <div
              key={day.toISOString()}
              className={`calendar-day ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
              onClick={() => handleDateClick(day)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              <div className="day-events">
                {dayEvents.map(event => {
                  const eventType = EVENT_TYPES.find(t => t.value === event.event_type)
                  return (
                    <div
                      key={event.id}
                      className="event-chip"
                      style={{ backgroundColor: event.color }}
                      title={`${getMemberName(event.family_member_id)}: ${event.title}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Remove this event?')) {
                          handleRemoveEvent(event.id)
                        }
                      }}
                    >
                      {eventType?.icon}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Add Modal */}
      {showEventModal && selectedDate && (
        <div className="event-modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="event-modal" onClick={e => e.stopPropagation()}>
            <h3>Add Event for {format(selectedDate, 'EEEE, MMM d')}</h3>

            {/* Family Member Toggle */}
            <div className="member-toggle">
              <span className="toggle-label">Adding for:</span>
              <div className="toggle-buttons">
                {familyMembers.map(member => (
                  <button
                    key={member.id}
                    className={`toggle-btn ${selectedMember?.id === member.id ? 'active' : ''}`}
                    onClick={() => setSelectedMember(member)}
                    style={{
                      backgroundColor: selectedMember?.id === member.id
                        ? (member.name === 'David' ? '#3b82f6' : '#ec4899')
                        : 'transparent',
                      borderColor: member.name === 'David' ? '#3b82f6' : '#ec4899',
                      color: selectedMember?.id === member.id ? 'white' : (member.name === 'David' ? '#3b82f6' : '#ec4899')
                    }}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            </div>

            <p className="modal-subtitle">Tap to add:</p>
            <div className="event-type-grid">
              {EVENT_TYPES.map(type => (
                <button
                  key={type.value}
                  className="event-type-btn"
                  style={{ backgroundColor: type.color }}
                  onClick={() => handleQuickAdd(type.value)}
                  disabled={isAdding || !selectedMember}
                >
                  <span className="type-icon">{type.icon}</span>
                  <span className="type-label">{type.label}</span>
                </button>
              ))}
            </div>
            <button
              className="cancel-btn"
              onClick={() => setShowEventModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      <div className="upcoming-events">
        <h3>This Month's Schedule</h3>
        {events.length === 0 ? (
          <p className="no-events">No events scheduled</p>
        ) : (
          <div className="events-list">
            {events
              .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
              .map(event => {
                const eventType = EVENT_TYPES.find(t => t.value === event.event_type)
                return (
                  <div key={event.id} className="event-item">
                    <span
                      className="event-indicator"
                      style={{ backgroundColor: event.color }}
                    />
                    <span className="event-date">
                      {format(new Date(event.event_date), 'EEE, MMM d')}
                    </span>
                    <span className="event-icon">{eventType?.icon}</span>
                    <span className="event-title">
                      {getMemberName(event.family_member_id)}: {event.title}
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
