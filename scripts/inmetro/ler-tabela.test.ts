import { describe, expect, it } from 'vitest'
import { matchFamily, parseRow, type BrandHit } from './ler-tabela.ts'

const BRANDS = ['HYUNDAI', 'VW', 'CHEVROLET', 'BYD', 'RENAULT']
const findBrand = (tokens: string[]): BrandHit | null => {
  const i = tokens.findIndex((t) => BRANDS.includes(t.toUpperCase()))
  return i < 0 ? null : { name: tokens[i], start: i, end: i + 1 }
}

describe('parseRow: um formato de cada ano', () => {
  it('2026 (etanol e gasolina com cidade, estrada e combinado)', () => {
    const row = parseRow(
      ' Compacto Hyundai HB20 Sense 1.0-12V Combustão M-5 S E F 31 204 3 A 0 113 93 \\ 9,9 10,7 10,2 13,3 15,4 14,2 \\ \\ \\ \\ 1,48 \\ B B -',
      2026,
      findBrand,
    )
    expect(row).toMatchObject({ engine: '1.0', gearbox: 'manual', ethanol: 9.9, gasoline: 13.3, rest: 'HB20 Sense 1.0-12V Combustão' })
  })

  it('2025 (ponto decimal)', () => {
    const row = parseRow(' Compacto Hyundai HB20 Sense 1.0-12V Combustão M-5 S E F 23 257 2 A 0 93 \\ 9.9 10.7 13.3 15.4 \\ \\ 1.48 \\ A B SIM', 2025, findBrand)
    expect(row).toMatchObject({ engine: '1.0', ethanol: 9.9, gasoline: 13.3 })
  })

  it('2021 (propulsão antes do combustível, motor "1.0L - 8V")', () => {
    const row = parseRow(
      'Compacto CHEVROLET ONIX JOY JOY 1.0L - 8V M-6 S E Combustão F 0,035 0,680 0,017 B 0 98 8,8 10,3 12,8 14,7 1,58 A B',
      2021,
      findBrand,
    )
    expect(row).toMatchObject({ engine: '1.0', gearbox: 'manual', ethanol: 8.8, gasoline: 12.8 })
  })

  it('2020 (hífen invisível) com turbo e câmbio automático', () => {
    const row = parseRow('COMPACTO HYUNDAI HB20 1.0­12V Turbo Evolution A­6 S E F 0,014 0,186 0,019 B 0 104 8,2 10,2 11,8 14,2 1,67 B B ­', 2020, findBrand)
    expect(row).toMatchObject({ engine: '1.0 Turbo', gearbox: 'automático', ethanol: 8.2, gasoline: 11.8 })
  })

  it('2019 (versão com número antes do motor de verdade)', () => {
    const row = parseRow('Compacto CHEVROLET ONIX (MY19) 1.4AT LTZ 1.4L - 8V A-6 S E F 0,025 0,593 0,028 B 0 106 7,9 9,7 11,6 14,0 1,73 C B -', 2019, findBrand)
    expect(row).toMatchObject({ engine: '1.4', gearbox: 'automático', ethanol: 7.9, gasoline: 11.6 })
  })

  it('2018 e câmbio sem hífen', () => {
    expect(parseRow('Compacto VW Gol Trendline 1.0-12V M-5 S H F 0,022 0,289 0,026 B 0 95 8,9 10,4 13,1 14,9 1,56 A B SIM', 2018, findBrand)).toMatchObject({
      engine: '1.0',
      ethanol: 8.9,
      gasoline: 13.1,
    })
    expect(parseRow('Esportivo Renault Kwid Intens / Life / Zen 1.0-12V M5 S M / E F 0,021 0,202 0,017 B 0 86 10,3 10,8 14,9 15,6 1,39 A A SIM', 2019, findBrand)).toMatchObject({
      engine: '1.0',
      gearbox: 'manual',
      gasoline: 14.9,
    })
  })

  it('"AT" e "200TSI" no nome da versão; híbrido marcado só como HV ou pelo consumo', () => {
    const BRANDS2 = (tokens: string[]) => {
      const i = tokens.findIndex((t) => ['RENAULT', 'VW', 'TOYOTA'].includes(t.toUpperCase()))
      return i < 0 ? null : { name: tokens[i], start: i, end: i + 1 }
    }
    expect(
      parseRow(
        'Utilitário Esportivo Compacto RENAULT KARDIAN TECH AT 1.0 12V Combustão DCT-6 S E F 28 397 2 B 0 121 100 \\ 8,8 9,7 9,2 12,8 13,9 13,3 \\ \\ \\ \\ 1,61 \\',
        2026,
        BRANDS2,
      ),
    ).toMatchObject({ engine: '1.0', gearbox: 'automático', gasoline: 12.8 })
    expect(
      parseRow('Médio VW T-Cross COMFORTLINE 200TSI AUTO 1.0-12V A-6 S E Combustão F 0,028 0,698 0,027 C 0 113 7,6 9,5 10,8 13,4 1,82 C C', 2021, BRANDS2),
    ).toMatchObject({ engine: '1.0 Turbo' })
    expect(parseRow('GRANDE TOYOTA Corolla 1.8­16V Altis HV CVT S E F 0,008 0,057 0,001 A 0 84 10,9 9,9 16,3 14,5 1,38 A A SIM', 2020, BRANDS2)).toMatchObject({
      engine: '1.8 Híbrido',
    })
    expect(parseRow('GRANDE TOYOTA Corolla 1.8­16V Altis Premium CVT S E F 0,008 0,057 0,001 A 0 84 10,9 9,9 16,3 14,5 1,38 A A SIM', 2020, BRANDS2)).toMatchObject({
      engine: '1.8 Híbrido',
    })
  })

  it('elétrico vira km/kWh a partir do MJ/km', () => {
    const row = parseRow(' Sub Compacto BYD DOLPHIN MINI GS EV Elétrico Elétrico N.A. S E E ND ND ND A \\ 0 0 \\ \\ \\ \\ \\ \\ \\ 58,59 41,9 \\ \\ 0,41 280 A A -', 2026, findBrand)
    expect(row).toMatchObject({ engine: 'Elétrico', gearbox: null, kmPerKwh: 8.8 })
  })

  it('recusa números fora do lugar, plug-in e linhas que não são de veículo', () => {
    // etanol rendendo mais que gasolina: colunas trocadas
    expect(parseRow('Compacto VW Gol Trendline 1.0-12V M-5 S H F 0,022 B 0 95 13,1 14,9 8,9 10,4 1,56', 2018, findBrand)).toBeNull()
    expect(parseRow('SUV BYD SONG PLUS DM-i Plug-in A-1 S E F ND 0,50 \\ 1,10', 2025, findBrand)).toBeNull()
    expect(parseRow('Categoria Marca Modelo Versão Motor Automática Dupla (M) Gasolina Etanol', 2019, findBrand)).toBeNull()
  })
})

describe('matchFamily', () => {
  const chevrolet = ['Onix', 'Onix Plus', 'Prisma', 'Joy', 'S10']
  it('fica com o modelo mais longo que começa o texto', () => {
    expect(matchFamily('ONIX PLUS PREMIER 1.0T-12V', chevrolet)).toBe('Onix Plus')
    expect(matchFamily('ONIX (MY19) 1.4AT LTZ', chevrolet)).toBe('Onix')
    expect(matchFamily('Novo PRISMA LT 1.4', chevrolet)).toBe('Prisma')
    expect(matchFamily('ONIXX 1.0', chevrolet)).toBeNull()
  })
  it('ignora hífen e acento', () => {
    expect(matchFamily('T CROSS 200 TSI', ['T-Cross', 'Taos'])).toBe('T-Cross')
    expect(matchFamily('up! take 1.0', ['up!', 'Polo'])).toBe('up!')
  })
})
