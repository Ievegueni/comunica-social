import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

interface GeneratePostsInput {
  briefing: string;
  tone: string;
  count: number;
  platform?: string;
  language?: string;
}

interface GeneratedPost {
  content: string;
  hashtags: string[];
  suggestedTime?: string;
}

export async function generatePosts(input: GeneratePostsInput): Promise<GeneratedPost[]> {
  const { briefing, tone, count, platform = 'ambas', language = 'portugues' } = input;

  const systemPrompt = `Es um especialista em social media marketing para o mercado PALOP (Angola, Mocambique, Cabo Verde).
Geras conteudo criativo e envolvente para redes sociais.
Responde SEMPRE em ${language}.
O teu output e SEMPRE JSON valido, sem texto extra.`;

  const userPrompt = `Gera ${count} posts para redes sociais com base neste briefing:

BRIEFING: ${briefing}

TOM: ${tone}
PLATAFORMA: ${platform}
IDIOMA: ${language}

Regras:
- Cada post deve ser unico e diferente
- Inclui hashtags relevantes (3-5 por post)
- Para Instagram: maximo 2200 caracteres
- Para Facebook: maximo 63206 caracteres
- Adapta o estilo ao tom pedido
- Sugere um horario ideal de publicacao (formato HH:MM)

Responde com um array JSON:
[
  {
    "content": "texto do post (sem hashtags no corpo)",
    "hashtags": ["hashtag1", "hashtag2"],
    "suggestedTime": "10:00"
  }
]`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let posts: GeneratedPost[];
  try {
    posts = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${jsonText.slice(0, 200)}`);
  }

  if (!Array.isArray(posts)) {
    throw new Error('Invalid response format from Claude: expected array');
  }

  return posts.slice(0, count);
}
