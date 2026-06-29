// /api/lead.js
//
// This function runs on Vercel's servers — never in the visitor's browser —
// so your Kit API key stays private. The quiz calls this endpoint, and this
// function calls Kit on your behalf.
//
// Required setup in Vercel (see DEPLOY-INSTRUCTIONS.md):
//   Environment variable: KIT_API_KEY = your secret Kit API key
//
// Required setup in Kit:
//   A custom field named exactly: Quiz Results
//   (Settings -> Custom Fields -> Add Field)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow the quiz page (running on any domain) to call this endpoint.
  // If you want to restrict this to only your own website later,
  // replace '*' with your domain, e.g. 'https://yourdomain.com'
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { name, email, summary, resultPackage } = req.body;

    if (!email || !summary) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Build one readable text block from all 9 Q&As + their result.
    // This is what lands in the "Quiz Results" custom field in Kit.
    const lines = summary.map((item, i) =>
      `Q${i + 1}: ${item.question}\nA: ${item.answer || '(skipped)'}`
    );
    const quizResultsText =
      `Recommended package: ${resultPackage || 'N/A'}\n\n` + lines.join('\n\n');

    const KIT_API_KEY = process.env.KIT_API_KEY;

    if (!KIT_API_KEY) {
      console.error('KIT_API_KEY environment variable is not set.');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    // Create or update the subscriber in Kit, setting the custom field.
    const kitResponse = await fetch('https://api.kit.com/v4/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': KIT_API_KEY
      },
      body: JSON.stringify({
        email_address: email,
        first_name: name || '',
        fields: {
          'Quiz Results': quizResultsText
        }
      })
    });

    const kitData = await kitResponse.json();

    if (!kitResponse.ok) {
      console.error('Kit API error:', kitData);
      return res.status(502).json({ error: 'Failed to save lead to Kit', details: kitData });
    }

    return res.status(200).json({ success: true, kit: kitData });

  } catch (err) {
    console.error('Lead submission error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
