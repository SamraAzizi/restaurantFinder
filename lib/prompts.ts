import { readFileSync } from "fs"
import { join } from "path"

// Cache prompt contents to avoid reading files on every request
const promptCache = new Map<string, string>()

/**
 * Load a prompt template from a file.
 * Prompts are stored in the prompts/ directory as individual .txt files.
 */
function loadPrompt(filename: string): string {
  if (promptCache.has(filename)) {
    return promptCache.get(filename)!
  }

  const promptPath = join(process.cwd(), "prompts", filename)
  const content = readFileSync(promptPath, "utf-8").trim()
  
  promptCache.set(filename, content)
  return content
}

/**
 * Substitute variables in a template string.
 * Variables are marked as {{VARIABLE_NAME}}.
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    result = result.replace(new RegExp(placeholder, "g"), value)
  }
  return result
}

/**
 * Format a list naturally: "A", "A and B", "A, B, and C"
 */
function formatNaturalList(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  const last = items[items.length - 1]
  const rest = items.slice(0, -1).join(", ")
  return `${rest}, and ${last}`
}

/**
 * Get a personalized recommendation prompt.
 */
export function getPersonalizedPrompt(
  cuisines: string[],
  savedNames: string[],
  craving?: string,
): string {
  const template = loadPrompt("personalized.txt")

  // Format cuisines naturally (limit to top 3 for prompt length)
  const cuisineText = formatNaturalList(cuisines.slice(0, 3))

  // Format saved restaurant names naturally (limit to first 3 for readability)
  const savedNamesText = formatNaturalList(savedNames.slice(0, 3))

  // Format craving naturally as a sentence
  const cravingLine = craving && craving.trim().length > 0 ? `I'm craving ${craving}. ` : ""

  return substituteVariables(template, {
    CUISINES: cuisineText,
    CRAVING: cravingLine,
    SAVED_NAMES: savedNamesText,
  })
}

/**
 * Get a fallback prompt for users with weak taste signals.
 */
export function getFallbackPrompt(latitude?: number, longitude?: number): string {
  if (latitude !== undefined && longitude !== undefined) {
    const template = loadPrompt("fallback-with-location.txt")
    return substituteVariables(template, {
      LATITUDE: latitude.toFixed(4),
      LONGITUDE: longitude.toFixed(4),
    })
  }

  return loadPrompt("fallback-no-location.txt")
}