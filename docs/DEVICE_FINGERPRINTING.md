# Device Duplicate Detection - How It Works

## The Problem

When users enable/disable notifications multiple times, or when FCM tokens refresh, Firebase can issue **new tokens for the same physical device**. This creates multiple device records in Firestore:

### Example: Same Device, Different Tokens

```javascript
// User's Android phone - two different tokens
devices/
  ├── dCSejMMX9...APA91bHxrGmAM... // Token 1 (Oct 9)
  └── dCSejMMX9...APA91bG5GW_ha4... // Token 2 (Oct 10) - Same device!
```

**How we know it's the same device:**
- ✅ Same `userAgent`: "Mozilla/5.0 (Linux; Android 10; K)..."
- ✅ Same `platform`: "Linux armv81"
- ❌ Different `token`: FCM refreshed the token

## The Solution

### Device Fingerprinting

The cleanup tool uses **device fingerprinting** to identify the same physical device:

```javascript
// Create unique fingerprint for each device
const fingerprint = `${userAgent}_${platform}`;

// Example fingerprints:
"Mozilla/5.0 (Linux; Android 10; K)..._Linux armv81"  // Android phone
"Mozilla/5.0 (Windows NT 10.0)..._Win32"              // Windows PC
"Mozilla/5.0 (iPhone; CPU iPhone)..._iOS"             // iPhone
```

### Detection Algorithm

```javascript
1. For each user, get all devices
2. Create fingerprint: userAgent + platform
3. Group devices by fingerprint
4. If multiple devices have same fingerprint:
   - Sort by lastSeenAt (most recent first)
   - Keep the most recent token
   - Delete older tokens
```

### Why This Works

**FCM Token Refresh:**
- Same device can get new token when:
  - App reinstalled
  - Cache cleared
  - Token expires
  - User toggles notifications

**Device Fingerprint Stays Same:**
- `userAgent` doesn't change (same browser/app version)
- `platform` doesn't change (same OS)
- Only the `token` changes

## Example Cleanup

### Before Cleanup

```javascript
users/oQnOs84X3Jd4DmwZ6qdSBAO9HT32/devices/

// Same Android device - 2 tokens
├── dCSejMMX9...APA91bHxrGmAM-hg5cAlK0HQbaVP_wfnB... {
│     token: "dCSejMMX9...APA91bHxrGmAM...",
│     userAgent: "Mozilla/5.0 (Linux; Android 10; K)...",
│     platform: "Linux armv81",
│     lastSeenAt: Oct 9, 2025 12:01:31 PM,
│     enabled: true
│   }
│
└── dCSejMMX9...APA91bG5GW_ha4XSn63QIBocsio_xZXri... {
      token: "dCSejMMX9...APA91bG5GW_ha4...",
      userAgent: "Mozilla/5.0 (Linux; Android 10; K)...", // Same!
      platform: "Linux armv81",                            // Same!
      lastSeenAt: Oct 10, 2025 2:45:54 PM,               // More recent
      enabled: true
    }
```

**Analysis:**
- Fingerprint: `"Mozilla/5.0 (Linux; Android 10; K)..._Linux armv81"`
- Match found: 2 devices with same fingerprint
- Most recent: Oct 10, 2025 2:45:54 PM
- Action: Keep Oct 10 token, delete Oct 9 token

### After Cleanup

```javascript
users/oQnOs84X3Jd4DmwZ6qdSBAO9HT32/devices/

// Only the most recent token remains
└── dCSejMMX9...APA91bG5GW_ha4XSn63QIBocsio_xZXri... {
      token: "dCSejMMX9...APA91bG5GW_ha4...",
      userAgent: "Mozilla/5.0 (Linux; Android 10; K)...",
      platform: "Linux armv81",
      lastSeenAt: Oct 10, 2025 2:45:54 PM,  ✅ Most recent
      enabled: true
    }
```

## Edge Cases Handled

### 1. User Has Multiple Actual Devices

```javascript
devices/
  ├── token1 { userAgent: "Android...", platform: "Linux" }     // Phone
  └── token2 { userAgent: "Windows...", platform: "Win32" }     // Laptop
```

**Result:** Both kept (different fingerprints) ✅

### 2. Same Device, Token Never Changed

```javascript
devices/
  └── token1 { userAgent: "Android...", platform: "Linux" }     // Phone
```

**Result:** No duplicates, nothing removed ✅

### 3. Same Device, 5 Old Tokens

```javascript
devices/
  ├── token1 { lastSeenAt: Oct 1 }  // Oldest
  ├── token2 { lastSeenAt: Oct 3 }
  ├── token3 { lastSeenAt: Oct 5 }
  ├── token4 { lastSeenAt: Oct 7 }
  └── token5 { lastSeenAt: Oct 10 } // Most recent
```

**Result:** Keeps token5, removes token1-4 ✅

### 4. Device with Missing UserAgent

```javascript
devices/
  ├── token1 { userAgent: null, platform: "Linux" }
  └── token2 { userAgent: null, platform: "Linux" }
```

**Result:** Grouped as `"unknown_Linux"`, keeps most recent ✅

## Benefits

### Before (Token-Based Detection)
❌ Misses duplicates when token changes
❌ Accumulates old tokens over time
❌ Multiple notifications to same device
❌ Wastes Firestore storage

### After (Fingerprint-Based Detection)
✅ Detects same device with different tokens
✅ Cleans up old tokens automatically
✅ One notification per physical device
✅ Minimal Firestore storage

## Limitations

### What This Doesn't Catch

1. **Browser Updates**: If userAgent changes significantly
   ```javascript
   // Before update
   "Mozilla/5.0 (Linux; Android 10; K) Chrome/141.0.0.0"
   
   // After major browser update (might be treated as different device)
   "Mozilla/5.0 (Linux; Android 11; K) Chrome/142.0.0.0"
   ```

2. **OS Upgrades**: Platform string changes
   ```javascript
   "Linux armv81"  →  "Linux armv82"  // Different platform
   ```

3. **Incognito/Private Mode**: Different userAgent
   ```javascript
   "Chrome/141.0.0.0"  →  "Chrome/141.0.0.0 (Private)"
   ```

**Solution:** These are rare cases. The tool is safe and conservative - it only removes when there's a clear match.

## Safety Features

1. **Conservative Matching**: Only removes when fingerprint is identical
2. **Keeps Most Recent**: Always preserves the newest token
3. **Non-Destructive**: Doesn't affect devices with unique fingerprints
4. **Detailed Logging**: Shows exactly what's being removed

## Testing

To verify it works correctly:

```javascript
// 1. Check before cleanup
console.log(await getDocs(collection(db, 'users', userId, 'devices')));
// Should see multiple devices with same userAgent/platform

// 2. Run cleanup tool

// 3. Check after cleanup
console.log(await getDocs(collection(db, 'users', userId, 'devices')));
// Should see only one device per unique userAgent/platform combination
```

## Logs Example

```
[14:45:30] Starting duplicate device cleanup...
[14:45:31] Found 50 users to process
[14:45:32] Processing user 1/50: oQnOs84X3Jd4DmwZ6qdSBAO9HT32
[14:45:32]   Found 5 devices
[14:45:32]   Found 2 tokens for same device: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit...
[14:45:33]     ✓ Removed old token 1/1: dCSejMMX9...APA91bHxrGmAM...
[14:45:34] Processing user 2/50: KvLrqmzHcSMdIUBy31reZxEKHT...
[14:45:34]   Found 1 devices
[14:45:35] Cleanup complete! Total duplicates removed: 1
```

## Conclusion

The updated cleanup tool now correctly identifies duplicates by **device fingerprint** (userAgent + platform) instead of just token, solving the issue where FCM token refresh created multiple device records for the same physical device.
