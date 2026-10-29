import { describe, expect, it } from 'vitest'
import { brandName, buildCatalog, modelFamily } from './normalizar.ts'

describe('brandName', () => {
  it('limpa os nomes da FIPE', () => {
    expect(brandName('GM - Chevrolet')).toBe('Chevrolet')
    expect(brandName('VW - VolksWagen')).toBe('Volkswagen')
    expect(brandName('HONDA')).toBe('Honda')
    expect(brandName('HARLEY-DAVIDSON')).toBe('Harley-Davidson')
    expect(brandName('MV AGUSTA')).toBe('MV Agusta')
    expect(brandName('BYD')).toBe('BYD')
    expect(brandName('Royal Enfield')).toBe('Royal Enfield')
  })
})

describe('modelFamily (carros)', () => {
  it.each([
    ['ONIX HATCH LT 1.0 12V Flex 5p Mec.', 'Onix'],
    ['ONIX SEDAN Plus LTZ 1.0 12V TB Flex Aut.', 'Onix Plus'],
    ['Grand Siena ATTRACTIVE 1.4 Fire Flex 8V', 'Grand Siena'],
    ['HB20S Comfort Plus 1.0 TB Flex 12V Mec.', 'HB20S'],
    ['T-Cross Highline 1.4 TSI Flex 16V Aut.', 'T-Cross'],
    ['HR-V EXL 1.8 Flexone 16V 5p Aut.', 'HR-V'],
    ['Corolla Cross XRE 2.0 16V Flex Aut.', 'Corolla Cross'],
    ['Tiggo 5X PRO 1.5 Turbo Flex Aut.', 'Tiggo 5X'],
    ['Haval H6 1.5 Turbo PHEV Aut.', 'Haval H6'],
    ['GOL 1.0 Flex 12V 5p', 'Gol'],
    ['KA SE 1.0 Flex 5p', 'Ka'],
    ['Strada/ Adventure 1.8 CE Flex', 'Strada'],
    ['Ducato-15 Furgão 2.8', 'Ducato'],
  ])('%s → %s', (fipe, model) => {
    expect(modelFamily(fipe, 'car')).toBe(model)
  })
})

describe('modelFamily (motos)', () => {
  it.each([
    ['CG 160 FAN/ FAN FLEX', 'CG 160'],
    ['BIZ 125/125i Flex', 'Biz 125'],
    ['POP 110i', 'Pop 110i'],
    ['NXR 160 BROS ESDD', 'NXR 160'],
    ['NEO AUTOMATIC 125cc', 'Neo 125'],
    ['NMAX Connected 160', 'NMax 160'],
    ['YBR 150 FACTOR ED', 'Factor 150'],
    ['XTZ 250 LANDER', 'Lander 250'],
    ['MT-07/MT-07 ABS 689cc', 'MT-07'],
    ['GSX-R 1000', 'GSX-R 1000'],
    ['DOMINAR NS160', 'Dominar NS160'],
  ])('%s → %s', (fipe, model) => {
    expect(modelFamily(fipe, 'motorcycle')).toBe(model)
  })
})

describe('buildCatalog', () => {
  it('junta versões, tira repetidos e põe as marcas populares primeiro', () => {
    const catalog = buildCatalog('car', [
      { brand: 'VW - VolksWagen', versions: ['GOL 1.0 Flex', 'Gol City 1.6', 'Polo 1.0 TSI'] },
      { brand: 'GM - Chevrolet', versions: ['ONIX HATCH LT 1.0', 'Onix 1.4 LTZ'] },
      { brand: 'Agrale', versions: ['MARRUÁ AM 200'] },
    ])
    expect(catalog.popular).toEqual(['Chevrolet', 'Volkswagen'])
    expect(Object.keys(catalog.brands)).toEqual(['Agrale', 'Chevrolet', 'Volkswagen'])
    expect(catalog.brands.Volkswagen).toEqual(['Gol', 'Polo'])
    expect(catalog.brands.Chevrolet).toEqual(['Onix'])
  })
})
