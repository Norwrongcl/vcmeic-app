export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
}
export function validRecordDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value) ||
    !validDate(value.slice(0, 10))
  )
    return false
  return (
    value.length === 10 ||
    (Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60)
  )
}
