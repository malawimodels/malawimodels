# Malawi Models

React, Vite, and Supabase marketplace for talent discovery, agency workflows, client bookings, reviews, and platform administration.

## Run Locally

**Prerequisites:** Node.js


1. Install dependencies:
   `npm install`
2. Create [.env.local](.env.local) with the Supabase public anon key, Supabase URL, Cloudinary cloud name, and unsigned Cloudinary upload presets.
3. Run the app:
   `npm run dev`

Never place service-role keys, Cloudinary API secrets, or private API keys in Vite/client environment variables.
