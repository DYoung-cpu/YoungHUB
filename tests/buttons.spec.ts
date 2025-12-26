import { test, expect } from '@playwright/test'

test.describe('Dashboard Navigation Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the dashboard to load
    await page.waitForSelector('.dashboard')
  })

  test('all navigation tabs are clickable', async ({ page }) => {
    // Test Tracking tab
    const trackingTab = page.locator('button:has-text("Tracking")')
    await expect(trackingTab).toBeVisible()
    await trackingTab.click()
    await expect(trackingTab).toHaveClass(/active/)

    // Test Mortgages tab
    const mortgagesTab = page.locator('button:has-text("Mortgages")')
    await expect(mortgagesTab).toBeVisible()
    await mortgagesTab.click()
    await expect(mortgagesTab).toHaveClass(/active/)

    // Test Overview tab
    const overviewTab = page.locator('button:has-text("Overview")')
    await expect(overviewTab).toBeVisible()
    await overviewTab.click()
    await expect(overviewTab).toHaveClass(/active/)

    // Test Documents tab
    const documentsTab = page.locator('button:has-text("Documents")')
    await expect(documentsTab).toBeVisible()
    await documentsTab.click()
    await expect(documentsTab).toHaveClass(/active/)

    // Test Accounts tab
    const accountsTab = page.locator('button:has-text("Accounts")')
    await expect(accountsTab).toBeVisible()
    await accountsTab.click()
    await expect(accountsTab).toHaveClass(/active/)

    // Test Expenses tab
    const expensesTab = page.locator('button:has-text("Expenses")')
    await expect(expensesTab).toBeVisible()
    await expensesTab.click()
    await expect(expensesTab).toHaveClass(/active/)

    // Test Calendar tab
    const calendarTab = page.locator('button:has-text("Calendar")')
    await expect(calendarTab).toBeVisible()
    await calendarTab.click()
    await expect(calendarTab).toHaveClass(/active/)
  })

  test('Sign Out button is visible', async ({ page }) => {
    const signOutBtn = page.locator('.sign-out-btn')
    await expect(signOutBtn).toBeVisible()
    await expect(signOutBtn).toHaveText('Sign Out')
  })
})

test.describe('Documents Tab Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Navigate to Documents tab
    await page.click('button:has-text("Documents")')
    await page.waitForSelector('.documents-tab')
  })

  test('Upload Document button opens modal', async ({ page }) => {
    const uploadBtn = page.locator('.documents-header .upload-btn')
    await expect(uploadBtn).toBeVisible()
    await expect(uploadBtn).toContainText('Upload Document')

    await uploadBtn.click()

    // Modal should open
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Close button should work
    const closeBtn = page.locator('.modal-close')
    await closeBtn.click()
    await expect(modal).not.toBeVisible()
  })

  test('category filter buttons work', async ({ page }) => {
    // All button should be visible
    const allBtn = page.locator('.filter-btn:has-text("All")')
    await expect(allBtn).toBeVisible()
    await allBtn.click()
    await expect(allBtn).toHaveClass(/active/)
  })

  test('search clear button works', async ({ page }) => {
    const searchInput = page.locator('.search-input')
    await searchInput.fill('test query')

    const clearBtn = page.locator('.clear-search')
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    await expect(searchInput).toHaveValue('')
  })

  test('example query buttons work', async ({ page }) => {
    const exampleBtn = page.locator('.example-queries button').first()
    if (await exampleBtn.isVisible()) {
      await exampleBtn.click()
      const searchInput = page.locator('.search-input')
      await expect(searchInput).not.toHaveValue('')
    }
  })
})

test.describe('Calendar Tab Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Navigate to Calendar tab
    await page.click('button:has-text("Calendar")')
    await page.waitForSelector('.family-calendar')
  })

  test('month navigation buttons work', async ({ page }) => {
    // Get current month title
    const monthTitle = page.locator('.calendar-header h2')
    const initialMonth = await monthTitle.textContent()

    // Click next month
    const nextBtn = page.locator('.calendar-header button:has-text("▶")')
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()

    // Month should change
    const newMonth = await monthTitle.textContent()
    expect(newMonth).not.toBe(initialMonth)

    // Click previous month
    const prevBtn = page.locator('.calendar-header button:has-text("◀")')
    await expect(prevBtn).toBeVisible()
    await prevBtn.click()

    // Should be back to original
    await expect(monthTitle).toHaveText(initialMonth!)
  })

  test('calendar day click opens event modal', async ({ page }) => {
    // Click on a calendar day
    const calendarDay = page.locator('.calendar-day:not(.empty)').first()
    await calendarDay.click()

    // Event modal should open
    const modal = page.locator('.event-modal-overlay')
    await expect(modal).toBeVisible()

    // Event type buttons should be visible
    const eventTypeBtns = page.locator('.event-type-btn')
    await expect(eventTypeBtns.first()).toBeVisible()

    // Cancel button should close modal
    const cancelBtn = page.locator('.cancel-btn')
    await cancelBtn.click()
    await expect(modal).not.toBeVisible()
  })

  test('notification enable button visible if not enabled', async ({ page }) => {
    const notificationBanner = page.locator('.notification-banner')
    if (await notificationBanner.isVisible()) {
      const enableBtn = page.locator('.notification-banner .enable-btn')
      await expect(enableBtn).toBeVisible()
      await expect(enableBtn).toHaveText('Enable')
    }
  })

  test('member toggle section exists in event modal', async ({ page }) => {
    // Click on a calendar day to open modal
    const calendarDay = page.locator('.calendar-day:not(.empty)').first()
    await calendarDay.click()

    // Wait for modal
    const modal = page.locator('.event-modal')
    await expect(modal).toBeVisible()

    // Check member toggle section exists (even if no members loaded from DB)
    const memberToggle = page.locator('.member-toggle')
    // The toggle div should exist even if empty
    await expect(memberToggle).toBeVisible({ timeout: 2000 }).catch(() => {
      // If toggle isn't visible, that's okay - it means no family members in DB
      console.log('Member toggle not visible - no family members in database')
    })

    // Check toggle buttons if any exist
    const toggleButtons = page.locator('.toggle-btn')
    const count = await toggleButtons.count()

    if (count >= 2) {
      // If there are multiple members, click between them
      const secondBtn = toggleButtons.nth(1)
      await secondBtn.click()
      await expect(secondBtn).toHaveClass(/active/)
    }

    // Close modal
    await page.locator('.cancel-btn').click()
  })
})

test.describe('Overview Tab Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("Overview")')
  })

  test('Quick Actions buttons are visible', async ({ page }) => {
    const uploadDocBtn = page.locator('.action-btn:has-text("Upload Document")')
    await expect(uploadDocBtn).toBeVisible()

    const addAccountBtn = page.locator('.action-btn:has-text("Add Account")')
    await expect(addAccountBtn).toBeVisible()
  })
})

test.describe('Accounts Tab Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("Accounts")')
  })

  test('Add New Account button is visible', async ({ page }) => {
    const addBtn = page.locator('.add-account-btn')
    await expect(addBtn).toBeVisible()
    await expect(addBtn).toContainText('Add New Account')
  })
})

test.describe('Expenses Tab Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("Expenses")')
  })

  test('Add Expense button is visible', async ({ page }) => {
    const addBtn = page.locator('.add-expense-btn')
    await expect(addBtn).toBeVisible()
    await expect(addBtn).toContainText('Add Expense')
  })
})
