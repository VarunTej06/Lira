import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFound, PageBoundary } from './PageBoundary'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })

let shouldCrash = true
function Bomb() {
  if (shouldCrash) throw new Error('kaboom')
  return <p>page content</p>
}
const render = (pageKey: string, withSidebar = true) => act(() => {
  root.render(
    <MemoryRouter>
      {withSidebar && <nav>sidebar</nav>}
      <PageBoundary pageKey={pageKey}><Bomb /></PageBoundary>
    </MemoryRouter>,
  )
})

describe('PageBoundary', () => {
  it('shows a friendly message instead of a blank screen, and the rest of the app stays', () => {
    shouldCrash = true
    render('a')
    expect(host.textContent).toContain('This page hit a problem')
    expect(host.textContent).toContain('kaboom')
    expect(host.textContent).toContain('sidebar') // outside the boundary: still there
    expect(host.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('"Try again" renders the page again', () => {
    shouldCrash = true
    render('a')
    shouldCrash = false
    const retry = [...host.querySelectorAll('button')].find(b => b.textContent === 'Try again')!
    act(() => retry.click())
    expect(host.textContent).toContain('page content')
    expect(host.textContent).not.toContain('This page hit a problem')
  })

  it('going to another page clears the error', () => {
    shouldCrash = true
    render('a')
    expect(host.textContent).toContain('This page hit a problem')
    shouldCrash = false
    render('b')
    expect(host.textContent).toContain('page content')
  })

  it('renders children normally when nothing is wrong', () => {
    shouldCrash = false
    render('a')
    expect(host.textContent).toContain('page content')
  })
})

describe('NotFound', () => {
  it('says what is missing and links back', () => {
    act(() => root.render(<MemoryRouter><NotFound what="This project" backTo="/projects" backLabel="All projects" /></MemoryRouter>))
    expect(host.textContent).toContain('This project was not found')
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/projects')
    expect(host.querySelector('a')?.textContent).toBe('All projects')
  })
})
