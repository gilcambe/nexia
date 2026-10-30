import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Painel from '../Painel';

// Mock the usoCloudflare function
jest.mock('../../../hooks/useCloudflare', () => ({
  usoCloudflare: () => ({ configurado: false }),
}));

describe('Painel component', () => {
  it('should show "Falta ligar" and gray color when Cloudflare is not configured', () => {
    render(<Painel />);

    // Check if the text 'Falta ligar' is present
    expect(screen.getByText('Falta ligar')).toBeInTheDocument();

    // Check if the color class does not contain 'red' or 'error'
    const element = screen.getByText('Falta ligar');
    expect(element.className).not.toContain('red');
    expect(element.className).not.toContain('error');
    expect(element.className).toContain('gray');

    // Click the element to show the step-by-step guide
    fireEvent.click(element);

    // Check if the step-by-step guide with the link 'dash.cloudflare.com' is visible
    expect(screen.getByText('dash.cloudflare.com')).toBeInTheDocument();
  });
});
