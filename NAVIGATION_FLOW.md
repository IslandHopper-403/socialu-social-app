# Overlay Navigation Hierarchy

## Z-Index Layers

| Layer | Range | Purpose | Examples |
|-------|-------|---------|----------|
| **Base** | 0-99 | App structure & chrome | Bottom nav, header |
| **Overlays** | 100-299 | Modal screens | Profiles, chats, messages |
| **Floating** | 300-399 | Persistent UI elements | Settings, carousels |
| **System** | 400+ | Critical system UI | Modals, auth, loading |

## CSS Variable Reference

```css
/* From design-system.css */
--z-overlay-base: 100;
--z-business-profile: 150;
--z-overlay-profile: 150;
--z-overlay-chat: 200;
--z-settings: 350;
--z-modal: 400;
--z-auth-portal: 500;
--z-loading: 600;
```

## User Navigation Flows

### Flow 1: User Portal (User → Business)

```
Feed (z-index: 0)
  └─ Business Profile (#businessProfile, z-index: 150)
       └─ Individual Chat (#individualChat, z-index: 200)
            [Back Button] → Business Profile (150)
                 [Back Button] → Feed (0)
```

**Overlay Stack:**
- Open profile: `['businessProfile']`
- Open chat: `['businessProfile', 'individualChat']`
- Close chat: `['businessProfile']`
- Close profile: `[]`

---

### Flow 2: Business Dashboard (Business → Customer)

```
Business Dashboard (z-index: 0)
  └─ Business Messages (#businessMessages, z-index: 150)
       └─ Individual Chat (#individualChat, z-index: 200)
            [Back Button] → Business Messages (150)
                 [Back Button] → Dashboard (0)
```

**Overlay Stack:**
- Open messages: `['businessMessages']`
- Open chat: `['businessMessages', 'individualChat']`
- Close chat: `['businessMessages']`
- Close messages: `[]`

---

### Flow 3: Dashboard to Recent Messages (Quick Access)

```
Business Dashboard (z-index: 0)
  └─ Individual Chat (#individualChat, z-index: 200)
       [Back Button] → Dashboard (0)
```

**Overlay Stack:**
- Open chat: `['individualChat']`
- Close chat: `[]`

**Note:** When opening chat directly from dashboard "Recent Messages", the business messages overlay is NOT in the stack.

---

## Z-Index Calculation Rule

**Formula:** `Child Z-Index = Parent Z-Index + 50`

**Examples:**
- Feed (0) → Profile (0 + 50 = 50... rounded to 150 for breathing room)
- Profile (150) → Chat (150 + 50 = 200)
- Chat (200) → Modal (200 + 50 = 250... or use system modal at 400)

**Why +50?** Provides buffer space for potential intermediate overlays without refactoring entire hierarchy.

---

## Adding New Overlays (Step-by-Step)

### 1. Identify Parent Overlay

Determine where the new overlay opens from:
- From feed? Parent z-index = 0
- From profile? Parent z-index = 150
- From chat? Parent z-index = 200

### 2. Calculate Z-Index

```
New Overlay Z-Index = Parent Z-Index + 50
```

### 3. Update `css/design-system.css`

Add new variable to appropriate layer:

```css
/* Overlay Layer (100-299) */
--z-your-new-overlay: 250;  /* FROM: chat (200) */
```

### 4. Apply to CSS Rule

In `css/main.css`:

```css
#yourNewOverlay.overlay-screen {
    z-index: var(--z-your-new-overlay);
}
```

### 5. Update Navigation Stack

In JavaScript, ensure `showOverlay()` is called:

```javascript
this.navigationManager.showOverlay('yourNewOverlay');
```

### 6. Update This Documentation

Add your new overlay to the appropriate flow diagram above.

### 7. Test Navigation

- Open parent overlay → Open new overlay
- Click back from new overlay → Should return to parent
- Click back from parent → Should return to previous screen
- Check console: Verify overlay stack is correct

---

## Troubleshooting

### Problem: Back button skips an overlay

**Cause:** Overlay not added to navigation stack

**Fix:** Ensure `navigationManager.showOverlay()` is called when opening

---

### Problem: Overlay appears behind another overlay

**Cause:** Z-index too low or CSS conflict

**Fix:** 
1. Check computed z-index in DevTools
2. Verify CSS variable is defined
3. Ensure no inline `style.zIndex` overrides

---

### Problem: Multiple overlays close at once

**Cause:** Event propagation or duplicate event listeners

**Fix:** Add `event.stopPropagation()` to back button handlers

---

## CSS vs JavaScript Z-Index

### Use CSS (Preferred)
- Predictable parent-child relationships
- Static overlay flows
- Well-documented in this file

### Use JavaScript (Only if necessary)
- Dynamic overlay stacking
- Unknown parent z-index at compile time
- Complex conditional flows

**Example of when JavaScript is needed:**
```javascript
// Only if parent overlay z-index is not known
const maxZ = Math.max(...visibleOverlays.map(el => getZIndex(el)));
overlay.style.zIndex = maxZ + 50;
```

---

## Current Implementation Status

- [x] Business Profile → Chat flow working
- [x] Business Messages → Chat flow working
- [x] Dashboard Recent Messages → Chat flow working
- [x] All inline z-index JavaScript removed
- [x] CSS variables control all stacking
- [x] Navigation stack properly maintained

---

## Maintenance Notes

**Last Updated:** [Current Date]

**When to update this file:**
- Adding any new overlay screen
- Changing overlay hierarchy
- Modifying z-index values
- Fixing navigation bugs

**Review frequency:** Every time a new overlay is added to the app
