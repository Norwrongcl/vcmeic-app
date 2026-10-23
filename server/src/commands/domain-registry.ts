import { registerArchives } from './archive.ts'
import { CommandRegistry } from './registry.ts'
import { registerImports } from '../imports/apply.ts'
import { registerIndicators } from '../reporting/indicators.ts'
import { registerCuts } from '../reporting/cuts.ts'
import { registerCampaigns } from '../communications/campaigns.ts'
import { registerContents } from '../communications/contents.ts'
import { registerPackages } from '../communications/packages.ts'
import { registerFinance } from '../operations/finance.ts'
import { registerDecisions } from '../operations/decisions.ts'
import { registerPlanning } from '../operations/planning.ts'
import { registerMasters } from '../operations/masters.ts'
import { registerProjects } from '../operations/projects.ts'
import { registerMandates } from '../operations/mandates.ts'
import { registerCases } from '../cases/cases.service.ts'
export function createDomainRegistry() {
  const registry = new CommandRegistry()
  registerCases(registry)
  registerMasters(registry)
  registerProjects(registry)
  registerMandates(registry)
  registerFinance(registry)
  registerDecisions(registry)
  registerPlanning(registry)
  registerCampaigns(registry)
  registerContents(registry)
  registerPackages(registry)
  registerIndicators(registry)
  registerCuts(registry)
  registerImports(registry)
  registerArchives(registry)
  return registry
}
