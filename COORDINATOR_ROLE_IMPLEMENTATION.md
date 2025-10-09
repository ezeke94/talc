# Firebase Schema Updates for Coordinator Role

## User Collection Schema

```json
{
  "users": {
    "[userId]": {
      "uid": "string",
      "email": "string",
      "name": "string",
      "displayName": "string",
      "photoURL": "string",
      "role": "string", // Evaluator | Admin | Quality | Management | Coordinator
      "isActive": "boolean",
      "assignedCenters": ["string"], // Array of center IDs/names
      "fcmToken": "string", // For notifications
      "lastLoginAt": "timestamp",
      "createdAt": "timestamp"
    }
  }
}
```

## Role Permissions Matrix

| Feature                | Admin | Quality | Coordinator | Evaluator | Management |
|------------------------|-------|---------|-------------|-----------|------------|
| User Management        | ✅    | ✅      | ❌          | ❌        | ❌         |
| SOP Management         | ✅    | ✅      | ❌          | ❌        | ❌         |
| Forms Management       | ✅    | ✅      | ❌          | ❌        | ❌         |
| KPI Dashboard          | ✅    | ✅      | ❌          | ❌        | ❌         |
| Operational Dashboard  | ✅    | ✅      | ❌          | ❌        | ❌         |
| Record KPIs (Mentors)  | ✅    | ✅      | ❌          | ✅        | ❌         |
| Calendar (View)        | ✅    | ✅      | ✅          | ✅        | ✅         |
| Calendar (Edit)        | ✅    | ✅      | ❌          | ✅        | ❌         |

## Navigation Menu Access

- **Dashboards**: Admin, Quality only (hidden for Coordinator)
- **Calendar**: All roles (view-only for Coordinator, full access for Evaluator)
- **Record KPIs**: Admin, Quality, Evaluator (hidden for Coordinator)
- **App Setup** (SOPs/Forms/Users): Admin, Quality only

## Database Changes Required

1. **No structural changes needed** - the existing user schema already supports the new role
2. **Update existing users** who should be Coordinators:
   ```javascript
   // In Firebase Console or via script
   db.collection('users').doc('[userId]').update({
     role: 'Coordinator'
   });
   ```

3. **Ensure center assignments** for Coordinators:
   ```javascript
   db.collection('users').doc('[coordinatorUserId]').update({
     role: 'Coordinator',
     assignedCenters: ['PHYSIS', 'Whitehouse'] // Example centers
   });
   ```

## Migration Steps

1. Update your Firestore database rules (see firestore.rules below)
2. Update any existing users who should be Coordinators
3. Test the new permissions in your application
4. Verify navigation and access controls work as expected