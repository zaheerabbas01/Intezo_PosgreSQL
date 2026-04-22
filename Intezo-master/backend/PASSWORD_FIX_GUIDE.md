# Password Migration Fix Guide

## Problem
When migrating from MongoDB to PostgreSQL, passwords were double-hashed because:
1. MongoDB stored bcrypt-hashed passwords
2. During migration, Sequelize's `beforeSave` hook hashed them again
3. Now original passwords don't work - only the double-hashed values work

## Solution

### Step 1: Fix the Models (Already Done ✅)
Updated `Clinic.js` and `Doctor.js` models to accept a `skipPasswordHash` option during migration.

### Step 2: Run the Password Fix Script

Run this command to restore the original password hashes from MongoDB:

```bash
cd backend
node fix-migrated-passwords.js
```

This script will:
- Connect to both MongoDB and PostgreSQL
- Copy the original bcrypt hashes from MongoDB to PostgreSQL
- Use raw SQL queries to bypass the `beforeSave` hook
- Preserve password security

### Step 3: Verify the Fix

After running the fix script, test login with your original passwords.

## Alternative: Fresh Migration

If you prefer to re-migrate all data:

1. **Clear PostgreSQL data:**
   ```bash
   node clear-db.js
   ```

2. **Run migration with fixed code:**
   ```bash
   node migrate.js
   ```

The updated `migrate.js` now uses `{ skipPasswordHash: true }` option.

## Security Notes

✅ **Security is maintained** because:
- Original bcrypt hashes from MongoDB are preserved
- No passwords are stored in plain text
- The bcrypt algorithm remains the same
- Password comparison still uses bcrypt.compare()

## How It Works

### Before Fix:
```
User enters: "mypassword123"
MongoDB had: "$2b$10$abc..." (bcrypt hash)
PostgreSQL got: "$2b$10$xyz..." (double-hashed)
Login fails ❌
```

### After Fix:
```
User enters: "mypassword123"
MongoDB had: "$2b$10$abc..." (bcrypt hash)
PostgreSQL now has: "$2b$10$abc..." (same hash)
Login succeeds ✅
```

## Future Registrations

New users registering after this fix will work correctly because:
- The `beforeSave` hook only runs when `skipPasswordHash` is NOT set
- Normal registration doesn't use this option
- Passwords are properly hashed once during registration

## Troubleshooting

If passwords still don't work after running the fix:

1. **Check if the fix script ran successfully:**
   ```bash
   node fix-passwords.js
   ```
   This will verify all passwords are valid bcrypt hashes.

2. **Verify MongoDB connection:**
   Make sure `MONGO_URI` in `.env` is correct.

3. **Check PostgreSQL connection:**
   Verify `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` in `.env`.

4. **Test with a specific user:**
   Try logging in with the email and password you used during signup in MongoDB.

## Questions?

If you encounter any issues, check:
- MongoDB is still accessible with the original data
- PostgreSQL connection is working
- No typos in email addresses when testing login
