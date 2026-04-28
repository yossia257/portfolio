export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/proxy/yahoo/')) {
      return new Response('Not found', { status: 404 });
    }

    const ticker = url.pathname.replace('/proxy/yahoo/', '');

    // Forward any query params from the dashboard (e.g. ?interval=1d&range=3mo)
    // Fall back to 5-day range if none supplied (daily price use case)
    const params = url.searchParams.toString();
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}${params ? '?' + params : '?interval=1d&range=5d'}`;

    const resp = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });

    const body = await resp.text();

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
