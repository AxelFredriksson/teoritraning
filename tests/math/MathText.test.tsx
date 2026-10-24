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
