import { render, screen } from '@testing-library/react';
import RootLayout from './layout';

describe('RootLayout', () => {
  it('renders children inside body', () => {
    render(
      <RootLayout>
        <div data-testid="child">hello</div>
      </RootLayout>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });
});
