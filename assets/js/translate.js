const TRANSLATION_CACHE_KEY = "ryuzen_translation_cache_v3";

const TRANSLATION_LANGUAGE_PAIRS = [
  "en|pt-BR",
  "en|pt"
];

function getTranslationCache() {
  try {
    return JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveTranslationCache(cache) {
  localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache));
}

function createSimpleHash(text) {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return String(hash);
}

function createTranslationCacheId(text, source = "en", target = "pt-BR") {
  return `${source}:${target}:${createSimpleHash(text)}`;
}

function getByteSize(text) {
  return new TextEncoder().encode(text).length;
}

function cleanSynopsisForTranslation(text) {
  if (!text) return "";

  return text
    .replace(/\(Source:.*?\)/gi, "")
    .replace(/\[Written by MAL Rewrite\]/gi, "")
    .replace(/\[Written by.*?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextForTranslation(text, maxBytes = 420) {
  const sentences = text.match(/[^.!?]+[.!?]+|\S.+$/g) || [text];
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const testChunk = (currentChunk + " " + trimmedSentence).trim();

    if (getByteSize(testChunk) <= maxBytes) {
      currentChunk = testChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    if (getByteSize(trimmedSentence) <= maxBytes) {
      currentChunk = trimmedSentence;
      continue;
    }

    const words = trimmedSentence.split(" ");
    let wordChunk = "";

    for (const word of words) {
      const testWordChunk = (wordChunk + " " + word).trim();

      if (getByteSize(testWordChunk) <= maxBytes) {
        wordChunk = testWordChunk;
      } else {
        if (wordChunk) {
          chunks.push(wordChunk);
        }

        wordChunk = word;
      }
    }

    currentChunk = wordChunk;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function isInvalidTranslation(translatedText) {
  if (!translatedText || !translatedText.trim()) return true;

  const upperText = translatedText.trim().toUpperCase();

  const knownApiErrors = [
    "QUERY LENGTH LIMIT EXCEEDED",
    "NO QUERY SPECIFIED",
    "INVALID LANGUAGE PAIR",
    "INVALID SOURCE LANGUAGE",
    "INVALID TARGET LANGUAGE",
    "PLEASE SELECT TWO DISTINCT LANGUAGES"
  ];

  return knownApiErrors.some((errorMessage) => upperText.includes(errorMessage));
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function translateChunkWithLanguagePair(text, langpair) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Erro HTTP na tradução: ${response.status}`);
  }

  const result = await response.json();

  if (result?.responseStatus && Number(result.responseStatus) >= 400) {
    throw new Error(result?.responseDetails || "A API de tradução recusou a requisição.");
  }

  const translatedText = result?.responseData?.translatedText;

  if (isInvalidTranslation(translatedText)) {
    throw new Error(`Tradução inválida retornada pela API: ${translatedText || "vazio"}`);
  }

  return translatedText;
}

async function translateChunkToPortuguese(text) {
  let lastError = null;

  for (const langpair of TRANSLATION_LANGUAGE_PAIRS) {
    try {
      return await translateChunkWithLanguagePair(text, langpair);
    } catch (error) {
      lastError = error;
      console.warn(`Falha ao traduzir com ${langpair}:`, error);
    }
  }

  throw lastError || new Error("Não foi possível traduzir o trecho.");
}

async function translateTextToPortuguese(text) {
  const cleanedText = cleanSynopsisForTranslation(text);

  if (!cleanedText) {
    return null;
  }

  const cache = getTranslationCache();
  const cacheId = createTranslationCacheId(cleanedText);

  if (cache[cacheId]) {
    return cache[cacheId];
  }

  const chunks = splitTextForTranslation(cleanedText, 420);
  const translatedChunks = [];

  for (const chunk of chunks) {
    const translatedChunk = await translateChunkToPortuguese(chunk);
    translatedChunks.push(translatedChunk);

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const translatedText = translatedChunks.join(" ");

  cache[cacheId] = translatedText;
  saveTranslationCache(cache);

  return translatedText;
}