/**
 * iPhone com o app instalado na tela inicial: depois que o teclado abre, o Safari às vezes encolhe a
 * tela em ~59 px (a altura da barra de status) e não volta mais. A barra de baixo sobe e sobra uma faixa
 * escura embaixo. Esconder e mostrar a raiz do app no mesmo quadro força o Safari a recalcular a tela.
 *
 * Só age no app instalado no iOS, fora da digitação e quando a altura está menor que a da tela. Se o
 * recálculo não resolver duas vezes seguidas (ex.: iPad em janela), para de tentar.
 */
export function healIosStandaloneViewport() {
  if ((navigator as Navigator & { standalone?: boolean }).standalone !== true) return
  const root = document.getElementById('root')
  if (!root) return

  let failures = 0
  const fullHeight = () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches
    return portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
  }
  const shrunk = () => window.innerHeight < fullHeight() - 4
  const typing = () => {
    const el = document.activeElement
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
  }

  const heal = () => {
    if (failures >= 2 || typing() || !shrunk()) return
    const scrollY = window.scrollY
    root.style.display = 'none'
    void root.offsetHeight
    root.style.display = ''
    window.scrollTo(0, scrollY)
    window.setTimeout(() => {
      failures = shrunk() ? failures + 1 : 0
    }, 100)
  }

  // Depois de fechar o teclado, ao voltar para o app e ao abrir (chamadas próximas viram uma só)
  let timer: number | undefined
  const later = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(heal, 150)
  }
  document.addEventListener('focusout', later)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') later()
  })
  window.addEventListener('pageshow', later)
  window.addEventListener('orientationchange', () => {
    failures = 0
    later()
  })
  later()
}
