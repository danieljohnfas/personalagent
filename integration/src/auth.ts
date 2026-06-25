import { Router } from 'express';
import { db } from './db/client.js';
import { oauthConnections } from './db/schema.js';

export const authRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// Redirect URI goes back to Orchestrator or Interface, but for simplicity we'll have Google hit Integration directly
// and Integration redirects back to the Dashboard.
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/api/auth/google/callback';

authRouter.get('/google/url', (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(400).json({ error: 'GOOGLE_CLIENT_ID not configured' });
  }

  // Scopes needed for basic profile and email, plus potentially Drive or Gmail later if configured
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
  
  res.json({ url });
});

authRouter.get('/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code parameter');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData: any = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).send(`OAuth Error: ${tokenData.error_description}`);
    }

    const { access_token, refresh_token } = tokenData;

    // Get user info to know WHICH account this is
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const userData: any = await userResponse.json();

    if (!userData.email) {
      return res.status(400).send('Could not retrieve email from Google');
    }

    // Save to database
    await db.insert(oauthConnections).values({
      provider: 'google',
      accountEmail: userData.email,
      accessToken: access_token,
      refreshToken: refresh_token || null, // Might be null if user previously consented
    });

    // Redirect user back to the interface dashboard
    const interfaceUrl = process.env.INTERFACE_URL || 'http://localhost:3000';
    res.redirect(`${interfaceUrl}/dashboard`);
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    res.status(500).send('Internal Server Error during OAuth callback');
  }
});

authRouter.get('/connections', async (req, res) => {
  try {
    const connections = await db.select({
      id: oauthConnections.id,
      provider: oauthConnections.provider,
      accountEmail: oauthConnections.accountEmail,
      createdAt: oauthConnections.createdAt
    }).from(oauthConnections);
    res.json(connections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
