import { describe, expect, it } from 'vitest'
import { errorMessage, isNotFound, unwrap } from './errors'
import {
  capitalize,
  formatDate,
  formatDateLong,
  formatDuration,
  formatKm,
  formatMoney,
  formatMonthYear,
  formatPerHour,
  formatPerKm,
  formatSignedMoney,
  formatWeekdayShort,
} from './format'
import { parseDecimal, parseInteger, toDecimalInput } from './parse'

// Intl usa espaço não separável entre "R$" e o número
const nb = (s: string) => s.replace(/ /g, ' ')

describe('formatação pt-BR', () => {
  it('dinheiro em reais a partir de centavos', () => {
    expect(formatMoney(123456)).toBe(nb('R$ 1.234,56'))
    expect(formatMoney(-2500)).toBe(nb('-R$ 25,00'))
    expect(formatSignedMoney(2500)).toBe(nb('+R$ 25,00'))
    expect(formatSignedMoney(0)).toBe(nb('R$ 0,00'))
  })

  it('distância, taxas e duração', () => {
    expect(formatKm(1234.5)).toBe('1.234,5 km')
    expect(formatPerKm(0.6)).toBe(nb('R$ 0,60/km'))
    expect(formatPerHour(25.3333)).toBe(nb('R$ 25,33/h'))
    expect(formatPerKm(null)).toBe('—')
    expect(formatDuration(540)).toBe('9 h')
    expect(formatDuration(555)).toBe('9 h 15 min')
    expect(formatDuration(45)).toBe('45 min')
  })

  it('datas no calendário brasileiro', () => {
    expect(formatDate('2026-10-25')).toBe('25/10/2026')
    expect(formatDateLong('2026-10-25')).toBe('domingo, 25 de outubro')
    expect(formatWeekdayShort('2026-10-25')).toBe('dom')
    expect(capitalize(formatMonthYear('2026-10-01'))).toBe('Outubro de 2026')
  })
})

describe('leitura de números digitados', () => {
  it('aceita vírgula ou ponto decimal e separador de milhar', () => {
    expect(parseDecimal('11,5')).toBe(11.5)
    expect(parseDecimal('11.5')).toBe(11.5)
    expect(parseDecimal('1.234,56')).toBe(1234.56)
    expect(parseDecimal('R$ 6,299')).toBe(6.299)
    expect(parseDecimal(' 0,12 ')).toBe(0.12)
    expect(parseDecimal(',5')).toBe(0.5)
  })

  it('recusa texto que não é número', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })

  it('inteiros só com dígitos e volta para o formato de edição', () => {
    expect(parseInteger('45.678 km')).toBe(45678)
    expect(parseInteger('')).toBeNull()
    expect(toDecimalInput(11.5)).toBe('11,5')
    expect(toDecimalInput(1234.5)).toBe('1234,5')
    expect(toDecimalInput(null)).toBe('')
  })
})

describe('mensagens de erro', () => {
  it('reconhece consulta sem linha e leva o status HTTP junto no erro', () => {
    expect(isNotFound({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })).toBe(true)
    expect(isNotFound({ code: '23505' })).toBe(false)
    expect(isNotFound(null)).toBe(false)
    let thrown: unknown
    try {
      unwrap({ data: null, error: { code: 'PGRST116', message: '' }, status: 406 })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toMatchObject({ code: 'PGRST116', status: 406 })
  })

  it('traduz erros de autenticação e de restrições do banco', () => {
    expect(errorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
    expect(
      errorMessage({ code: '23P01', message: 'conflicting key value violates exclusion constraint "shifts_no_time_overlap"' }),
    ).toBe('Já existe uma jornada nesse horário. Ajuste o início ou o fim.')
    expect(errorMessage({ code: '23001', message: 'update or delete on table "vehicles" violates RESTRICT' })).toContain('Arquive')
    expect(errorMessage(new TypeError('Failed to fetch'))).toContain('Sem conexão')
    expect(errorMessage(null, 'Falhou')).toBe('Falhou')
  })
})
