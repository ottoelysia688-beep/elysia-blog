// Cloudflare Pages Function - OAuth proxy for Decap CMS
// This handles the GitHub OAuth flow that Decap CMS needs

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;
  const redirectUri = `${url.origin}/callback`;
  
  // Redirect to GitHub authorization page
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${Math.random().toString(36).substring(7)}`;
  
  return Response.redirect(githubUrl, 302);
}
