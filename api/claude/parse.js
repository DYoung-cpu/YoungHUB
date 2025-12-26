const Anthropic = require('@anthropic-ai/sdk').default;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, filename } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Call Claude with vision to analyze the document
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'application/pdf',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analyze this document and extract the following information. Return ONLY valid JSON, no markdown.

Context: This is a family financial document management system for the Young family. The family owns properties at:
- 1085 Acanto Pl, Los Angeles, CA 90049 (primary residence)
- 1808 Manning Ave #202, Los Angeles, CA 90025 (rental)
- 2224 Birchglen St, Unit 111, Simi Valley, CA 93063 (condo)
- 1135 S Hayworth Ave, Los Angeles, CA 90035 (Anita Young's property)

Family members: David Young, Lisa Young, Jacob Young, Noah Young, Anita Young (mother), Coty Coleman (aunt), Marc Young (brother)

Extract and return this JSON structure:
{
  "category": "insurance|mortgage|bank|utility|medical|tax|housing|legal|other",
  "subcategory": "specific type like ho3, heloc, escrow, etc",
  "provider": "company/organization name",
  "account_number": "any account, policy, or reference number",
  "property_address": "if applicable, which property this relates to",
  "due_date": "YYYY-MM-DD format if there's a payment due date",
  "amount_due": numeric amount if there's money owed,
  "document_date": "YYYY-MM-DD date of the document",
  "expiration_date": "YYYY-MM-DD if this is a policy/license that expires",
  "tags": ["relevant", "searchable", "tags"],
  "summary": "2-3 sentence summary of what this document is about",
  "urgency": "low|medium|high|critical - based on due dates and language like FINAL NOTICE",
  "is_final_notice": true/false,
  "extracted_data": {
    "any_other_key_value_pairs": "extracted from document",
    "phone_numbers": [],
    "email_addresses": [],
    "important_dates": [],
    "key_amounts": []
  }
}

Filename provided: ${filename || 'unknown'}

Return ONLY the JSON, no explanation.`,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    let parsedData;
    try {
      // Remove any markdown code blocks if present
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      parsedData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text);
      throw new Error('Failed to parse document analysis');
    }

    return res.status(200).json({
      success: true,
      data: parsedData,
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Document parsing error:', error);
    return res.status(500).json({
      error: 'Failed to parse document',
      message: error.message,
    });
  }
};
