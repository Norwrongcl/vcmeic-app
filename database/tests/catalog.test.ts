import { it, expect } from 'vitest'
import fields from '../catalog/fields.json' with { type: 'json' }
import states from '../catalog/states.json' with { type: 'json' }
it('maps official fields without losing planned and actual meanings', () => {
  const p = fields.filter((f) => f.schemaVersion === 'p52-2026.09-v1')
  expect(p).toHaveLength(49)
  expect(new Set(p.map((f) => f.key)).size).toBe(49)
  expect(p.find((f) => f.key === 'studentsPlanned')?.valueType).toBe('number')
  expect(p.find((f) => f.key === 'studentsActual')?.valueType).toBe('number')
  expect(states.presenceTypes).toHaveLength(7)
  expect(new Set(states.presenceTypes).size).toBe(7)
})
