# PR #3448 — feat(web): add push notification trigger for medicine expiry within 3…

> **Merged:** 2026-07-11 | **Author:** @Avinash-sdbegin | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #3123

## What Changed

This PR introduces a feature to send browser notifications to users when a medicine is approaching its expiry date, specifically within the next 30 days. The change adds a "Remind Me" checkbox to the Expiry Tracker component, allowing users to opt-in for these reminders. Upon successful tracking and if reminders are enabled, the system checks if the medicine's expiry date is within 30 days and triggers a notification if so.

## The Problem Being Solved

Before this PR, our system lacked a proactive method to inform users about impending medicine expiries, potentially leading to overlooked expirations and reduced efficacy of the medicine tracking feature. This omission could result in user dissatisfaction and undermine the purpose of the SahiDawa platform in ensuring timely and effective medicine management.

## Files Modified

- `apps/web/components/ExpiryTracker.tsx`

## Implementation Details

The implementation involves several key components:
- **State Management**: We added `remindMe` state to the `ExpiryTracker` component to track whether the user has opted for reminders.
- **Expiry Date Calculation**: The `isExpiringWithin30Days` function calculates if the expiry date of a medicine is within the next 30 days by comparing it with the current date.
- **Notification Triggering**: The `triggerNotification` function is responsible for displaying the browser notification. It checks for notification permission and creates a new notification with a title and body that includes the medicine's name.
- **Permission Handling**: Notification permission is requested when the user enables reminders and hasn't granted permission previously.
- **UI Updates**: A checkbox labeled "Remind me when this expires (within 30 days)" is added to the Expiry Tracker, allowing users to enable or disable reminders.

## Technical Decisions

We chose to use the Web Notifications API for its simplicity and wide browser support, making it an ideal choice for implementing browser notifications. The decision to request notification permission only when the user enables reminders aligns with best practices for user consent and privacy. The `isExpiringWithin30Days` function uses a straightforward date comparison approach for clarity and ease of maintenance.

## How To Re-Implement (Contributor Reference)

1. **Add State for Reminder Preference**: Introduce a state variable (`remindMe`) to the `ExpiryTracker` component to store the user's preference for reminders.
2. **Implement Expiry Date Calculation**: Create a function (`isExpiringWithin30Days`) to determine if a medicine's expiry date is within 30 days from the current date.
3. **Implement Notification Triggering**: Develop a function (`triggerNotification`) to handle the display of browser notifications, including permission checks.
4. **Update UI for Reminder Option**: Add a checkbox to the Expiry Tracker component to allow users to opt-in for reminders.
5. **Integrate with Existing Tracking Logic**: Modify the successful tracking response handler to check for reminders and trigger notifications as needed.

## Impact on System Architecture

This change enhances the user experience by providing proactive reminders, which can lead to better adherence to medicine regimens and overall health outcomes. It also sets a precedent for how we can leverage browser notifications for other timely alerts within the SahiDawa platform, such as appointment reminders or health tips, thereby expanding the platform's capabilities in patient engagement and care.

## Testing & Verification

Testing involved verifying the following scenarios:
- The reminder checkbox appears correctly in the UI.
- Notification permission is requested only when enabling reminders.
- A notification is displayed for medicines expiring within 30 days when reminders are enabled.
- No notification is triggered for medicines expiring after 30 days or when reminders are disabled.
- Existing expiry tracking functionality remains unaffected by the reminder feature.
These tests ensure that the feature works as intended without disrupting the existing workflow of the Expiry Tracker component.