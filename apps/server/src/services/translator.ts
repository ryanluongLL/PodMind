import * as deepl from "deepl-node"

/// The only place that talks to DeepL. Routes call translateWord, and tests
/// replace this whole module with a fake, so no test ever spends API credit.
/// The client is created on first use, so the server can start (and the rest
/// of the app keeps working) even when DEEPL_API_KEY is missing.
///
/// DEEPL_SERVER_URL is normally unset, which means the real DeepL API. The
/// end to end tests point it at a local fake that answers the same way.

let translator: deepl.Translator | null = null

function getTranslator(): deepl.Translator {
  if (translator === null) {
    const key = process.env.DEEPL_API_KEY
    if (!key) {
      throw new Error("DEEPL_API_KEY is not set")
    }
    const serverUrl = process.env.DEEPL_SERVER_URL
    if (serverUrl) {
      translator = new deepl.Translator(key, { serverUrl })
    } else {
      translator = new deepl.Translator(key)
    }
  }
  return translator
}

/// DeepL needs a regional variant for a few target languages
export function toDeepLTarget(code: string): deepl.TargetLanguageCode {
  if (code === "pt") {
    return "pt-BR"
  }
  if (code === "en") {
    return "en-US"
  }
  return code as deepl.TargetLanguageCode
}

/// Translates one word, using the sentence around it so DeepL picks the
/// right meaning ("bank" by a river versus "bank" for money).
export async function translateWord(word: string, context: string, targetLang: string): Promise<string> {
  const result = await getTranslator().translateText(word, "en", toDeepLTarget(targetLang), { context })
  if (Array.isArray(result)) {
    return result[0]?.text ?? ""
  }
  return result.text
}