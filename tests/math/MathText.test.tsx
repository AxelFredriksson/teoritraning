import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MathText } from '../../src/math/MathText'

test('MathText renders $\int_0^\infty$ as katex element', () => {
  const { container } = render(<MathText md={'Se $\int_0^\infty f$'} />)
  expect(container.querySelector('.katex')).not.toBeNull()
})

test('MathText with "$\frac{1$" renders without throwing', () => {
  expect(() => render(<MathText md={'Trasig $\frac{1$ text'} />)).not.toThrow()
})

test('MathInline renders math without wrapping paragraph', async () => {
  const { MathInline } = await import('../../src/math/MathText')
  const { container } = render(<h2><MathInline md={'Distribution $\mathcal D\'(I)$'} /></h2>)
  expect(container.querySelector('h2 .katex')).not.toBeNull()
  expect(container.querySelector('h2 p')).toBeNull()
})
