import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Simulador from './simulador';

describe('Simulador Component', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({
          title: 'Basic Customer Support Call',
          description: 'A script for a basic customer support call in English.',
          steps: [
            {
              customer: 'Hello, I need help with my internet connection.',
              expectedKeywords: ['help', 'internet', 'connection'],
              translation: 'Olá, preciso de ajuda com minha conexão de internet.'
            }
          ]
        })
      })
    ) as jest.Mock;
  });

  it('renders the script title and description', async () => {
    render(<Simulador />);
    expect(await screen.findByText('Basic Customer Support Call')).toBeInTheDocument();
    expect(screen.getByText('A script for a basic customer support call in English.')).toBeInTheDocument();
  });

  it('displays the customer message and allows hearing it again', async () => {
    render(<Simulador />);
    expect(await screen.findByText('Hello, I need help with my internet connection.')).toBeInTheDocument();
    const hearAgainButton = screen.getByText('Hear Again');
    fireEvent.click(hearAgainButton);
    // Add assertions for speech synthesis if needed
  });

  it('allows the user to type a response and submit it', async () => {
    render(<Simulador />);
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'I need help with my internet connection.' } });
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);
    expect(screen.getByText('Great job! You matched all the expected keywords.')).toBeInTheDocument();
  });

  it('provides feedback on the response', async () => {
    render(<Simulador />);
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'I need help with my internet.' } });
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);
    expect(screen.getByText('Good effort! You matched some of the expected keywords.')).toBeInTheDocument();
  });
});
