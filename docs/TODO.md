⚠️ Required: Supabase Dashboard Setup
You must enable OAuth providers in Supabase for social login to work:

Go to Supabase Dashboard → Authentication → Providers
Enable Google:
Add OAuth credentials from Google Cloud Console
Set redirect URL: https://your-project.supabase.co/auth/v1/callback
Enable GitHub:
Add OAuth App from GitHub Developer Settings
Set callback URL: https://your-project.supabase.co/auth/v1/callback
