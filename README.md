# LeadHub AI — Customer Onboarding Backend

AI-powered lead response for small business. This backend handles the complete customer onboarding flow in 3 steps.

## API Endpoints

Base URL: `https://your-app.railway.app`

### Health Check
```
GET /onboarding/health
```

---

### STEP 1 — Register a new customer
```
POST /onboarding/register
```
**Body:**
```json
{
  "businessName": "Acme Plumbing",
  "ownerName": "John Smith",
  "email": "john@acmeplumbing.com",
  "phone": "555-123-4567",
  "website": "https://acmeplumbing.com",
  "industry": "Plumbing",
  "plan": "STARTER"
}
```
**Returns:** Customer ID — save this, you'll need it for steps 2 & 3.

---

### STEP 2 — Save AI settings
```
PATCH /onboarding/:customerId/settings
```
**Body:**
```json
{
  "aiResponseEnabled": true,
  "responseDelaySeconds": 30,
  "notifyEmail": true,
  "notifyPhone": false,
  "businessHours": "Mon-Fri 8am-6pm",
  "aiGreeting": "Hi! Thanks for reaching out to Acme Plumbing. We'll be right with you!"
}
```

---

### STEP 3 — Activate account (complete onboarding)
```
POST /onboarding/:customerId/activate
```

---

### Get a single customer
```
GET /onboarding/:customerId
```

### Get all customers
```
GET /onboarding
```

---

## Plans Available
- `STARTER` — Default free/entry plan
- `GROWTH` — Mid-tier plan
- `PRO` — Full features

## Onboarding Status Values
- `PENDING` — Registered but not yet activated
- `ACTIVE` — Fully onboarded and live
- `PAUSED` — Temporarily disabled
- `CANCELLED` — Cancelled account
