import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Planos() {
  const navigate = useNavigate();

  return (
    <div className="planos-page">
      <section className="planos-hero">
        <div className="planos-hero__overlay">
          <div className="container">
            <h1 className="planos-hero__titulo">Escolha seu plano e comece hoje</h1>
            <p className="planos-hero__subtitulo">
              Body Coach com acompanhamento pessoal, treinos e métricas de progresso.
            </p>
            <div className="planos-hero__botoes">
              <button className="btn btn--primary btn--pix" onClick={() => navigate("/pagamento/pix")}>
                Pagar com Pix<br /><span className="btn--pix__valor">Plano a partir de R$ 49,90/mês</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="planos-lista" aria-label="Planos disponíveis">
        <div className="container">
          <h2 className="section-title">Planos</h2>
          <div className="planos-grid">
            <article className="plano-card plano-card--destaque" aria-labelledby="plano-basico">
              <div className="plano-card__crown">★ Mais escolhido</div>
              <h3 id="plano-basico" className="plano-card__titulo">Básico</h3>
              <p className="plano-card__descricao">Para quem está começando e quer criar o hábito de treinar.</p>
              <div className="plano-card__preco">
                <span className="plano-card__valor">R$ 49,90</span>
                <span className="plano-card__periodo">/mês</span>
              </div>
              <ul className="plano-card__itens">
                <li>✓ Plano de treino personalizado</li>
                <li>✓ Acompanhamento de progresso semanal</li>
                <li>✓ Suporte por e-mail</li>
                <li>✗ Aulas ao vivo</li>
                <li>✗ Nutrição personalizada</li>
              </ul>
              <button className="plano-card__btn btn--primary" onClick={() => navigate("/pagamento/pix?plano=basico")}>
                Pagar com Pix
              </button>
            </article>

            <article className="plano-card" aria-labelledby="plano-pro">
              <h3 id="plano-pro" className="plano-card__titulo">Pro</h3>
              <p className="plano-card__descricao">Para quem quer resultados mais rápidos com acompanhamento próximo.</p>
              <div className="plano-card__preco">
                <span className="plano-card__valor">R$ 89,90</span>
                <span className="plano-card__periodo">/mês</span>
              </div>
              <ul className="plano-card__itens">
                <li>✓ Plano de treino personalizado</li>
                <li>✓ Acompanhamento de progresso semanal</li>
                <li>✓ Suporte por WhatsApp</li>
                <li>✓ Aulas ao vivo gravadas</li>
                <li>✗ Nutrição personalizada</li>
              </ul>
              <button className="plano-card__btn btn--primary" onClick={() => navigate("/pagamento/pix?plano=pro")}>
                Pagar com Pix
              </button>
            </article>

            <article className="plano-card" aria-labelledby="plano-premium">
              <h3 id="plano-premium" className="plano-card__titulo">Premium</h3>
              <p className="plano-card__descricao">Acompanhamento completo: treino, nutrição e suporte direto com o coach.</p>
              <div className="plano-card__preco">
                <span className="plano-card__valor">R$ 149,90</span>
                <span className="plano-card__periodo">/mês</span>
              </div>
              <ul className="plano-card__itens">
                <li>✓ Plano de treino personalizado</li>
                <li>✓ Acompanhamento de progresso semanal</li>
                <li>✓ Suporte por WhatsApp prioritário</li>
                <li>✓ Aulas ao vivo</li>
                <li>✓ Nutrição personalizada</li>
              </ul>
              <button className="plano-card__btn btn--primary" onClick={() => navigate("/pagamento/pix?plano=premium")}>
                Pagar com Pix
              </button>
            </article>
          </div>
        </div>
      </section>

      <section className="planos-prova-social" aria-label="Depoimentos de testadores">
        <div className="container">
          <h2 className="section-title">O que dizem quem já testou</h2>
          <div className="prova-grid">
            <article className="depoimento">
              <div className="depoimento__avatar">AS</td>
              <div className="depoimento__conteudo">
                <p className="depoimento__texto">"Perdeu 5 kg em 2 meses com o plano Básico. O app é simples e o treino cabe na minha rotina."</p>
                <div className="depoimento__autor">
                  <strong>Ana Silva</strong><br /><span className="depoimento__cargo">Testadora, plano Básico</span>
                </div>
              </div>
            </article>

            <article className="depoimento">
              <div className="depoimento__avatar">RC</td>
              <div className="depoimento__conteudo">
                <p className="depoimento__texto">"O plano Pro mudou meus treinos. Acompanhamento semanal faz toda a diferença para não desistir."</p>
                <div className="depoimento__autor">
                  <strong>Ricardo Costa</strong><br /><span className="depoimento__cargo">Testador, plano Pro</span>
                </div>
              </div>
            </article>

            <article className="depoimento">
              <div className="depoimento__avatar">FM</td>
              <div className="depoimento__conteudo">
                <p className="depoimento__texto">"Premium vale cada centavo: treino + nutrição + coach direto no WhatsApp. Resultados em 4 semanas."</p>
                <div className="depoimento__autor">
                  <strong>Fernanda Moura</strong><br /><span className="depoimento__cargo">Testadora, plano Premium</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="planos-faq" aria-label="Perguntas frequentes">
        <div className="container">
          <h2 className="section-title">Perguntas frequentes</h2>
          <div className="faq-lista">
            <details className="faq-item">
              <summary>Como funciona o pagamento por Pix?</summary>
              <p>Após escolher o plano, você gera o código Pix e paga pelo seu banco. A confirmação é automática e o acesso libera em minutos.</p>
            </details>
            <details className="faq-item">
              <summary>Posso mudar de plano depois?</summary>
              <p>Sim. Você pode fazer upgrade ou downgrade a qualquer momento. A diferença é cobrada proporcionalmente.</p>
            </details>
            <details className="faq-item">
              <summary>Tem período de teste grátis?</summary>
              <p>Os primeiros 7 dias são grátis para testar qualquer plano. Pode cancelar antes sem pagar nada.</p>
            </details>
            <details className="faq-item">
              <summary>Preciso de academias ou equipamentos?</summary>
<p>Os planos incluem opções para casa e academia. O coach adapta o treino ao que você tem disponível.</p>
            </details>
            <details className="faq-item">
              <summary>Como cancelo minha assinatura?</summary>
<p>Pode cancelar direto no app, nas configurações da assinatura. Sem fidelidade e sem multa.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="planos-cta">
        <div className="container">
          <h2>Pronto para começar?</h2>
          <p>Escolha seu plano e pague com Pix para começar ainda hoje.</p>
          <button className="btn btn--primary btn--pix" onClick={() => navigate("/pagamento/pix")}>
            Pagar com Pix<br /><span className="btn--pix__valor">Planos a partir de R$ 49,90/mês</span>
          </button>
        </div>
      </section>
    </div>
  );
}