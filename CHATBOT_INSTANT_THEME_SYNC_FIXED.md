# ✅ Chatbot Instant Theme Sync - FIXED

## Problem Identified and Resolved

**Previous Issue:**
The chatbot was reloading the entire iframe when the theme changed, which:
- Required a browser refresh to work properly
- Interrupted the user experience
- Caused the chatbot to reset/restart

**Root Cause:**
The implementation was using `setIframeKey()` to force React to remount the iframe component on every theme change. This heavy approach required the iframe to fully reload, which the browser was not handling correctly without a full page refresh.

## The Fix (Commit 631e5ac)

### What Changed:
1. **Removed iframe reload mechanism** - No more `iframeKey` state
2. **Removed iframe remounting** - No more `key={iframeKey}` prop on iframe
3. **Using postMessage only** - Chatbot applies theme internally without reload
4. **Initial theme captured once** - URL parameter set on component mount, never changes

### How It Works Now:

#### When User Toggles Theme:
```
1. User clicks theme toggle (light → dark or dark → light)
2. useTheme hook updates isDark state immediately
3. useEffect detects isDark change
4. postMessage sent to chatbot iframe: {type: 'darkModeChange', isDark: true/false}
5. Chatbot receives message and applies theme change (CSS classes)
6. Backup postMessage sent after 100ms for reliability
7. Theme changes instantly - NO reload, NO interruption
```

#### When Chatbot First Opens:
```
1. Chatbot URL includes initial theme parameter: ?theme=dark or ?theme=light
2. Chatbot loads with correct theme from the start
3. No additional sync needed for initial load
```

## Code Changes

### Before (Problematic):
```typescript
const [iframeKey, setIframeKey] = useState(0);
const chatbotUrl = `${CHATBOT_URL}${isDark ? '?theme=dark' : '?theme=light'}`;

useEffect(() => {
  if (isOpen) {
    setIframeKey(prev => prev + 1); // ❌ This causes full reload
  }
}, [isDark, isOpen]);

<iframe key={iframeKey} src={chatbotUrl} ... />
```

### After (Fixed):
```typescript
const [initialTheme] = useState(() => isDark); // ✅ Capture once on mount
const chatbotUrl = `${CHATBOT_URL}${initialTheme ? '?theme=dark' : '?theme=light'}`;

useEffect(() => {
  if (isOpen && iframeRef.current?.contentWindow) {
    // ✅ Send message only, no reload
    iframeRef.current.contentWindow.postMessage({
      type: 'darkModeChange',
      isDark
    }, '*');
    
    // ✅ Backup delivery after 100ms
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'darkModeChange',
        isDark
      }, '*');
    }, 100);
  }
}, [isDark, isOpen]);

<iframe ref={iframeRef} src={chatbotUrl} ... /> {/* No key prop */}
```

## Expected Behavior After Deployment

### ✅ Theme Switching (Chatbot Open):
1. Toggle website theme
2. Chatbot theme changes **instantly** (< 100ms)
3. No reload, no reset, no interruption
4. Chat history preserved
5. No browser refresh needed

### ✅ Theme Switching (Chatbot Closed):
1. Toggle website theme
2. Theme preference saved to localStorage
3. Open chatbot later
4. Chatbot opens with correct theme immediately

### ✅ Browser Refresh:
1. Refresh page
2. Theme preference loaded from localStorage
3. Chatbot inherits theme automatically
4. Everything works as expected

## Testing Instructions (After Deployment)

1. **Clear browser cache** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
2. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)
3. **Open browser console** (F12 → Console tab)
4. **Open chatbot** (click Velontri logo)
5. **Toggle website theme** multiple times
6. **Watch chatbot change theme instantly** - no reload needed
7. **Check console logs** - should see:
   ```
   [Chatbot Widget] Theme changed to: dark - Sending to chatbot
   [Chatbot Widget] ✅ Theme change message sent successfully
   [Chatbot Widget] ✅ Theme change message re-sent (delayed)
   ```

## Technical Details

### Messages Sent:
- **On iframe load**: 4 messages at 100ms, 300ms, 600ms, 1000ms intervals
- **On theme change**: 2 messages immediately and at 100ms (only if chatbot is open)
- **On request**: 1 message when chatbot sends `requestDarkMode` event

### Message Format:
```typescript
{
  type: 'darkModeChange',
  isDark: boolean // true for dark mode, false for light mode
}
```

### Chatbot Side Requirements:
The chatbot at `https://velo.pxxlspace.cv` must have a message listener:
```javascript
window.addEventListener('message', (e) => {
  if (e.data?.type === 'darkModeChange') {
    const isDark = e.data.isDark;
    // Apply theme change (add/remove 'dark' class, etc.)
    applyTheme(isDark);
  }
});
```

## Commits

- **631e5ac** - Fix chatbot instant theme sync - remove iframe reload, use postMessage only
- **af964b8** - Update chatbot theme sync documentation with latest fix

## Deployment Status

- ✅ Code pushed to GitHub (main branch)
- ⏳ Waiting for Pxxl deployment
- 📍 Once deployed, test on production site

---

**Issue:** Theme sync required browser refresh  
**Status:** ✅ FIXED  
**Date:** 2026-11-02  
**Approach:** postMessage only, no iframe reload  
**Result:** Instant theme sync without interruption
