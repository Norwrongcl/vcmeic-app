import {
  type ActivityInput,
  type AgreementInput,
  type ContactInput,
  type EvidenceLink,
  type PartnerInput,
  type ResourceInput,
} from './types'

export type ValidationErrors<T> = Partial<Record<keyof T, string>>
export type EvidenceValidationErrors = Partial<
  Record<keyof EvidenceLink, string>
>

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hasValidOptionalEmail(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function validateEvidenceLinks(
  evidences: EvidenceLink[]
): EvidenceValidationErrors[] {
  return evidences.map((evidence) => {
    const errors: EvidenceValidationErrors = {}
    if (!evidence.name.trim()) {
      errors.name = 'Ingresa un nombre para la evidencia.'
    }
    if (!isHttpUrl(evidence.url.trim())) {
      errors.url = 'Ingresa un enlace válido.'
    }
    return errors
  })
}

export function validateActivity(
  input: ActivityInput,
  now = new Date()
): ValidationErrors<ActivityInput> {
  const errors: ValidationErrors<ActivityInput> = {}
  if (!input.name.trim()) errors.name = 'Ingresa un nombre.'
  if (!input.startsAt) errors.startsAt = 'Selecciona una fecha de inicio.'
  if (!input.endsAt) errors.endsAt = 'Selecciona una fecha de término.'
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
    errors.endsAt = 'La fecha de término no puede ser anterior al inicio.'
  } else if (input.endsAt && new Date(input.endsAt).getTime() > now.getTime()) {
    errors.endsAt = 'La actividad debe haber finalizado.'
  }
  if (!input.responsibleContactId) {
    errors.responsibleContactId = 'Selecciona una persona responsable.'
  }
  if (!Number.isInteger(input.participantCount) || input.participantCount < 0) {
    errors.participantCount = 'Ingresa una cantidad total válida.'
  }
  if (
    validateEvidenceLinks(input.evidences).some(
      (item) => Object.keys(item).length
    )
  ) {
    errors.evidences = 'Revisa los datos de las evidencias.'
  }
  return errors
}

export function validateContact(
  input: ContactInput
): ValidationErrors<ContactInput> {
  const errors: ValidationErrors<ContactInput> = {}
  if (!input.name.trim()) errors.name = 'Ingresa un nombre.'
  if (!hasValidOptionalEmail(input.email)) {
    errors.email = 'Ingresa un correo válido.'
  }
  return errors
}

export function validatePartner(
  input: PartnerInput
): ValidationErrors<PartnerInput> {
  const errors: ValidationErrors<PartnerInput> = {}
  if (!input.name.trim()) errors.name = 'Ingresa un nombre.'
  if (!hasValidOptionalEmail(input.email)) {
    errors.email = 'Ingresa un correo válido.'
  }
  if (input.website.trim() && !isHttpUrl(input.website.trim())) {
    errors.website = 'Ingresa un sitio web válido.'
  }
  return errors
}

export function validateAgreement(
  input: AgreementInput
): ValidationErrors<AgreementInput> {
  const errors: ValidationErrors<AgreementInput> = {}
  if (!input.name.trim()) errors.name = 'Ingresa un nombre.'
  if (!input.partnerId) errors.partnerId = 'Selecciona un socio.'
  if (!input.startsAt) errors.startsAt = 'Selecciona una fecha de inicio.'
  if (input.endsAt && input.startsAt && input.endsAt < input.startsAt) {
    errors.endsAt = 'La fecha de término no puede ser anterior al inicio.'
  }
  if (input.documentUrl.trim() && !isHttpUrl(input.documentUrl.trim())) {
    errors.documentUrl = 'Ingresa un enlace válido.'
  }
  return errors
}

export function validateResource(
  input: ResourceInput
): ValidationErrors<ResourceInput> {
  const errors: ValidationErrors<ResourceInput> = {}
  if (!input.name.trim()) errors.name = 'Ingresa un nombre.'
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    errors.quantity = 'Ingresa una cantidad disponible válida.'
  }
  return errors
}
