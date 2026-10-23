export const text = (form: FormData, key: string) =>
  String(form.get(key) ?? '').trim()
