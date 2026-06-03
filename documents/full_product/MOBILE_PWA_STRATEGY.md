# Mobile and PWA Strategy — Digital Twin FM

## Purpose

This document defines the full-product mobile strategy for technicians, facility managers, and operators.

## Recommendation

Use a responsive web app and PWA first. Build a native mobile app only if real customer needs justify it.

Reasons:
- Faster development.
- Shared code with Next.js frontend.
- Easier deployment.
- Good enough for many technician workflows.
- Avoids maintaining iOS/Android too early.

## Target mobile users

### Technician

Needs:
- view assigned work orders,
- update status,
- add notes,
- scan asset QR code,
- upload photos,
- view asset history,
- see safety/maintenance instructions.

### Facility manager

Needs:
- review alerts,
- create/assign work orders,
- check building status,
- approve critical actions,
- view operational KPIs.

### Operator

Needs:
- monitor active incidents,
- acknowledge alerts,
- escalate issues,
- view live facility status.

## MVP mobile support

- Responsive web layout.
- Work orders usable on phone-sized screen.
- Alerts readable on mobile.

## Full PWA capabilities

- Installable PWA.
- Offline-tolerant work order detail page.
- QR code scan for asset lookup.
- Camera upload for maintenance photos.
- Push notifications if required.
- Background sync for queued updates later.

## QR asset flow

Recommended flow:

```text
Technician scans QR on equipment
  -> opens /assets/:assetId or /mobile/assets/:assetId
  -> sees asset status, open work orders, recent alerts
  -> can create/update work order if permitted
```

QR codes should encode stable asset URL or asset ID, not internal temporary data.

## Offline considerations

Full offline mode is complex. Introduce gradually.

Stage 1:
- mobile-friendly online UI.

Stage 2:
- cache assigned work orders and asset summaries.

Stage 3:
- allow offline notes/status changes and sync later.

Offline risks:
- conflicting updates,
- stale safety information,
- duplicate submissions,
- permission changes while offline.

## Photo/document uploads

Technicians may need to attach:
- photos,
- inspection forms,
- invoice/service reports,
- before/after evidence.

Requirements:
- file type validation,
- size limits,
- object storage,
- link attachments to work orders/assets,
- access control by organization/site.

## Notifications

Possible notification channels:
- in-app notification,
- email,
- push notification,
- SMS/WhatsApp later if business requires.

Use notifications for:
- work order assigned,
- priority changed,
- critical alert,
- due date approaching,
- blocked work order update.

## Native app decision criteria

Consider native app only when:
- offline workflows become critical,
- push notifications must be highly reliable,
- device integrations are needed,
- barcode/QR/camera requirements exceed PWA capability,
- customers require app store distribution.

## Acceptance criteria

- Work order list/detail works on mobile viewport.
- Technician can update assigned work order from phone.
- Asset QR strategy is defined.
- Photo attachment path is designed before implementation.
- PWA-first approach is documented before native app investment.
