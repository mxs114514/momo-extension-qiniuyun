import {
  DeepSeekSummaryGenerator,
  parseDeepSeekSummaryConfig,
} from './deepseek-summary-generator'
import { SessionHistoryStore } from './history-store'

const deepSeekSummaryConfig = parseDeepSeekSummaryConfig(import.meta.env)

export const sessionHistoryStore = new SessionHistoryStore({
  summaryGenerator: deepSeekSummaryConfig.enabled
    ? new DeepSeekSummaryGenerator({
        apiKey: deepSeekSummaryConfig.apiKey,
        model: deepSeekSummaryConfig.model,
      })
    : undefined,
})
