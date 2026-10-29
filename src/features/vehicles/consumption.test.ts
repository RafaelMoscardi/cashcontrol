import { describe, expect, it } from 'vitest'
import { inmetroOptions } from './consumption'

describe('inmetroOptions', () => {
  it('mostra o consumo na cidade por motor e câmbio, com o combustível escolhido', () => {
    const gasolina = inmetroOptions('Hyundai', 'HB20', 'combustion', 'gasoline')
    expect(gasolina.length).toBeGreaterThan(1)
    expect(gasolina.length).toBeLessThanOrEqual(4)
    expect(gasolina).toContainEqual(expect.objectContaining({ label: '1.0 · manual', unit: 'km/l' }))
    const etanol = inmetroOptions('Hyundai', 'HB20', 'combustion', 'ethanol')
    const g = gasolina.find((o) => o.label === '1.0 · manual')!
    const e = etanol.find((o) => o.label === '1.0 · manual')!
    expect(e.value).toBeLessThan(g.value)
  })

  it('cobre carros que saíram de linha', () => {
    expect(inmetroOptions('Volkswagen', 'Gol', 'combustion', 'gasoline').length).toBeGreaterThan(0)
    expect(inmetroOptions('Chevrolet', 'Prisma', 'combustion', 'ethanol').length).toBeGreaterThan(0)
  })

  it('elétrico em km/kWh; híbrido só com motor híbrido', () => {
    expect(inmetroOptions('BYD', 'Dolphin Mini', 'electric', 'gasoline')).toEqual([expect.objectContaining({ unit: 'km/kWh', label: 'Elétrico' })])
    const hibrido = inmetroOptions('Toyota', 'Corolla', 'hybrid', 'gasoline')
    expect(hibrido.length).toBeGreaterThan(0)
    expect(hibrido.every((o) => o.value > 14)).toBe(true)
    expect(inmetroOptions('Toyota', 'Corolla', 'combustion', 'gasoline').every((o) => o.value < 14)).toBe(true)
  })

  it('sem sugestão para plug-in, GNV e modelos fora da tabela', () => {
    expect(inmetroOptions('Hyundai', 'HB20', 'plugin_hybrid', 'gasoline')).toEqual([])
    expect(inmetroOptions('Hyundai', 'HB20', 'combustion', 'cng')).toEqual([])
    expect(inmetroOptions('Chevrolet', 'Opala', 'combustion', 'gasoline')).toEqual([])
  })
})
