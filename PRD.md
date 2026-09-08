# Finvayo MVP Product Requirements Document

**Product:** Finvayo  
**Working tagline:** Know what you can safely spend.  
**Document status:** MVP proposal  
**Date:** 2026-09-08  
**Owner:** Founder

---

## 1. Executive Summary

Finvayo is a cash-flow decision tool for freelancers, consultants, and very small service businesses.

Its core promise is simple:

> Finvayo shows how much money is safe to spend today, when the business may run short, and which unpaid invoices require attention.

Small service businesses often look profitable on paper while still running into cash shortages. Revenue arrives irregularly, invoices are paid late, taxes are easy to underfund, and recurring costs continue regardless. Existing accounting products record what happened, spreadsheets require constant upkeep, and bank balances can create a false sense of security.

The MVP will provide a lightweight 90-day cash outlook from a small amount of manually entered information. It will turn that outlook into three decisions:

1. How much is safe to spend now?
2. When is cash likely to become tight?
3. Which expected payment should be followed up first?

The initial product will not be an accounting system, bank account, invoicing platform, investment tool, or AI financial adviser.

---

## 2. Product Thesis

### 2.1 Problem

Freelancers and small service businesses rarely have a finance specialist, but they make cash decisions every week:

- Can I pay myself more this month?
- Can I buy equipment or hire a contractor?
- Will I have enough for tax and recurring bills?
- What happens if a client pays two weeks late?
- Which invoice should I chase today?

Their bank balance does not answer these questions. Accounting software is designed primarily for bookkeeping and compliance. Spreadsheets can answer them, but only if the owner builds and maintains a reliable model.

### 2.2 Opportunity

Finvayo can occupy the space between a bank balance and an accounting package. It should be easier than a spreadsheet and more decision-oriented than bookkeeping software.

The product should not initially compete on comprehensiveness. It should compete on speed to clarity:

> In under 10 minutes, a business owner should understand their next 90 days of cash and one action they should take today.

### 2.3 Initial Niche

The first target is solo professionals and service businesses with one to five people, recurring operating costs, and invoice-based revenue.

Examples:

- Independent consultants
- Designers and developers
- Marketing and creative studios
- Recruiters
- Coaches and trainers
- Small professional-service agencies

This niche is preferable to consumers or larger companies because the owner is also the financial decision-maker, late invoices directly affect operations, and buying decisions can be made without a long sales process.

### 2.4 Why Finvayo Can Win

Finvayo will focus on a narrow recurring job rather than becoming another financial dashboard:

- Translate financial inputs into a clear safe-to-spend amount.
- Make timing risk visible before it becomes a crisis.
- Connect overdue revenue to a concrete collection action.
- Require less setup and maintenance than a spreadsheet.
- Use calm, plain language rather than accounting terminology.

---

## 3. Target Customer

### 3.1 Primary Persona

**Alex, independent consultant**

- Bills two to eight clients each month.
- Revenue varies and payments do not always arrive on time.
- Has recurring software, contractor, rent, insurance, and tax obligations.
- Checks the bank balance frequently but does not maintain a reliable forecast.
- Uses invoices and perhaps accounting software, but does not employ a finance professional.
- Wants confidence, not another system to administer.

### 3.2 Early-Adopter Signals

An especially promising customer:

- Has experienced at least one unexpected cash squeeze.
- Has more than three recurring monthly expenses.
- Is currently tracking expected payments in a spreadsheet, notes app, or memory.
- Regularly wonders whether current cash is available or already committed.
- Has invoices paid on net-15, net-30, or inconsistent schedules.
- Can enter a few figures manually to get immediate value.

### 3.3 Buyer and User

For the MVP, the buyer and daily user are the same person: the business owner.

### 3.4 Jobs To Be Done

**Primary job**

> When money enters and leaves my business at uneven times, help me understand what I can safely spend so I can make decisions without maintaining a complex spreadsheet.

**Supporting jobs**

> When a client payment is late, show me how much it affects my near-term cash and help me follow up professionally.

> Before making a purchase or taking money out of the business, show me how that choice changes my cash runway.

> When I review the business each week, tell me what changed and where I need to act.

---

## 4. Product Principles

1. **Decisions before dashboards.** Every important screen should answer a question or recommend an action.
2. **Useful before connected.** A user must get value without linking a bank or accounting provider.
3. **Explain every number.** Users must be able to see how safe-to-spend and runway figures were calculated.
4. **Conservative by default.** Uncertain income should not be treated the same as cash already received.
5. **Low maintenance.** Weekly review should take less than five minutes after initial setup.
6. **No shame or alarmism.** Financial risk should be communicated calmly and specifically.
7. **Earn trust gradually.** Avoid claims that imply regulated financial, tax, legal, or accounting advice.

---

## 5. MVP Scope

### 5.1 Core User Outcome

After setup, a user sees:

- Current available cash
- Reserved cash, including tax and a user-defined minimum buffer
- Safe-to-spend amount
- Lowest projected cash point in the next 90 days
- The date cash may fall below the selected buffer
- Expected and overdue client payments
- The single most important action to take next

### 5.2 MVP Features

#### A. Guided Business Setup

The user enters:

- Business name
- Currency
- Current cash balance
- Minimum cash buffer they do not want to cross
- Tax reserve as either a fixed amount or a percentage of included future revenue, plus any tax already reserved in the current balance
- Typical client payment delay, defaulting to zero if unknown

The product explains why each item is needed and permits reasonable defaults.

**Acceptance criteria**

- A new user can complete setup in under 10 minutes.
- The user can skip optional fields.
- Currency is consistent throughout the workspace.
- The user can edit setup values later, except currency becomes immutable after the first monetary record unless the plan is reset and its monetary data is deleted.

#### B. Money-In Schedule

The user can add expected client payments with:

- Client name
- Amount
- Expected date
- Status: expected, invoiced, paid, overdue, or unlikely
- Optional invoice reference
- Optional recurrence

An expected payment becomes overdue when its date passes without being marked paid. The user can record an actual payment date and amount. Marking a payment paid does not change the current cash balance; it makes the forecast provisional until the user confirms a new balance, preventing transactions already reflected by the bank balance from being counted twice.

**Acceptance criteria**

- The user can add, edit, mark paid, or remove a payment.
- Recurring expected payments can repeat monthly in the MVP.
- Overdue items are visually distinct.
- Unlikely income is excluded from the default safe-to-spend calculation.
- The effect of including or excluding a payment is visible.

#### C. Money-Out Schedule

The user can add obligations with:

- Name
- Amount
- Due date
- Category
- Optional monthly recurrence
- Status: planned or paid

Suggested categories are contractors, software, rent, insurance, tax, payroll or owner pay, debt, and other.

**Acceptance criteria**

- The user can add, edit, mark paid, or remove an expense.
- Monthly recurring expenses automatically appear in the 90-day outlook.
- Tax reserve is shown separately from ordinary expenses.

#### D. 90-Day Cash Outlook

The product combines current cash, expected inflows, planned outflows, tax reserve, and minimum buffer into a daily projection for the next 90 days.

The outlook shows:

- Projected balance over time
- Lowest projected balance and date
- First date the balance falls below the user's buffer
- Major inflows and outflows
- A normal, caution, or at-risk state

The product must clearly distinguish actual cash from projected cash.

**Acceptance criteria**

- Editing an inflow, outflow, reserve, or buffer immediately updates the outlook.
- The user can inspect which entries determine a projected balance.
- Empty and incomplete states explain what input is missing.
- The forecast never presents uncertain future income as guaranteed.

#### E. Safe-To-Spend Number

The home screen displays a single decision-oriented amount:

> Safe to spend now: [amount]

For the MVP, this is the amount that could leave the business today while preserving scheduled obligations, the tax reserve, and the minimum cash buffer through the 90-day period.

Conceptually:

```text
safe to spend = max(0, lowest projected available cash above required reserves)
```

The exact calculation must be transparent. The user can expand the number to see the components and assumptions behind it.

**Acceptance criteria**

- The displayed amount cannot be negative; risk is shown separately.
- The explanation identifies the key constraint, such as a large bill or late invoice.
- The result updates whenever forecast inputs change.
- The interface states that this is a planning estimate, not financial advice.

#### F. What-If Purchase Check

The user can enter a hypothetical amount and date to answer:

> Can I afford this without crossing my buffer in the next 90 days?

The result shows:

- Safe, caution, or at-risk
- New lowest projected balance
- Any date on which the buffer would be crossed
- The difference from the current outlook

The scenario is temporary unless the user chooses to add it as a planned expense.

**Acceptance criteria**

- Running a scenario does not alter the live forecast.
- A scenario can be converted into a planned expense with one action.
- The result explains why the purchase is or is not considered safe.

#### G. Invoice Follow-Up Assistant

For an overdue expected payment, the user can generate a concise follow-up message using a small set of tones:

- Friendly reminder
- Direct follow-up
- Final notice

The message uses the client's name, amount, due date, and invoice reference. The user reviews and copies the text; Finvayo does not send email in the MVP.

**Acceptance criteria**

- No message is sent automatically.
- The user can edit the generated text.
- The message never threatens legal action or invents payment terms.
- A follow-up can be marked as completed with a date.

#### H. Weekly Review

The home screen provides a short weekly checklist:

- Confirm current cash balance.
- Mark received payments.
- Mark paid obligations.
- Review overdue income.
- Review the next 30 days.

After review, Finvayo summarizes what changed and identifies one recommended next action.

**Acceptance criteria**

- A returning user can complete a normal review in under five minutes.
- The last reviewed date is visible.
- The recommended action links directly to the relevant item.

### 5.3 Home Screen Priority

The MVP home screen should prioritize information in this order:

1. Safe to spend now
2. Current risk state and lowest projected balance
3. One recommended action
4. 90-day outlook
5. Upcoming and overdue payments
6. Upcoming expenses

This is not intended to be a dense analytics dashboard.

---

## 6. Forecast Rules

The MVP needs predictable product rules even before implementation decisions are made.

### 6.1 Inflows

- Paid income affects current cash only when the user confirms the current balance or records it consistently through the product.
- Expected and invoiced income appear in the forecast on their expected dates.
- Overdue income remains visible but is treated as uncertain.
- Unlikely income is excluded from the primary forecast.
- Users can choose to exclude any expected payment.

### 6.2 Outflows

- Planned expenses reduce projected cash on their due dates.
- Recurring monthly expenses continue through the forecast period.
- Paid expenses no longer appear as future deductions.
- The tax reserve is protected and is not counted as safe-to-spend cash.

### 6.3 Risk States

- **Normal:** projected cash remains above the minimum buffer throughout 90 days.
- **Caution:** projected cash remains non-negative but crosses the minimum buffer.
- **At risk:** projected cash falls below zero.

### 6.4 Confidence and Language

The product should say “projected,” “estimated,” and “based on the information entered.” It should not say “guaranteed,” “approved,” or “you can definitely afford this.”

---

## 7. Primary User Journeys

### 7.1 First Value

1. The visitor understands that Finvayo is for small-business cash decisions.
2. The visitor creates a workspace.
3. The user enters current cash, buffer, and tax reserve.
4. The user enters at least one expected payment and one upcoming expense.
5. Finvayo displays a 90-day outlook and safe-to-spend amount.
6. Finvayo explains which input has the greatest effect on the outlook.

**Target:** 60% of users who begin setup reach their first forecast.

### 7.2 Weekly Review

1. The user returns to Finvayo.
2. The user confirms or updates current cash.
3. The user marks payments and expenses that occurred.
4. Finvayo recalculates the outlook.
5. The user acts on the top recommendation.

### 7.3 Purchase Decision

1. The user selects “Check a purchase.”
2. The user enters an amount and date.
3. Finvayo shows the effect on safe-to-spend and cash risk.
4. The user discards the scenario or adds it as an expense.

### 7.4 Late Payment Follow-Up

1. Finvayo surfaces an overdue payment as the top action.
2. The user opens the payment.
3. The user selects a follow-up tone.
4. Finvayo prepares a message from known facts.
5. The user edits and copies the message.
6. The user records that follow-up occurred.

---

## 8. Out of Scope for MVP

The following are explicitly excluded until the core behavior is validated:

- Bank account connections
- Accounting platform integrations
- Automatic transaction categorization
- Creating or sending invoices
- Processing payments from the user's clients; Finvayo's own subscription charges are processed by Stripe
- Automatic email sending
- Payroll
- Full profit-and-loss, balance-sheet, or tax reporting
- Tax filing or tax recommendations
- Consumer budgeting
- Investments, lending, credit scoring, or financial products
- Multiple users, roles, or approval workflows
- Multiple currencies in one workspace
- Native mobile applications
- Forecasts beyond 90 days
- General-purpose AI chat
- Benchmarking against other businesses

---

## 9. Positioning and Messaging

### 9.1 Positioning Statement

For freelancers and small service businesses that need to make spending decisions despite irregular income, Finvayo is a lightweight cash-flow planner that shows what is safe to spend and when cash may become tight. Unlike accounting software or spreadsheets, Finvayo turns a simple 90-day forecast into a clear next action.

### 9.2 Landing Page Message

**Headline:** Know what your business can safely spend.

**Subheadline:** See the next 90 days of cash, protect money for tax and bills, and catch payment problems before they become emergencies.

**Primary call to action:** Build my free cash outlook

### 9.3 Message Hierarchy

1. Make spending decisions with confidence.
2. See cash shortages before they happen.
3. Keep tax, bills, and your minimum buffer protected.
4. Know which late payment to chase first.
5. Set up in minutes, without replacing accounting software.

### 9.4 Brand Direction

“Finvayo” suggests forward movement and a financial journey. The brand should feel calm, capable, and non-judgmental rather than corporate or speculative.

Avoid:

- Trading and cryptocurrency imagery
- Claims of effortless wealth
- Aggressive red alerts for normal uncertainty
- Dense accounting language
- Anthropomorphizing the product as an infallible adviser

---

## 10. Business Model

### 10.1 Initial Pricing Hypothesis

Use a simple subscription with one primary paid tier.

**Free trial:** 14 days, no payment method required  
**Launch plan:** $9 per month or $90 per year
**Expected standard price after validation:** $12 to $15 per month

All MVP functionality should be available during the trial. Artificial feature limits would make it harder for users to experience the complete value loop.

### 10.2 Pricing Rationale

- The product should cost less than an hour of bookkeeping or administrative work.
- The price is low enough for a solo business to purchase without approval.
- Recovering one late invoice or avoiding one poorly timed purchase can justify a year of service.
- A paid product is better aligned with financial privacy than advertising or selling leads.

### 10.3 Cancellation

Users should be able to cancel without contacting support. The product should explain data access and deletion clearly.

---

## 11. Success Metrics

### 11.1 North-Star Metric

**Weekly reviewed cash plans:** the number of active workspaces that update or confirm their plan and view the resulting outlook during a seven-day period.

This measures repeated decision value rather than account creation or passive page views.

### 11.2 Activation

A user is activated when they:

- Enter current cash and a buffer.
- Add at least one inflow.
- Add at least one outflow.
- View the calculated safe-to-spend amount.

**Initial target:** 60% of setup starters activate.

### 11.3 Engagement

- 45% of activated users complete a second weekly review within 14 days.
- 30% of activated users complete four reviews within 45 days.
- 25% of activated users run at least one purchase scenario or record an invoice follow-up.

### 11.4 Revenue

- 10% trial-to-paid conversion during the initial launch period.
- 20% trial-to-paid conversion after onboarding improvements and qualified acquisition.
- Less than 8% monthly customer churn after the first three months of paid availability.

These are validation targets, not forecasts.

### 11.5 Quality Guardrails

- Fewer than 2% of active users report that they cannot understand how safe-to-spend was calculated.
- No silent loss of user-entered financial records.
- All monetary projections clearly distinguish actual and expected values.
- Support requests involving a wrong or misleading calculation receive highest priority.

---

## 12. Validation Plan

Building the entire MVP before validating the behavior would be premature. Validation should occur in stages.

### Phase 1: Problem Interviews

Interview 12 to 15 freelancers and owners of small service businesses.

Ask about recent behavior, not hypothetical interest:

- Tell me about the last time cash was tighter than expected.
- How do you decide whether the business can afford a purchase?
- How do you reserve money for tax?
- How do you track invoices expected in the next month?
- Show me the spreadsheet, notes, or software you currently use.
- What did a late payment force you to delay?
- When did you last update your cash forecast?

**Evidence to continue**

- At least eight participants describe this as a recurring problem.
- At least five currently use a manual workaround.
- At least five agree to test with real or realistically anonymized figures.

### Phase 2: Concierge Forecast

Before a full product, provide five prospects with a manually prepared 90-day view based on their inputs. Observe whether they understand and use safe-to-spend, risk date, and recommended action.

**Evidence to continue**

- Four of five understand the output without a live explanation.
- Three take an action based on it within one week.
- Three request an updated view or ask to use it again.

### Phase 3: Self-Service MVP

Open self-service registration with a 14-day trial and no approval or payment method required. Begin with controlled traffic and direct observation of the first 20 to 30 users, but do not gate account creation behind invitations or manual founder action. Charge the launch price after the trial so willingness to pay is tested early.

**Evidence to continue**

- At least 60% activate.
- At least 40% return for a second weekly review.
- At least five become paying customers.
- Calculation trust is not a recurring blocker.

### Phase 4: Growth Launch

Increase public acquisition only after users repeatedly maintain their forecast. The product remains self-service throughout; the rollout limit controls marketing volume, not who is allowed to create an account.

---

## 13. Risks and Mitigations

### 13.1 Manual Entry Becomes Chore Work

**Risk:** Users may understand the value but stop updating their data.

**Mitigation:** Keep required inputs small, support recurring entries, center the product on a five-minute weekly review, and measure return behavior before adding integrations.

### 13.2 Forecast Creates False Confidence

**Risk:** Users may treat expected client payments as guaranteed.

**Mitigation:** Mark projections and uncertainty clearly, exclude unlikely income, make overdue payments visible, and explain assumptions behind every decision number.

### 13.3 Product Feels Like a Spreadsheet With Fewer Features

**Risk:** Users may prefer an existing spreadsheet.

**Mitigation:** Emphasize safe-to-spend, automatic time-based risk states, scenarios, and prioritized actions rather than data tables alone.

### 13.4 Accounting Products Add Similar Features

**Risk:** Established tools already hold richer financial data.

**Mitigation:** Stay focused on clarity, setup speed, and owner decisions. Position Finvayo as complementary until strong user demand justifies integrations.

### 13.5 Trust and Privacy Concerns

**Risk:** Users hesitate to enter sensitive financial information into a new product.

**Mitigation:** Ask for the minimum data, explain why it is needed, avoid bank credentials in the MVP, publish plain-language privacy and deletion policies, and never sell financial data.

### 13.6 Regulated Advice Boundary

**Risk:** “Safe to spend” may be interpreted as financial, tax, or legal advice.

**Mitigation:** Present it as a planning estimate based on user inputs, expose the calculation, avoid prescriptive tax claims, and obtain appropriate legal review before public launch.

---

## 14. Privacy, Trust, and Accessibility Requirements

### 14.1 Privacy

- Collect only information needed for the stated product purpose.
- Never sell or use customer financial data for advertising.
- Explain retention and deletion in plain language.
- Allow users to delete their workspace and associated data.
- Avoid requesting bank credentials or government identifiers in the MVP.
- Treat amounts, clients, invoices, and projections as sensitive data.

### 14.2 Trust

- Show when the cash plan was last updated.
- Show which values are user-entered, calculated, or estimated.
- Make corrections easy and preserve no hidden assumptions.
- Use consistent rounding and currency formatting.
- Provide a visible explanation of the forecast methodology.

### 14.3 Accessibility

- The core workflow must be usable with a keyboard.
- Risk must not be communicated by color alone.
- Charts need text summaries and accessible labels.
- Content should use plain language and meaningful headings.
- Monetary amounts and dates must remain understandable at increased text sizes and on mobile screens.

---

## 15. Release Criteria

The MVP is ready for self-service paid launch when:

- A new user can create a meaningful forecast in under 10 minutes.
- All MVP inflow and outflow actions work without assistance.
- Safe-to-spend is explainable from the visible inputs.
- Forecast changes are reflected consistently across the product.
- A user can complete a weekly review in under five minutes.
- What-if scenarios cannot accidentally modify the live forecast.
- No message can be sent to a client without deliberate user action outside Finvayo.
- Empty, loading, error, and incomplete-data states are understandable.
- The product works on current desktop and mobile browsers.
- Workspace deletion, privacy information, and subscription cancellation are available.
- Calculation tests cover normal, caution, at-risk, overdue, recurring, and zero-balance cases.
- Five pilot users have completed a forecast with realistic data.

---

## 16. Post-MVP Opportunities

These should be considered only after weekly retention demonstrates that the core decision loop is valuable.

1. Read-only bank connections to reduce balance maintenance.
2. Accounting and invoicing integrations to import open invoices and recurring costs.
3. Configurable payment-delay assumptions by client.
4. Best-case, expected, and worst-case forecast ranges.
5. Email reminders and scheduled weekly summaries.
6. Collaboration with a bookkeeper or accountant.
7. Longer forecast horizons and seasonal planning.
8. Proposal and pipeline inputs with probability weighting.
9. Cash collection analytics, such as average days late by client.
10. A higher-priced agency plan with multiple entities or team members.

The first integration should be selected from observed user behavior, not assumed in advance.

---

## 17. Open Product Questions

The initial self-service cohort should answer these questions:

1. Does “safe to spend” immediately make sense, or does another phrase create more trust?
2. Will users maintain a forecast manually each week if the review takes less than five minutes?
3. Do customers care more about spending decisions, late invoices, tax reserves, or runway?
4. Should overdue income remain in the expected forecast by default, be delayed automatically, or be excluded?
5. Is a user-defined buffer understandable, or should Finvayo suggest one based on planned expenses?
6. Does invoice follow-up strengthen the core value proposition or distract from it?
7. Is $9 to $15 per month a credible price for the initial segment?
8. Which existing tool or workflow would customers say Finvayo replaces?
9. What minimum privacy evidence does a new financial product need before users enter real figures?

---

## 18. MVP Decision Summary

| Decision | MVP Choice |
|---|---|
| Customer | Freelancers and service businesses with 1-5 people |
| Core problem | Irregular cash makes spending decisions unsafe and stressful |
| Primary promise | Know what is safe to spend and when cash may become tight |
| Time horizon | 90 days |
| Data entry | Manual, with monthly recurrence |
| Core output | Safe-to-spend, lowest projected cash, risk date, next action |
| Differentiator | Decision clarity rather than bookkeeping breadth |
| Revenue model | 14-day trial, then simple subscription |
| Initial price | $9/month launch plan |
| Primary habit | Five-minute weekly cash review |
| Explicit exclusions | Banking, accounting, invoicing, payments, tax advice, general AI chat |
| Validation threshold | Repeat weekly use and early paid conversion |

---

## 19. One-Sentence MVP Test

Finvayo succeeds if a small-business owner can enter a few real numbers, understand their next 90 days of cash, make one better decision, and return the following week to do it again.
