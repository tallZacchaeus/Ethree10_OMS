# Finance Manager — user guide

You execute the money. The Chief Executive authorises it; you move it and record
it.

## What you do here

- **Issue invoices** to client organisations for approved project work.
- **Confirm funds received.** This is the moment a receipt is created — the record
  used for internal accounts and audits.
- **Pay approved expenses** raised by delivery leads against approved budgets.
- **Read the whole agency** so you have the context behind every figure.

## What you deliberately cannot do

You cannot approve a budget. You spend *within* budgets the Chief Executive has
already approved. If a budget has not been approved, every money action against
that project is blocked with a message telling you so.

You also cannot confirm a payment on a budget that you somehow approved — but
since you can never approve one, this only matters if roles are ever
reconfigured. See *Separation of duties*.

## The inbound flow — a client pays us

1. A branch head submits a project budget; the Chief Executive approves it.
2. You create the invoice against the project and send it. **If the budget is not
   approved, sending is blocked** — this is intentional.
3. The client receives a link to a public invoice page. They do not need an
   account.
4. When the money lands, open the invoice and **confirm payment**, recording the
   method and the payment reference.
5. A **receipt is issued automatically** at that moment and becomes available on
   its own public link.

The receipt is only ever created by confirming funds received. There is no way to
produce one without a confirmed payment against an approved budget.

## The outbound flow — we spend

1. A branch head or department lead requests spend against an approved budget
   from the **Expenses** screen.
2. The request is capped: the system refuses anything that would take committed
   spend past the approved internal amount, and tells you the figures.
3. You open **Expenses** and pay it, recording a payment reference.
4. The requester is notified.

**You cannot pay an expense you raised yourself.** The Pay button is disabled for
your own requests and the server refuses it regardless.

## Your screens

| Screen | What it is for |
|---|---|
| **Dashboard** | Agency-wide overview — the operational context behind the money. |
| **Invoices** | Create, send, and confirm payment. |
| **Receipts** | The issued-receipt register. |
| **Expenses** | Approved spend awaiting payment. |
| **Enquiries** | Inbound commercial enquiries from the marketing site. |
| **Reports / Audit** | Rollups and the append-only change record. |

## Separation of duties

One person can never hold both **Finance Manager** and **Chief Executive**. The
system blocks the role assignment outright. This is the standard anti-fraud
control: the person who authorises a payment and the person who confirms it must
be different people.
