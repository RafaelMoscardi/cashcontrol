/* Erros do Supabase (Auth e PostgREST) em português claro. */

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  user_already_exists: 'Já existe uma conta com este e-mail. Tente entrar.',
  email_exists: 'Já existe uma conta com este e-mail. Tente entrar.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  over_email_send_rate_limit: 'Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  validation_failed: 'Confira o e-mail digitado.',
  email_address_invalid: 'Este e-mail não é aceito. Use outro endereço.',
  session_not_found: 'Sua sessão expirou. Entre de novo.',
  refresh_token_not_found: 'Sua sessão expirou. Entre de novo.',
  bad_jwt: 'Sua sessão expirou. Entre de novo.',
  otp_expired: 'O link expirou ou já foi usado. Peça um novo.',
  reauthentication_needed: 'Por segurança, saia e entre de novo antes de trocar a senha.',
  signup_disabled: 'Cadastros estão desativados no momento.',
}

/** Nomes das restrições do banco (supabase/migrations) → mensagem. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  shifts_no_time_overlap: 'Já existe uma jornada nesse horário. Ajuste o início ou o fim.',
  shifts_no_odometer_overlap: 'Esse trecho do hodômetro já está em outra jornada deste veículo. Confira os km.',
  shifts_odometer_order: 'O hodômetro final não pode ser menor que o inicial.',
  shifts_distance_limit: 'Mais de 2.000 km numa jornada? Confira o hodômetro.',
  shifts_time_order: 'O fim precisa ser depois do início.',
  shifts_max_duration: 'Uma jornada pode ter no máximo 24 horas.',
  shifts_break_fits: 'A pausa não pode ser maior que a jornada.',
  shift_earnings_shift_id_platform_id_key: 'Cada plataforma só pode aparecer uma vez na jornada.',
  platforms_user_name_active_key: 'Você já tem uma plataforma com esse nome.',
  vehicles_energy_config: 'Complete o consumo e o preço do combustível ou da energia.',
  vehicles_motorcycle_powertrain: 'Moto só pode ser a combustão ou elétrica.',
  vehicles_rent_only_rented: 'Aluguel só vale para veículo alugado.',
  vehicles_financing_only_financed: 'Parcela só vale para veículo financiado.',
  vehicles_rented_no_depreciation: 'Veículo alugado não tem depreciação para você.',
}

const CODE_MESSAGES: Record<string, string> = {
  '23001': 'Este veículo tem jornadas registradas. Arquive em vez de excluir.',
  '23503': 'Esse item está ligado a outros registros.',
  '23505': 'Esse registro já existe.',
  '23514': 'Algum valor está fora do permitido. Confira os campos.',
  '23P01': 'Esse lançamento se sobrepõe a outro.',
  '42501': 'Sem permissão para isso. Entre de novo na sua conta.',
  PGRST116: 'Registro não encontrado.',
  PGRST301: 'Sua sessão expirou. Entre de novo.',
  PGRST303: 'Sua sessão expirou. Entre de novo.',
  P0002: 'Registro não encontrado.',
}

interface MaybeError {
  code?: unknown
  message?: unknown
  name?: unknown
}

export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  if (!error || typeof error !== 'object') return fallback
  const { code, message, name } = error as MaybeError
  const text = typeof message === 'string' ? message : ''

  if (typeof code === 'string' && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code]
  for (const [constraint, friendly] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (text.includes(constraint)) return friendly
  }
  if (typeof code === 'string' && CODE_MESSAGES[code]) return CODE_MESSAGES[code]
  if (name === 'TypeError' || /fetch|network|Failed to fetch|Load failed/i.test(text)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  }
  return fallback
}

/** Tipo de `data` no ramo de sucesso da resposta (null só se o próprio sucesso admite, ex.: maybeSingle). */
type SuccessData<R> = Extract<R, { error: null }> extends { data: infer D } ? D : never

/** Lança o erro do Supabase (para o TanStack Query tratar) ou devolve os dados. */
export function unwrap<R extends { data: unknown; error: unknown }>(result: R): SuccessData<R> {
  if (result.error) throw result.error
  return result.data as SuccessData<R>
}
