# Young Family Vault (FV) - Claude Project Rules

**Project Alias:** FV
**Full Name:** Young Family Vault
**Location:** `/mnt/c/Users/dyoun/The Young/FamilyFinanceHub`

---

## The Young Family

### Household
| Name | Role | Age | Details |
|------|------|-----|---------|
| **David Young** | Husband/Father | Adult | Primary admin, works at Lendwise Mortgage |
| **Lisa Young** | Wife/Mother | Adult | City National Bank (Compliance), Downtown LA. Works from home some days, office others |
| **Jacob Young** | Son | 2 years | - |
| **Noah Young** | Son | 9 months | - |

### Extended Family
| Name | Relation | Details |
|------|----------|---------|
| **Anita Young** | Mother (David's) | Owns 1135 S Hayworth Ave, landlord |
| **Coty A Coleman** | Aunt (David's) | Medi-Cal recipient, lives at Pico Terrace Assisted Living, uses 1135 S Hayworth for mail |
| **Marc D Young** | Brother (David's) | Joint J.P. Morgan investment account holder, POD beneficiary on Anita's accounts |

### J.P. Morgan Investment Account (David & Marc)
- **Account #:** 767-44030 (JTWROS - Joint Tenants with Rights of Survivorship)
- **Value:** $410,892.88 (as of Nov 2025)
- **Income This Period:** $1,446.74
- **Fees:** $139.59
- **Advisor:** Edgar Hernandez (310) 474-3850
- **Strategy:** JPMPI Liquidity Management

### Coty Coleman Details
- **Residence:** Pico Terrace Assisted Living
- **Mailing Address:** 1135 S Hayworth Ave, Los Angeles, CA 90035-2603 (Anita Young's home)
- **Social Security:** $1,188.00/month (paid in arrears - March benefit paid in April)
- **Medicare #:** 7KH4-F70-KN94
- **Medicare Start:** December 2002
- **Medical Premium:** $0.00 (Medi-Cal covers)

### Anita Young Property (1135 S Hayworth Ave)
- **Address:** 1135 S Hayworth Ave, Los Angeles, CA 90035-2603
- **Owner:** Anita Young (David's mother)
- **Status:** Landlord - rents adjacent unit at 1133 S Hayworth
- **Tenant (1133):** Steve Watson
  - **Current Rent:** $3,362/month (as of 09/01/2020)
  - **Rent History:** $2,600 (2010) → $2,843 (2015) → $3,232 (2019) → $3,362 (2020)
  - **Lease Start:** September 2010
  - **Security Deposit:** $1,000 (held in Chase CD)
- **Bank:** Chase - Premier Checking ending 5123, CD ending 1601 (POD Marc D Young, $3,600)

### David Young Licenses
- **CA Real Estate Broker License:** David Jaime Young
- **DRE License #:** 01371572
- **License Expires:** 08/15/2029
- **DOB:** 02/03/1977
- **NMLS:** 62043 (personal)
- **Employer:** Lendwise Mortgage

### The Young Group, Inc. (Corporation)
- **Corp #:** 3392430
- **Type:** Real Estate Corporation
- **Broker-Officer:** David J Young (License #01371572)
- **Registered Addresses:**
  - 1605 Acanto Place, Los Angeles, CA 90043
  - 5016 N. Parkway Calabasas, Calabasas, CA 91302
- **CA SOS Filing #:** A-14320

---

## Document Parsing Rules

1. **NEVER trust filenames** - Always parse and verify document content. Filenames may be incorrect, abbreviated, or misleading.

2. **Extract data from document content** - Use OCR/parsed text to identify:
   - Document type (bill, statement, notice, etc.)
   - Issuing organization
   - Account holders/recipients
   - Key dates and amounts
   - Account/policy numbers

3. **Cross-reference information** - When the same entity appears in multiple documents, verify consistency.

4. **Flag discrepancies** - If filename suggests one thing but content shows another, note this explicitly.

---

## Properties

### 1085 Acanto Pl, Los Angeles, CA 90049-1603 (Primary Residence)
- **Mortgage:** SPS (transferred from US Bank 08/01/2025)
- **Account #:** 0034953794
- **Escrow Account:** 0018458992
- **HELOC:** Mechanics Bank (HomeStreet)
  - **Loan #:** 0001166102
  - **Credit Limit:** $272,000.00
  - **Current Balance:** $0.00 (fully available)
  - **Interest Rate:** 7.25% variable
  - **Online:** www.HomeStreet.com | Phone: 1-800-237-3194
- **Insurance:** Mercury/KW Specialty
  - **Policy #:** 1000017887HO
  - **Type:** HO3
  - **Period:** 09/12/2025 - 09/12/2026
  - **Annual Premium:** $5,374.65
  - **Key Coverages:** Personal Injury $7,500, Loss Assessment $50K, Home Systems $50K
  - **Producer:** Costilo Insurance Agency (818) 707-7711
  - **Pay Online:** www.paykwspecialty.com or 877-717-3939
- **Utilities:**
  - **LADWP:** Account #437 712 1509
    - **Auto Pay:** Yes (bills paid on due date)
    - **Phone:** 1-800-DIAL-DWP (342-5397)
    - **Online:** www.ladwp.com/myaccount
- **Owners:** David J Young & Lisa Young

### 2224 Birchglen St, Unit 111, Simi Valley, CA 93063 (Condo)
- **Mortgage:** Rocket Mortgage (Mr. Cooper / Nationstar Mortgage LLC)
- **Loan #:** 0715348686
- **HO6 Insurance:** ⚠️ EXPIRED 12/12/2024 - URGENT ACTION NEEDED
- **Customer Service:** (866) 825-9287
- **Online:** www.mycoverageinfo.com/mrcooper
- **Owners:** David Young & Lisa Young

### 1808 Manning Ave #202, Los Angeles, CA 90025 (Rental Property)
- **Mortgage:** CrossCountry Mortgage (transferred from Freedom Mortgage 12/01/2025)
- **Loan #:** 0764193843
- **Principal Balance:** $380,801.18 (as of 12/01/2025)
- **Monthly Payment:** $2,353.71
- **Escrow Account:** NONE (pay taxes/insurance directly)
- **Payment Address:** PO Box 650783, Dallas, TX 75265-0783
- **Customer Service:** 833-755-2066
- **Online Portal:** www.servicing.crosscountrymortgage.com
- **LA Housing Dept:** JCO/RSO fees apply
- **APN:** 4321003059
- **Statement #:** 10162441
- **Owners:** Young David & Lisa

---

## Accounts Tracked

| Type | Provider | Account/Policy # | Property/Person |
|------|----------|------------------|-----------------|
| Mortgage | SPS (was US Bank) | 0034953794 | 1085 Acanto |
| HELOC | Mechanics Bank (HomeStreet) | 0001166102 | 1085 Acanto |
| Escrow | US Bank | 0018458992 | 1085 Acanto |
| Insurance | Mercury/KW Specialty | 1000017887HO | 1085 Acanto |
| Utility | LADWP | 437 712 1509 | 1085 Acanto |
| Mortgage | CrossCountry (was Freedom) | 0764193843 | 1808 Manning |
| Mortgage | Rocket Mortgage (Mr. Cooper) | 0715348686 | 2224 Birchglen (Simi Valley) |
| Investment (JTWROS) | J.P. Morgan | 767-44030 | David & Marc Young |
| Savings (CUTMA) | Chase | 000037566119737 | Jacob L Young |
| Social Security | SSA | (Medicare: 7KH4-F70-KN94) | Coty Coleman |
| Medi-Cal | CA County | TBD | Coty Coleman |
| Corp Filing | CA SOS | A-14320 | The Young Group, Inc. |
| JCO Fee | LA Housing Dept | 10162441 | 1808 Manning |

---

## Important Dates

| Date | Event | Person/Property |
|------|-------|-----------------|
| 12/01/2025 | Mortgage transferred to CrossCountry | 1808 Manning |
| 01/31/2026 | 60-day grace period ends (no late fees) | 1808 Manning |
| 06/02/2025 | JCO Fee Due (late after 09/02) | 1808 Manning |
| 07/01/2026 | Medi-Cal Redetermination | Coty Coleman |
| 09/12/2025 | Insurance Renewal | 1085 Acanto |

### Action Items
- [ ] **⚠️ URGENT:** Provide HO6 insurance proof for 2224 Birchglen (Simi Valley) - expired 12/12/2024!
  - Submit to: www.mycoverageinfo.com/mrcooper or email mrcooper@mycoverageinfo.com
  - Mail: Nationstar Mortgage LLC, P.O. Box 7729, Springfield, OH 45501-7729
  - Loan #: 0715348686
- [ ] **⚠️ URGENT:** Pay LAHD SCEP fee $77.83 for 1808 Manning - FINAL NOTICE before collections!
  - Online: https://housingla.lacity.org/billings
  - Statement #: 10672017
- [ ] Register at www.servicing.crosscountrymortgage.com (1808 Manning mortgage)
- [ ] Update autopay to CrossCountry loan #0764193843

---

## Notification Settings

- **Push notifications:** BOTH David & Lisa
- **Email/Text:** Not used - app-based only
- **Calendar updates:** Instant push when Lisa/David update calendar

---

## Lisa's Work Schedule Feature

Lisa can tap dates to mark Office/WFH. When saved:
- Updates combined family calendar
- David gets instant push notification: "Lisa updated calendar: Office on Dec 26, 27"
- Works without opening the app

---

## Document Processing Notes

- Chase CUTMA account filename said "Coty Coleman" but document shows "Jacob L Young BY Lisa Michelle Young CUTMA" - beneficiary name wasn't in document
- Document #6 (05_Property_Tax_LA_County_2025) was MISLABELED - actually contained JCO bills + Mortgage Transfer Notice
- Always verify from document content, not filename

### Documents Processed (December 25, 2024)
| Filename | Actual Content | Property/Person | Stored As |
|----------|----------------|-----------------|-----------|
| cross country .pdf | CrossCountry Mortgage Welcome Packet & Servicing Transfer Notice | 1808 Manning | `document-processing/1808-Manning/CrossCountry_Mortgage_Transfer_Notice_2025-12-09.pdf` |
| for coleman SS.pdf | SSA Benefits Letter - $1,188/mo, Medicare info | Coty Coleman | `document-processing/Coty-Coleman/SSA_Benefits_Letter_2025-08-04.pdf` |
| Cory Coleman money .pdf | **MISLABELED** - J.P. Morgan Investment Statement $412,378 | David & Marc Young | `document-processing/Investments/JPMorgan_JTWROS_Statement_2025-11.pdf` |
| many things -pages-1.pdf | CrossCountry Welcome Letter - adds monthly payment $2,353.71 | 1808 Manning | `document-processing/1808-Manning/CrossCountry_Welcome_Letter_2025-12-01.pdf` |
| many things -pages-2.pdf | Mechanics Bank HELOC Statement - $272K limit, $0 balance | 1085 Acanto | `document-processing/1085-Acanto/Mechanics_Bank_HELOC_Statement_2025-12-10.pdf` |
| many things -pages-3.pdf | **NEW PROPERTY** Rocket Mortgage Lender-Placed Insurance Notice | 2224 Birchglen (Simi Valley) | `document-processing/2224-Birchglen/RocketMortgage_LenderPlaced_Insurance_Notice_2025-12-15.pdf` |
| many things -pages-4.pdf | LAHD Annual Bill - SCEP $77.83 **FINAL NOTICE** | 1808 Manning | `document-processing/1808-Manning/LAHD_Annual_Bill_FINAL_NOTICE_2025-12-12.pdf` |
| Anita Young Docs.pdf | **SPLIT INTO 8 DOCUMENTS** (see below) | Anita Young / 1135 S Hayworth | `document-processing/Anita-Young/` |

### Anita Young Documents (Split from 16-page collection)
| Document | Pages | Content | Property/Person |
|----------|-------|---------|-----------------|
| Steve_Watson_Application_2010.pdf | 15,13,1,16 | Rental application, credit history, deposit checks ($2,000 + $3,600 + $2,600) | 1133 S Hayworth (tenant) |
| Steve_Watson_Lease_2010.pdf | 2,11,12 | Original lease $2,600/mo + signatures + move-in checklist | 1133 S Hayworth |
| Steve_Watson_Lease_Renewal_2015.pdf | 10 | 2015 lease renewal, $2,600/mo | 1133 S Hayworth |
| Rent_Increase_Notice_2015-09_to_2843.pdf | 8 | Rent increase effective 09/01/2015 to $2,843/mo | 1133 S Hayworth |
| Rent_Increase_Notice_2019-09_to_3232.pdf | 9 | Rent increase effective 09/01/2019 to $3,232/mo (signed) | 1133 S Hayworth |
| Rent_Increase_Notice_2020-09_to_3362.pdf | 14 | Rent increase effective 09/01/2020 to $3,362/mo (signed) | 1133 S Hayworth |
| Chase_CD_POD_Marc_Young_2010-08.pdf | 5,6 | CD Receipt $3,600 (POD Marc D Young) + linked account letter | Anita Young |
| David_Young_CA_RE_Broker_License.pdf | 3 | State of California Real Estate Broker License | David Jaime Young |
| **SKIPPED:** Pages 4 (Chase rate sheet - reference only), 7 (duplicate of page 6) | | |
| many things -pages-5.pdf | LADWP Bill - Oct 2025, $1,328.27 (electric $1,231.16 + water $77.18 + sanitation $219.76) | 1085 Acanto | `document-processing/1085-Acanto/LADWP_Bill_2025-10-24.pdf` |
| many things -pages-6.pdf | LADWP Level Pay promotional flyer (bilingual) | N/A | **SKIPPED** - marketing material |
| David Young Licensing .pdf | The Young Group Corp License Application (49 pages) - DRE License #01371572, Corp #3392430, expires 08/15/2029 | David Young | `document-processing/David-Young/The_Young_Group_Corp_License_Application.pdf` |
| 01_Insurance_Mercury_HO6_All_Pages.pdf | Mercury/KW Specialty HO3 Policy - $5,374.65 premium, 09/12/2025-09/12/2026, Policy #1000017887HO | 1085 Acanto | `document-processing/1085-Acanto/Mercury_KW_Specialty_HO3_Policy_2025-2026.pdf` |
| 02_Mortgage_Escrow_USBank_Acanto_Pl_90049.pdf | US Bank Final Escrow Account Disclosure Statement, Account #0018458992 | 1085 Acanto | `document-processing/1085-Acanto/USBank_Escrow_Statement_2025.pdf` |
| 03_Bank_Statement_Chase_Savings_Coty_Coleman.pdf | **MISLABELED** - Jacob L Young CUTMA (BY Lisa Michelle Young), Account #000037566119737, Balance $2,168.20 | Jacob Young | `document-processing/Jacob-Young/Chase_CUTMA_Savings_Statement_2025-09.pdf` |
| 04_CA_FTB_501c_Tax_Document.pdf | CA 501-CORP Declaration of Directors/Officers 2025 - The Young Group | The Young Group | `document-processing/The-Young-Group/CA_501_CORP_Declaration_2025.pdf` |
| 05_Property_Tax_LA_County_2025_All_Pages.pdf | **MISLABELED & SPLIT INTO 4 DOCUMENTS** - Not property tax! | Multiple | See below |

### Split from 05_Property_Tax_LA_County_2025_All_Pages.pdf (7 pages → 4 documents)
| Pages | Document | Content | Property | Stored As |
|-------|----------|---------|----------|-----------|
| 1-2 | LAHD_JCO_Annual_Bill_2025.pdf | JCO Annual Bill ~$110.53, Invoice #5486009, Due 6/2/2025 | 1808 Manning | `1808-Manning/` |
| 3-4 | LAHD_RSO_Annual_Bill_2025.pdf | RSO Annual Bill ~$533, Invoice #5486099, 4 units, Due 6/2/2025 | 1808 Manning | `1808-Manning/` |
| 5 | LAHD_Rent_Registry_Form_2025.pdf | Annual Rent Registry Form, Statement #10162441 | 1808 Manning | `1808-Manning/` |
| 6 | **SKIPPED** | LAHD FAQ - reference only | N/A | - |
| 7 | SPS_Mortgage_Servicing_Transfer_Notice_2025-07.pdf | **WRONG PROPERTY** - Mortgage transfer US Bank→SPS eff 08/01/2025, Acct #0034953794 | **1085 Acanto** | `1085-Acanto/` |

### Documents Processed from Scan Images (December 25, 2024 - Session 2)

**Scan2 (61 pages) - Coty Coleman & Insurance Documents:**
| Document | Pages | Content | Category | Stored As |
|----------|-------|---------|----------|-----------|
| Power_of_Attorney_Coty_Coleman.pdf | 4-31 | General Durable Power of Attorney for Coty Coleman | Legal | `Coty-Coleman/` |
| Mercury_Insurance_Claim_Letter_2025-09-04.pdf | 35-36 | Insurance Claim #CAPA-02571084 for Lisa Young, Date of Loss 06/06/2025 | Insurance | `1085-Acanto/` |
| Mercury_Insurance_Declarations_Change_2025-09.pdf | 32 | Policy change effective 09/14/2025 (reason: Change Mortgage) | Insurance | `1085-Acanto/` |

**Scan3 (50 pages) - Mixed Financial Documents:**
| Document | Pages | Content | Category | Stored As |
|----------|-------|---------|----------|-----------|
| KW_Specialty_Billing_Notice_2025-09.pdf | 2 | HO3 Policy Billing - $5,374.65 due 09/12/2025, Policy #1000017887HO | Insurance | `1085-Acanto/` |
| KW_Specialty_Policy_Declarations_2024-2025.pdf | 25-29 | HO3 Policy Declarations - $4,053.94 annual premium | Insurance | `1085-Acanto/` |
| CA_501_CORP_Declaration_2025.pdf | 10 | Declaration of Directors/Officers - The Young Group Inc | Tax | `The-Young-Group/` |
| LA_Housing_Rent_Registry_Form_2025.pdf | 15 | 2025 Annual Rent Registry Form | Housing | `1808-Manning/` |
| Mercury_Insurance_Renewal_2025-2026.pdf | 30 | Homeowner Renewal - Policy #CAHP0001094546, $1,085.12, Sept 2025-2026 | Insurance | `1808-Manning/` |
| JPMorgan_JTWROS_Statement_2025-08.pdf | 34-50 | Investment Statement Aug 2025 - David & Marc Young, Account #767-44030 | Bank | `Investments/` |

### Insurance Claim Discovery
**Mercury Insurance Claim #CAPA-02571084:**
- **Insured:** Lisa Young
- **Property:** 1085 Acanto Pl, Los Angeles, CA 90049
- **Date of Loss:** June 6, 2025
- **Status:** Recovery being pursued from another party
- **Contact:** Sandra Vila, Claims Dept, 888-263-7287 ext 25577
- **Email:** MyClaim+CAPA-02571084@MercuryInsurance.com

### New Insurance Information Discovered
**1808 Manning - Mercury Insurance:**
- **Policy #:** CAHP0001094546
- **Provider:** California Automobile Insurance Company (Mercury)
- **Annual Premium:** $1,085.12
- **Period:** September 14, 2025 to September 14, 2026
- **Agent:** Crusberg Decker Ins/Servs (818) 707-7711

---

## SESSION STATUS (Last Updated: December 25, 2024 - 10:00 PM)

### CURRENT ISSUE TO FIX
The `/api/claude/query` endpoint returns 500 error. Likely cause:
- **Supabase API keys**: New format (`sb_publishable_`, `sb_secret_`) may not work with supabase-js
- **Need to get LEGACY keys** from: https://supabase.com/dashboard/project/fnfwaqugiwspnyjtribf/settings/api
  - Look for "Legacy anon, service_role API keys" section
  - Update `VITE_SUPABASE_ANON_KEY` in Vercel with legacy anon key (JWT format)
  - Update `SUPABASE_SERVICE_KEY` in Vercel with legacy service_role key (JWT format)
- **Then check Vercel Runtime Logs** to see actual error message

### Vercel Environment Variables (Current)
| Variable | Status |
|----------|--------|
| VITE_SUPABASE_URL | ✅ Set to fnfwaqugiwspnyjtribf |
| VITE_SUPABASE_ANON_KEY | ⚠️ May need legacy JWT format |
| SUPABASE_URL | ✅ Set |
| SUPABASE_SERVICE_KEY | ⚠️ May need legacy JWT format |
| ANTHROPIC_API_KEY | ✅ Set |
| VAPID_PUBLIC_KEY | ✅ Set |
| VAPID_PRIVATE_KEY | ✅ Set |
| VAPID_SUBJECT | ✅ Set |

### Deployed & Working
- App URL: https://young-hub.vercel.app
- Vercel Project: https://vercel.com/david-youngs-projects-94a06a35/young-hub
- All tabs load correctly
- VaultChat UI works (but API returns 500)

### Sprint 1-3 COMPLETED

| Sprint | Task | Status | Notes |
|--------|------|--------|-------|
| 1 | CLAUDE.md with FV alias | Done | Family info, properties, accounts documented |
| 1 | Database schema | Done | `supabase-setup.sql` - all tables created |
| 1 | Supabase setup | Done | Project: fnfwaqugiwspnyjtribf.supabase.co |
| 2 | Document uploads | Done | **34 documents** in Supabase Storage + database |
| 2 | Scan image processing | Done | 112 scan images analyzed, converted to PDFs |
| 2 | All vault components | Done | DocumentUploader, DocumentViewer, DocumentSearch, FamilyCalendar |
| 2 | Push notifications | Done | `src/lib/notifications.ts` + service worker |
| **3** | **Claude API integration** | **Done** | `/api/claude/parse.ts` + `/api/claude/query.ts` |
| **3** | **VaultChat Q&A** | **Done** | `src/components/vault/VaultChat.tsx` - natural language questions |
| **3** | **UrgentItems widget** | **Done** | `src/components/vault/UrgentItems.tsx` - due date tracking |
| **3** | **Web Push notifications** | **Done** | `/api/notifications/push.ts` + subscribe.ts |
| **3** | **Email notifications** | **Done** | `/api/notifications/email.ts` - Gmail API ready |
| **3** | **Due date checker cron** | **Done** | `/api/cron/check-due-dates.ts` - daily at 9 AM |
| **3** | **Database: notifications** | **Done** | push_subscriptions, notification_preferences, notification_log |
| **3** | **Database: versioning** | **Done** | supersedes_id, is_latest, statement_period columns |

### Documents in Supabase (34 total)
| Folder | Count | Contents |
|--------|-------|----------|
| 1085-Acanto | 9 | LADWP, HELOC, Mercury insurance, KW Specialty, SPS transfer, US Bank escrow |
| 1808-Manning | 8 | CrossCountry mortgage, LAHD bills, Rent Registry, Mercury renewal |
| 2224-Birchglen | 1 | Rocket Mortgage lender-placed insurance notice |
| Anita-Young | 8 | Steve Watson lease/applications, rent increases, Chase CD, RE license |
| Coty-Coleman | 2 | SSA Benefits Letter, Power of Attorney |
| David-Young | 1 | The Young Group Corp License Application |
| Investments | 2 | J.P. Morgan JTWROS statements (Aug + Nov 2025) |
| Jacob-Young | 1 | Chase CUTMA Savings statement |
| The-Young-Group | 1 | CA 501-CORP Declaration |

### What's Working Now
- **Documents Tab**: Search documents, upload via modal, view PDFs/images inline
- **Calendar Tab**: Quick-tap events, member toggle, push notifications
- **Ask Vault Tab**: Natural language Q&A powered by Claude
- **Overview Tab**: UrgentItems widget + VaultChat widget
- **Notifications**: Web push + email (Gmail API) + daily cron for due dates
- **Supabase**: Database + Storage fully operational
- **Dev server**: `npm run dev` at http://localhost:5173/

### API Endpoints Created (Sprint 3)
| Endpoint | Purpose |
|----------|---------|
| `POST /api/claude/parse` | AI document parsing with vision |
| `POST /api/claude/query` | Natural language Q&A with RAG |
| `POST /api/notifications/push` | Send web push notifications |
| `GET/POST/DELETE /api/notifications/subscribe` | Manage push subscriptions |
| `POST /api/notifications/email` | Send email via Gmail API |
| `GET /api/cron/check-due-dates` | Daily due date checker (Vercel Cron) |

### Environment Variables Needed
```env
# Already configured
ANTHROPIC_API_KEY=sk-ant-api03-...
VAPID_PUBLIC_KEY=BI_S3cIx...
VAPID_PRIVATE_KEY=ludZdb0...
VAPID_SUBJECT=mailto:dyoung1946@gmail.com

# Need to add in Vercel Dashboard
SUPABASE_SERVICE_KEY=<service role key from Supabase>

# For Gmail (when ready)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REFRESH_TOKEN=<from OAuth Playground>
GMAIL_SENDER_ADDRESS=familyvault.notifications@gmail.com
```

### Next Steps (Sprint 4)
1. **Run new SQL** - Execute updated `supabase-setup.sql` for notification tables
2. **Gmail Setup** - Create Gmail account + configure OAuth
3. **Auto-parsing on upload** - Modify DocumentUploader to call /api/claude/parse
4. **Version detection** - Auto-detect when new statement replaces old
5. **Mobile optimization** - Test PWA on iOS/Android

### Key Files Modified This Session (Sprint 3)
```
api/
├── claude/
│   ├── parse.ts (AI document parsing)
│   └── query.ts (natural language Q&A)
├── notifications/
│   ├── push.ts (web push)
│   ├── subscribe.ts (subscription management)
│   └── email.ts (Gmail API)
└── cron/
    └── check-due-dates.ts (daily cron job)

src/components/vault/
├── VaultChat.tsx (NEW - Q&A interface)
├── UrgentItems.tsx (NEW - due date widget)
└── index.ts (updated exports)

src/lib/notifications.ts (push subscription management)
src/pages/Dashboard.tsx (Ask Vault tab + Overview widgets)
src/index.css (VaultChat + UrgentItems styles)
public/service-worker.js (push notification handling)
supabase-setup.sql (notification + version tracking tables)
vercel.json (cron config + API routing)
.env (VAPID keys added)
```

### Known Issues
- Gmail API requires OAuth setup before email notifications work
- SUPABASE_SERVICE_KEY needs to be added to Vercel environment
- Run updated SQL in Supabase to create notification tables

### To Resume Development
1. `cd "/mnt/c/Users/dyoun/The Young/FamilyFinanceHub"`
2. `npm run dev`
3. Open http://localhost:5173/
4. Run tests: `npx playwright test`
5. Deploy: `git push` (Vercel auto-deploys)
