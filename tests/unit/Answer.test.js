import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Answer from '@/components/Answer.vue';

describe('Answer.vue', () => {
  it('renderiza a resposta corretamente', () => {
    const resposta = 'Esta é uma resposta de teste';
    const wrapper = mount(Answer, {
      props: { resposta }
    });
    expect(wrapper.text()).toContain(resposta);
  });

  it('exibe lista de fontes quando fontes são fornecidas', () => {
    const fontes = [
      { titulo: 'Fonte 1', url: 'https://exemplo.com/1' },
      { titulo: 'Fonte 2', url: 'https://exemplo.com/2' }
    ];
    const wrapper = mount(Answer, {
      props: { fontes }
    });
    expect(wrapper.findAll('.answer__source')).toHaveLength(2);
    expect(wrapper.text()).toContain('1. Fonte 1');
    expect(wrapper.text()).toContain('2. Fonte 2');
  });

  it('não exibe lista de fontes quando vazia', () => {
    const wrapper = mount(Answer, {
      props: { fontes: [] }
    });
    expect(wrapper.find('.answer__sources').exists()).toBe(false);
  });

  it('exibe selo de alta certeza com cor verde', () => {
    const wrapper = mount(Answer, {
      props: { certeza: 'alta', tipoConversa: 'normal' }
    });
    expect(wrapper.find('.answer__badge--alta').exists()).toBe(true);
    expect(wrapper.text()).toContain('Alta certeza');
  });

  it('exibe selo de média certeza com cor amarelo', () => {
    const wrapper = mount(Answer, {
      props: { certeza: 'media', tipoConversa: 'normal' }
    });
    expect(wrapper.find('.answer__badge--media').exists()).toBe(true);
    expect(wrapper.text()).toContain('Média certeza');
  });

  it('exibe selo de baixa certeza com cor cinza', () => {
    const wrapper = mount(Answer, {
      props: { certeza: 'baixa', tipoConversa: 'normal' }
    });
    expect(wrapper.find('.answer__badge--baixa').exists()).toBe(true);
    expect(wrapper.text()).toContain('Baixa certeza');
  });

  it('exibe aviso quando avisoSensivel é true', () => {
    const wrapper = mount(Answer, {
      props: { avisoSensivel: true, tipoConversa: 'normal' }
    });
    expect(wrapper.text()).toContain('confirme com um profissional');
  });

  it('omite selo e aviso para tipoConversa poema', () => {
    const wrapper = mount(Answer, {
      props: { 
        certeza: 'alta', 
        avisoSensivel: true,
        tipoConversa: 'poema' 
      }
    });
    expect(wrapper.find('.answer__badge').exists()).toBe(false);
    expect(wrapper.find('.answer__warning').exists()).toBe(false);
  });

  it('omite selo e aviso para tipoConversa tradução', () => {
    const wrapper = mount(Answer, {
      props: { 
        certeza: 'alta', 
        avisoSensivel: true,
        tipoConversa: 'tradução' 
      }
    });
    expect(wrapper.find('.answer__badge').exists()).toBe(false);
    expect(wrapper.find('.answer__warning').exists()).toBe(false);
  });

  it('omite selo e aviso para tipoConversa código', () => {
    const wrapper = mount(Answer, {
      props: { 
        certeza: 'alta', 
        avisoSensivel: true,
        tipoConversa: 'codigo' 
      }
    });
    expect(wrapper.find('.answer__badge').exists()).toBe(false);
    expect(wrapper.find('.answer__warning').exists()).toBe(false);
  });

  it('omite selo e aviso para tipoConversa conversa pessoal', () => {
    const wrapper = mount(Answer, {
      props: { 
        certeza: 'alta', 
        avisoSensivel: true,
        tipoConversa: 'conversa pessoal' 
      }
    });
    expect(wrapper.find('.answer__badge').exists()).toBe(false);
    expect(wrapper.find('.answer__warning').exists()).toBe(false);
  });

  it('exibe selo e aviso para tipoConversa normal', () => {
    const wrapper = mount(Answer, {
      props: { 
        certeza: 'alta', 
        avisoSensivel: true,
        tipoConversa: 'normal' 
      }
    });
    expect(wrapper.find('.answer__badge').exists()).toBe(true);
    expect(wrapper.find('.answer__warning').exists()).toBe(true);
  });
});