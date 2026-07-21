// Cloudflare Pages Function - OAuth callback for Decap CMS
// Receives the GitHub code, exchanges it for an access token,
// and passes the token back to the CMS via postMessage

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return new Response('Missing code parameter', { status: 400 });
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: code,
    }),
  });

  const tokenData = await tokenResponse.json();
  const token = tokenData.access_token;

  if (!token) {
    return new Response('Failed to get access token', { status: 500 });
  }

  // Return HTML that passes the token to Decap CMS via postMessage
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Authorizing...</title></head>
<body>
<p>Authorizing...</p>
<script>
  window.opener.postMessage(
    'authorization:github:success:{"provider":"github","token":"${token}"}',
    '*'
  );
  setTimeout(function() { window.close(); }, 100);
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
